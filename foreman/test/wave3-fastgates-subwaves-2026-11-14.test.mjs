import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { HaltError, parseWaves, computeSubwaveBatches, pathsOverlap } from '../bin/foreman-lib.mjs';
import { checkDeltaCoverage, tokensFor, prioritizeTestFiles } from '../bin/delta-coverage-gate.mjs';
import {
  buildAnvilSlice,
  buildBoundedGitDiff,
  runFastHygieneGate,
  runFastAegisGate,
  runFastAnvilAstGate,
  checkHunkScopedTestEdits,
  normalizeReceiptTelemetry,
  buildAttestedRunManifest,
} from '../bin/fast-gates.mjs';
import { preflightCliAuth } from '../bin/preflight.mjs';
import { aggregate, parseJsonl, renderReport } from '../bin/phase-report.mjs';
import { runWave } from '../bin/wave-engine.mjs';
import { runProject } from '../bin/project-engine.mjs';
import { _internals as wfInternals } from '../bin/wave-workflow.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCATE_PLAN = path.join(HERE, '..', 'bin', 'locate-plan.mjs');

function initGitRepo(dir) {
  const opts = { cwd: dir, encoding: 'utf8', windowsHide: true, shell: false };
  assert.equal(spawnSync('git', ['init', '-q'], opts).status, 0);
  assert.equal(spawnSync('git', ['config', 'user.email', 'test@example.com'], opts).status, 0);
  assert.equal(spawnSync('git', ['config', 'user.name', 'Foreman Test'], opts).status, 0);
  assert.equal(spawnSync('git', ['add', '-A'], opts).status, 0);
  assert.equal(spawnSync('git', ['commit', '-q', '-m', 'init'], opts).status, 0);
}

function writeBasicNodeProject(dir, planBody) {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'test'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'DESCRIPTION.md'), '# Test Project\nDeterministic test fixture.\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'EXECUTION-LOG.md'), '# Execution Log\n', 'utf8');
  fs.writeFileSync(
    path.join(dir, 'IMPLEMENTATION-PLAN.md'),
    `# Implementation Plan\n\ntest-command: node --test test/calc.test.mjs\n\n${planBody}\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(dir, 'src', 'calc.js'),
    'export function add(a, b) {\n  return a - b;\n}\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(dir, 'test', 'calc.test.mjs'),
    "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../src/calc.js';\n\ntest('adds numbers', () => {\n  assert.equal(add(2, 3), 5);\n});\n",
    'utf8',
  );
}

test('1. Post-elegance fast-close: 0 review-1 calls on both 0-edit and localized-trim elegance passes + hunk-scoped test check', async (t) => {
  // Case A: elegance proposes 0 cuts -> 0 extra review calls
  const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'w3-elegance-zero-'));
  t.after(() => fs.rmSync(dirA, { recursive: true, force: true }));
  writeBasicNodeProject(dirA, '## Wave 1: Fix add\nRepair `src/calc.js` so `add(2, 3) === 5`.');
  initGitRepo(dirA);

  let reviewCallsA = 0;
  let eleganceCallsA = 0;
  let fixCallsA = 0;
  const waveA = parseWaves(fs.readFileSync(path.join(dirA, 'IMPLEMENTATION-PLAN.md'), 'utf8'))[0];
  const resA = await runWave({
    projectDir: dirA,
    testCommand: 'node --test test/calc.test.mjs',
    wave: waveA,
    totalWaves: 1,
    planPath: path.join(dirA, 'IMPLEMENTATION-PLAN.md'),
    reviewerCount: 1,
    fixIterCap: 3,
    driver: {
      async execute() {
        fs.writeFileSync(path.join(dirA, 'src', 'calc.js'), 'export function add(a, b) {\n  return a + b;\n}\n', 'utf8');
        return { note: 'fixed add' };
      },
      async review() {
        reviewCallsA += 1;
        return { reviewer: 'r0', answerable: 'yes', findings: [] };
      },
      async elegance() {
        eleganceCallsA += 1;
        return { verdicts: [], keeps: [], markdown: '# Elegance\n0 cuts\n' };
      },
      async fix() {
        fixCallsA += 1;
        return { note: 'unexpected fix' };
      },
    },
  });
  assert.equal(resA.status, 'GO', resA.haltReason);
  assert.equal(reviewCallsA, 1, 'exactly 1 review pass; 0 post-elegance review-1 calls');
  assert.equal(eleganceCallsA, 1);
  assert.equal(fixCallsA, 0);

  // Case B: elegance proposes 1 localized trim -> fix runs, deterministic gates pass -> immediate GO with 0 review-1 calls!
  const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'w3-elegance-trim-'));
  t.after(() => fs.rmSync(dirB, { recursive: true, force: true }));
  writeBasicNodeProject(dirB, '## Wave 1: Fix add cleanly\nRepair `src/calc.js` so `add(2, 3) === 5`.');
  initGitRepo(dirB);

  let reviewCallsB = 0;
  let eleganceCallsB = 0;
  let fixCallsB = 0;
  const waveB = parseWaves(fs.readFileSync(path.join(dirB, 'IMPLEMENTATION-PLAN.md'), 'utf8'))[0];
  const resB = await runWave({
    projectDir: dirB,
    testCommand: 'node --test test/calc.test.mjs',
    wave: waveB,
    totalWaves: 1,
    planPath: path.join(dirB, 'IMPLEMENTATION-PLAN.md'),
    reviewerCount: 1,
    fixIterCap: 3,
    driver: {
      async execute() {
        fs.writeFileSync(
          path.join(dirB, 'src', 'calc.js'),
          'export function unusedHelper() { return 42; }\nexport function add(a, b) {\n  return a + b;\n}\n',
          'utf8',
        );
        return { note: 'fixed add with extra helper' };
      },
      async review() {
        reviewCallsB += 1;
        return { reviewer: 'r0', answerable: 'yes', findings: [] };
      },
      async elegance() {
        eleganceCallsB += 1;
        return {
          verdicts: [{
            verdict: 'CUT',
            target_file: 'src/calc.js',
            line_range: [1, 1],
            reason: 'unusedHelper is not requested by the plan',
            evidence: 'dead export',
          }],
          keeps: [],
          markdown: '# Elegance\n1 cut\n',
        };
      },
      async fix() {
        fixCallsB += 1;
        fs.writeFileSync(path.join(dirB, 'src', 'calc.js'), 'export function add(a, b) {\n  return a + b;\n}\n', 'utf8');
        return { note: 'trimmed unusedHelper' };
      },
    },
  });
  assert.equal(resB.status, 'GO', resB.haltReason);
  assert.equal(eleganceCallsB, 1);
  assert.equal(fixCallsB, 1, 'elegance trim executed once');
  assert.equal(reviewCallsB, 1, 'post-elegance double-review eliminated: 0 second review-1 calls when gate stays green!');

  // Case C: hunk-scoped test check ignores pre-existing untouched skip while rejecting newly added skip
  const dirC = fs.mkdtempSync(path.join(os.tmpdir(), 'w3-hunk-test-'));
  t.after(() => fs.rmSync(dirC, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dirC, 'test'), { recursive: true });
  const beforeTest = "import test from 'node:test';\ntest.skip('legacy pending', () => {});\ntest('real', () => {});\ntest('redundant', () => {});\n";
  fs.writeFileSync(path.join(dirC, 'test', 'sample.test.mjs'), "import test from 'node:test';\ntest.skip('legacy pending', () => {});\ntest('real', () => {});\n", 'utf8');
  assert.equal(
    checkHunkScopedTestEdits({ 'test/sample.test.mjs': beforeTest }, dirC, ['test/sample.test.mjs']),
    null,
    'pre-existing untouched test.skip must not trigger a false positive',
  );
  fs.writeFileSync(
    path.join(dirC, 'test', 'sample.test.mjs'),
    "import test from 'node:test';\ntest.skip('legacy pending', () => {});\ntest.skip('newly skipped real', () => {});\n",
    'utf8',
  );
  assert.match(
    checkHunkScopedTestEdits({ 'test/sample.test.mjs': beforeTest }, dirC, ['test/sample.test.mjs']) || '',
    /added skip\/xfail marker/,
  );
});

test('2. delta-coverage-gate ignores deletions, dotfiles, .sqlite-wal, non-code & strips compound extensions + decoupled gitDiff', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w3-delta-cov-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  writeBasicNodeProject(dir, '## Wave 1: Add calc\nUpdate `src/calc.js`.');
  initGitRepo(dir);

  assert.ok(tokensFor('src/widget.test.mjs').includes('widget'));
  assert.ok(!tokensFor('src/widget.test.mjs').includes('widget.test'));

  const prioritized = prioritizeTestFiles(['docs/helper.mjs', 'tests/unit/calc.test.mjs', 'src/other.js']);
  assert.equal(prioritized[0], 'tests/unit/calc.test.mjs');

  const cov = checkDeltaCoverage({
    changedFiles: [
      'src/old_unreferenced_module.js (deleted)',
      '.provider-schema-tmp.json',
      '.foreman/run-record.json',
      '.anchor/state.json',
      'data/state.sqlite',
      'data/state.sqlite-wal',
      'data/state.sqlite-shm',
      'docs/diagram.png',
      'README.md',
      'src/routes/calc_route.js',
    ],
    testMentions: "import { calcRoute } from '../src/routes/calc_route.js';",
  });
  assert.equal(cov.pass, true, `expected pass, got uncovered: ${JSON.stringify(cov.uncovered)}`);
  assert.deepEqual(cov.scanned.files, ['src/routes/calc_route.js']);

  // Decoupled gitDiff: git: null (gitCommit === false) in a git repo still tracks dirty changes via git status -z
  const wave = parseWaves(fs.readFileSync(path.join(dir, 'IMPLEMENTATION-PLAN.md'), 'utf8'))[0];
  const res = await runWave({
    projectDir: dir,
    testCommand: 'node --test test/calc.test.mjs',
    wave,
    totalWaves: 1,
    planPath: path.join(dir, 'IMPLEMENTATION-PLAN.md'),
    git: null, // gitCommit === false
    reviewerCount: 1,
    fixIterCap: 2,
    driver: {
      async execute() {
        fs.writeFileSync(path.join(dir, 'src', 'calc.js'), 'export function add(a, b) {\n  return a + b;\n}\n', 'utf8');
        return { note: 'repaired calc' };
      },
      async review(ctx) {
        assert.ok(ctx.changed.includes('src/calc.js'));
        assert.match(ctx.diffPatch || '', /\+  return a \+ b;/);
        return { reviewer: 'r0', answerable: 'yes', findings: [] };
      },
      async elegance() {
        return { verdicts: [], keeps: [], markdown: '' };
      },
      async fix() {
        return { note: 'noop' };
      },
    },
  });
  assert.equal(res.status, 'GO', res.haltReason);
  assert.ok(res.changedFiles.includes('src/calc.js'));
});

test('3. Pre-execute Anvil slice, Post-gate deterministic fast-gates (Tidy-Idy, Aegis CWE-78, Anvil AST) BEFORE review, and diff-scoped reviewPrompt', async (t) => {
  // 3a. Pre-execute Anvil slice (< 15 KB) + diff-scoped reviewPrompt + heartbeat isolation + Gandalf stallbreaker
  const sliceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w3-slice-'));
  t.after(() => fs.rmSync(sliceDir, { recursive: true, force: true }));
  writeBasicNodeProject(sliceDir, '## Wave 1: Fix add\nWrites: src/calc.js\nAcceptance: `add(2, 3)` returns `5`.');
  initGitRepo(sliceDir);

  const slice = buildAnvilSlice(sliceDir, ['src/calc.js']);
  assert.ok(slice.length > 0 && Buffer.byteLength(slice, 'utf8') < 15 * 1024);
  assert.match(slice, /calc\.js/);

  fs.writeFileSync(path.join(sliceDir, 'src', 'calc.js'), 'export function add(a, b) {\n  return a + b;\n}\n', 'utf8');
  const diffPatch = buildBoundedGitDiff(sliceDir, ['src/calc.js']);
  assert.ok(Buffer.byteLength(diffPatch, 'utf8') <= 60 * 1024);
  assert.match(diffPatch, /\+  return a \+ b;/);

  const rPrompt = wfInternals.reviewPrompt({
    projectDir: sliceDir,
    foremanDir: path.join(sliceDir, '.foreman'),
    wave: { n: 1, title: 'Fix add' },
    reviewerIndex: 0,
    changed: ['src/calc.js'],
    planPath: path.join(sliceDir, 'IMPLEMENTATION-PLAN.md'),
    planText: fs.readFileSync(path.join(sliceDir, 'IMPLEMENTATION-PLAN.md'), 'utf8'),
    diffPatch,
  }, { artifact_path: 'gate.json', exit_code: 0, tap: { pass: 1, tests: 1 } });

  assert.match(rPrompt, /BEGIN WAVE 1 ACCEPTANCE CONTRACT/);
  assert.match(rPrompt, /BEGIN BOUNDED WAVE DIFF/);
  assert.doesNotMatch(rPrompt, /seat-heartbeat/, 'read-only reviewPrompt must NEVER mandate writing seat-heartbeat.json');

  const ePrompt = wfInternals.executePrompt({
    projectDir: sliceDir,
    foremanDir: path.join(sliceDir, '.foreman'),
    wave: { n: 1, title: 'Fix add', writes: ['src/calc.js'] },
    testCommand: 'node --test test/calc.test.mjs',
    anvilSlice: slice,
  });
  assert.match(ePrompt, /ANVIL AST SLICE|PRE-COMPUTED AST|calc\.js/i);
  assert.match(ePrompt, /seat-heartbeat-execute-/);

  const fPrompt = wfInternals.fixPrompt({
    projectDir: sliceDir,
    foremanDir: path.join(sliceDir, '.foreman'),
    wave: { n: 1 },
    iteration: 2,
    repeatedFailureHint: 'test/calc.test.mjs failed twice on assertion add(2,3)===5',
  }, { artifact_path: 'gate.json' }, []);
  assert.match(fPrompt, /GANDALF|STALLBREAKER|ROOT-CAUSE/i);

  // 3b. Tidy-Idy scratch file (.provider-schema-leak.json) & Aegis CWE-78 (shell=True) fire BEFORE driver.review!
  const pyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w3-fastgates-py-'));
  t.after(() => fs.rmSync(pyDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(pyDir, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(pyDir, 'DESCRIPTION.md'), '# Py Security Fixture\n', 'utf8');
  fs.writeFileSync(path.join(pyDir, 'EXECUTION-LOG.md'), '# Execution Log\n', 'utf8');
  fs.writeFileSync(
    path.join(pyDir, 'IMPLEMENTATION-PLAN.md'),
    '# Plan\n\ntest-command: python -m pytest -q\n\n## Wave 1: Safe runner\nWrites: runner.py\nImplement `echo_word(word)` safely without shell injection.\n',
    'utf8',
  );
  fs.writeFileSync(path.join(pyDir, 'runner.py'), 'def echo_word(word: str) -> str:\n    return ""\n', 'utf8');
  fs.writeFileSync(
    path.join(pyDir, 'tests', 'test_runner.py'),
    'from runner import echo_word\n\ndef test_echo_word():\n    assert echo_word("hello") == "hello"\n',
    'utf8',
  );
  initGitRepo(pyDir);

  let pyReviewCalls = 0;
  let pyFixCalls = 0;
  let capturedFindings = [];
  const pyWave = parseWaves(fs.readFileSync(path.join(pyDir, 'IMPLEMENTATION-PLAN.md'), 'utf8'))[0];

  const pyRes = await runWave({
    projectDir: pyDir,
    testCommand: 'python -m pytest -q',
    wave: pyWave,
    totalWaves: 1,
    planPath: path.join(pyDir, 'IMPLEMENTATION-PLAN.md'),
    reviewerCount: 1,
    fixIterCap: 3,
    driver: {
      async execute() {
        // Passes pytest, BUT leaves a .provider-schema-* scratch file AND introduces CWE-78 shell=True!
        fs.writeFileSync(
          path.join(pyDir, 'runner.py'),
          'import subprocess\n\ndef echo_word(word: str) -> str:\n    subprocess.run(f"echo {word}", shell=True, check=False)\n    return word\n',
          'utf8',
        );
        fs.writeFileSync(path.join(pyDir, '.provider-schema-leak.json'), '{}', 'utf8');
        return { note: 'implemented with scratch leak and shell=True' };
      },
      async review() {
        pyReviewCalls += 1;
        return { reviewer: 'r0', answerable: 'yes', findings: [] };
      },
      async elegance() {
        return { verdicts: [], keeps: [], markdown: '' };
      },
      async fix(_ctx, _gate, findings) {
        pyFixCalls += 1;
        capturedFindings = findings;
        fs.rmSync(path.join(pyDir, '.provider-schema-leak.json'), { force: true });
        fs.writeFileSync(
          path.join(pyDir, 'runner.py'),
          'def echo_word(word: str) -> str:\n    return word.strip()\n',
          'utf8',
        );
        return { note: 'cleaned scratch file and removed shell=True' };
      },
    },
  });

  assert.equal(pyRes.status, 'GO', pyRes.haltReason);
  assert.equal(pyFixCalls, 1, 'fast-gates triggered fix BEFORE any LLM review');
  assert.equal(pyReviewCalls, 1, 'LLM review ran ONLY after deterministic fast-gates turned green');
  assert.ok(capturedFindings.some((f) => f.rule === 'tidy-idy-hygiene'), 'Tidy-Idy caught .provider-schema-leak.json');
  assert.ok(capturedFindings.some((f) => String(f.rule).startsWith('aegis-')), 'Aegis caught CWE-78 shell=True');

  // Direct unit check on Anvil AST gate catching broken JS syntax
  const badJs = path.join(sliceDir, 'src', 'broken.mjs');
  fs.writeFileSync(badJs, 'export function broken( {\n', 'utf8');
  const astCheck = runFastAnvilAstGate(sliceDir, ['src/broken.mjs']);
  assert.equal(astCheck.pass, false);
  assert.equal(astCheck.findings[0].rule, 'anvil-syntax');
});

test('4. W.1..W.k Disjoint-Write-Set Parallel Sub-Wave DAG: locate-plan, overlap HALT, scope-breach HALT, and parallel git worktree execution + merge', async (t) => {
  // 4a. Overlapping concurrent sibling write-sets throw HaltError([taxonomy:overlapping-subwave-writes])
  assert.equal(pathsOverlap('src/a/x.js', 'src/b/x.js'), false);
  assert.equal(pathsOverlap('src/a/x.js', 'src/**'), true);

  const overlappingPlan = [
    '# Plan',
    '## Wave 1: Parallel collision',
    '### Wave 1.1: Seat A',
    'Writes: src/shared/util.js',
    '### Wave 1.2: Seat B',
    'Writes: src/shared/**',
  ].join('\n');
  assert.throws(
    () => parseWaves(overlappingPlan),
    (err) => err instanceof HaltError && /\[taxonomy:overlapping-subwave-writes\]/.test(err.reason),
  );

  // 4b. Valid DAG with parallel 1.1 + 1.2 and dependent 1.3 (`Depends-On: 1.1, 1.2`)
  const dagDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w3-subwave-dag-'));
  t.after(() => fs.rmSync(dagDir, { recursive: true, force: true }));

  fs.mkdirSync(path.join(dagDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dagDir, 'test'), { recursive: true });
  fs.writeFileSync(path.join(dagDir, 'DESCRIPTION.md'), '# Subwave DAG Project\n', 'utf8');
  fs.writeFileSync(path.join(dagDir, 'EXECUTION-LOG.md'), '# Execution Log\n', 'utf8');
  const dagPlan = [
    '# Implementation Plan',
    '',
    'test-command: node --test test/combined.test.mjs',
    '',
    '## Wave 1: Build modular arithmetic & aggregator',
    '### Wave 1.1: Add module',
    'Writes: src/add.js',
    'Implement `add(a, b)`.',
    '',
    '### Wave 1.2: Multiply module',
    'Writes: src/mul.js',
    'Implement `mul(a, b)`.',
    '',
    '### Wave 1.3: Combined barrel',
    'Writes: src/combined.js',
    'Depends-On: 1.1, 1.2',
    'Import `add` and `mul` to implement `fma(a, b, c) = add(mul(a, b), c)`.',
  ].join('\n');
  fs.writeFileSync(path.join(dagDir, 'IMPLEMENTATION-PLAN.md'), dagPlan, 'utf8');
  fs.writeFileSync(path.join(dagDir, 'src', 'add.js'), 'export const add = () => 0;\n', 'utf8');
  fs.writeFileSync(path.join(dagDir, 'src', 'mul.js'), 'export const mul = () => 0;\n', 'utf8');
  fs.writeFileSync(path.join(dagDir, 'src', 'combined.js'), 'export const fma = () => 0;\n', 'utf8');
  fs.writeFileSync(
    path.join(dagDir, 'test', 'combined.test.mjs'),
    [
      "import test from 'node:test';",
      "import assert from 'node:assert/strict';",
      "import { add } from '../src/add.js';",
      "import { mul } from '../src/mul.js';",
      "import { fma } from '../src/combined.js';",
      "test('add, mul, and fma work together', () => {",
      '  assert.equal(add(2, 3), 5);',
      '  assert.equal(mul(4, 5), 20);',
      '  assert.equal(fma(4, 5, 6), 26);',
      '});',
    ].join('\n'),
    'utf8',
  );
  initGitRepo(dagDir);

  // Verify locate-plan.mjs --json exposes subwaves & subwave_batches
  const loc = spawnSync(process.execPath, [LOCATE_PLAN, dagDir, '--json'], {
    encoding: 'utf8', windowsHide: true, shell: false,
  });
  assert.equal(loc.status, 0, loc.stderr);
  const locJson = JSON.parse(loc.stdout);
  assert.deepEqual(locJson.waves[0].subwave_batches, [['1.1', '1.2'], ['1.3']]);

  // Execute via runProject and prove 1.1 & 1.2 run concurrently in isolated git worktrees,
  // merge cleanly, then 1.3 sees 1.1 + 1.2's merged code, followed by ONE parent gate + review!
  let activeConcurrent = 0;
  let maxObservedConcurrency = 0;
  const seenWorktrees = new Map();
  let reviewCount = 0;

  const projRes = await runProject({
    projectDir: dagDir,
    reviewerCount: 1,
    fixIterCap: 2,
    subwaveConcurrency: 3,
    driver: {
      async execute(ctx) {
        const swId = ctx.subwave?.id;
        assert.ok(swId, 'subwave context must be passed');
        assert.notEqual(path.resolve(ctx.projectDir), path.resolve(dagDir), 'subwave must run in isolated worktree');
        seenWorktrees.set(swId, ctx.projectDir);
        activeConcurrent += 1;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, activeConcurrent);
        await new Promise((r) => setTimeout(r, 60));
        activeConcurrent -= 1;

        if (swId === '1.1') {
          fs.writeFileSync(path.join(ctx.projectDir, 'src', 'add.js'), 'export const add = (a, b) => a + b;\n', 'utf8');
        } else if (swId === '1.2') {
          fs.writeFileSync(path.join(ctx.projectDir, 'src', 'mul.js'), 'export const mul = (a, b) => a * b;\n', 'utf8');
        } else if (swId === '1.3') {
          // 1.3 depends on 1.1 and 1.2 — verify both merged files are already present in 1.3's worktree!
          assert.match(fs.readFileSync(path.join(ctx.projectDir, 'src', 'add.js'), 'utf8'), /a \+ b/);
          assert.match(fs.readFileSync(path.join(ctx.projectDir, 'src', 'mul.js'), 'utf8'), /a \* b/);
          fs.writeFileSync(
            path.join(ctx.projectDir, 'src', 'combined.js'),
            "import { add } from './add.js';\nimport { mul } from './mul.js';\nexport const fma = (a, b, c) => add(mul(a, b), c);\n",
            'utf8',
          );
        }
        return { note: `done ${swId}` };
      },
      async review(ctx) {
        reviewCount += 1;
        assert.deepEqual(
          ctx.changed.filter((f) => f.startsWith('src/')).sort(),
          ['src/add.js', 'src/combined.js', 'src/mul.js'],
        );
        return { reviewer: 'r0', answerable: 'yes', findings: [] };
      },
      async elegance() {
        return { verdicts: [], keeps: [], markdown: '' };
      },
      async fix() {
        return { note: 'noop' };
      },
    },
  });

  assert.equal(projRes.status, 'DONE', projRes.haltReason);
  assert.equal(maxObservedConcurrency, 2, '1.1 and 1.2 executed concurrently');
  assert.notEqual(seenWorktrees.get('1.1'), seenWorktrees.get('1.2'));
  assert.equal(reviewCount, 1, 'exactly ONE combined parent-wave review ran after sub-wave merge');

  // Verify temporary git worktrees were pruned cleanly
  const wtList = spawnSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: dagDir, encoding: 'utf8', windowsHide: true, shell: false,
  });
  const worktreeCount = wtList.stdout.split(/\r?\n/).filter((l) => l.startsWith('worktree ')).length;
  assert.equal(worktreeCount, 1, 'all temporary sub-wave worktrees must be removed and pruned');

  // 4c. Runtime Writes scope breach halts deterministically without mutating parent workspace
  const breachDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w3-subwave-breach-'));
  t.after(() => fs.rmSync(breachDir, { recursive: true, force: true }));
  writeBasicNodeProject(
    breachDir,
    '## Wave 1: Scoped subwave\n### Wave 1.1: Only calc\nWrites: src/calc.js\nEdit only `src/calc.js`.',
  );
  fs.writeFileSync(path.join(breachDir, 'src', 'forbidden.js'), 'export const x = 1;\n', 'utf8');
  initGitRepo(breachDir);

  const breachRes = await runProject({
    projectDir: breachDir,
    reviewerCount: 1,
    fixIterCap: 2,
    driver: {
      async execute(ctx) {
        fs.writeFileSync(path.join(ctx.projectDir, 'src', 'forbidden.js'), 'export const x = 999;\n', 'utf8');
        return { note: 'touched forbidden file' };
      },
      async review() { return { reviewer: 'r0', answerable: 'yes', findings: [] }; },
      async elegance() { return { verdicts: [], keeps: [], markdown: '' }; },
      async fix() { return { note: 'noop' }; },
    },
  });
  assert.equal(breachRes.status, 'HALT');
  assert.match(breachRes.haltReason || '', /\[taxonomy:subwave-scope-breach\]/);
  assert.equal(
    fs.readFileSync(path.join(breachDir, 'src', 'forbidden.js'), 'utf8'),
    'export const x = 1;\n',
    'scope-breaching sub-wave must never merge into parent workspace',
  );
});

test('5. 4-CLI preflightCliAuth, unified onReceipt telemetry + phase-report cost/wall accounting, and attested_review manifest', (t) => {
  // 5a. preflightCliAuth catches expired coding auth AND supports 3rd-family verification failover
  const expiredCoding = preflightCliAuth({
    codingFamily: 'claude',
    reviewFamily: 'gemini',
    executables: { claude: 'claude', gemini: 'agy' },
    spawnSyncImpl: (cmd) => (
      cmd === 'claude'
        ? { status: 1, stdout: '{"loggedIn":false}', stderr: '' }
        : { status: 0, stdout: 'gemini-3.1-pro-high', stderr: '' }
    ),
  });
  assert.equal(expiredCoding.ok, false);
  assert.equal(expiredCoding.taxonomy, 'auth-expired');

  const failoverReview = preflightCliAuth({
    codingFamily: 'gemini',
    reviewFamily: 'claude',
    executables: { gemini: 'agy', claude: 'claude', chatgpt: 'codex', grok: 'grok' },
    spawnSyncImpl: (cmd) => {
      if (cmd === 'agy') return { status: 0, stdout: 'gemini-3.1-pro-high', stderr: '' };
      if (cmd === 'claude') return { status: 1, stdout: '{"loggedIn":false}', stderr: 'OAuth session expired' };
      if (cmd === 'codex') return { status: 0, stdout: 'Logged in using ChatGPT', stderr: '' };
      return { status: 1, stdout: '', stderr: 'not logged in' };
    },
  });
  assert.equal(failoverReview.ok, true);
  assert.equal(failoverReview.status, 'failover_ready');
  assert.equal(failoverReview.failoverReviewFamily, 'chatgpt');

  // 5b. normalizeReceiptTelemetry + phase-report cost & duration accounting (no 0.0s / $0.00)
  const execRec = normalizeReceiptTelemetry({
    label: 'execute:w1.1',
    role: 'execute',
    wallDurationMs: 4200,
    codingFamily: 'chatgpt',
    physicalEntries: [{
      kind: 'initial',
      outcome: 'accepted',
      receipt: {
        ok: true,
        usage: { input_tokens: 10000, output_tokens: 2000 },
        duration_ms: null, // subscription CLI omitted duration_ms -> falls back to wallDurationMs
        cost_usd: null, // subscription CLI omitted cost_usd -> estimates equiv USD
        tools: 4,
      },
    }],
    seatReceipt: {
      ok: true,
      served: { family: 'chatgpt', family_attested: true, model: 'gpt-5.4', model_attested: true },
      requested: { driver: 'chatgpt-cli', family: 'chatgpt' },
      failover: { used: false },
    },
  });
  assert.equal(execRec.duration_ms, 4200);
  assert.ok(execRec.cost_usd > 0);
  assert.equal(execRec.cross_model, false);

  const revRec = normalizeReceiptTelemetry({
    label: 'review:w1#0',
    role: 'review',
    wallDurationMs: 1800,
    codingFamily: 'chatgpt',
    physicalEntries: [{
      kind: 'initial',
      outcome: 'accepted',
      receipt: {
        ok: true,
        usage: { input_tokens: 4000, output_tokens: 500 },
        duration_ms: 1750,
        cost_usd: 0.021,
        tools: 1,
      },
    }],
    seatReceipt: {
      ok: true,
      served: { family: 'claude', family_attested: true, model: 'claude-opus-4-6', model_attested: true },
      requested: { driver: 'claude', family: 'claude' },
      failover: { used: false },
    },
  });
  assert.equal(revRec.cross_model, true);

  const jsonl = [
    JSON.stringify({ kind: 'call', ...execRec }),
    JSON.stringify({ kind: 'call', ...revRec }),
  ].join('\n');
  const agg = aggregate(parseJsonl(jsonl));
  assert.equal(agg.byPhase.execute.ms, 4200);
  assert.equal(agg.byPhase.review.ms, 1750);
  assert.ok(agg.totalCostUsd > 0.05);
  assert.match(renderReport(agg), /est cost=\$0\./);

  // 5c. buildAttestedRunManifest computes exact SHA-256 changed_files + cross-family attested_review
  const mDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w3-manifest-'));
  t.after(() => fs.rmSync(mDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(mDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(mDir, 'src', 'app.py'), 'VALUE = 42\n', 'utf8');
  initGitRepo(mDir);
  fs.writeFileSync(path.join(mDir, 'src', 'app.py'), 'VALUE = 99\n', 'utf8');
  const expectedSha = crypto.createHash('sha256').update('VALUE = 99\n').digest('hex');

  const manifest = buildAttestedRunManifest({
    projectDir: mDir,
    foremanDir: path.join(mDir, '.foreman'),
    result: {
      status: 'DONE',
      waveResults: [{
        wave: 1,
        status: 'GO',
        changedFiles: ['src/app.py'],
        reviewSummary: { completedReviewers: 1, blockingFindings: 0 },
      }],
    },
    calls: [execRec, revRec],
    codingFamily: 'chatgpt',
  });
  assert.equal(manifest.changed_files['src/app.py'], expectedSha);
  assert.equal(manifest.attested_review.go, true);
  assert.equal(manifest.attested_review.cross_model, true);
  assert.equal(manifest.attested_review.family, 'claude');
});
