// S3 + S5 of the slim plan (2026-10-10), corrected after the final review of 10-10 (findings 1, 2, 4, 6): a wave that
// makes no code is proven by its declared outputs - files THIS wave created or changed, inside the project - never by a
// label; a non-code label over executable changes keeps the code gates (or halts naming the missing test command); an
// artifact-only plan starts through the production contract without a fictitious test command; an acceptance item's
// (oracle: test/...) is a REQUIRED test, enforced before any coverage is advisory. Real engine, real gate, scripted seats.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseWaves, parseWaveOracles, isNonCodeWave, discoverGateCommand, HaltError } from '../bin/foreman-lib.mjs';
import { runWave, outputsGate, requiredWaveTestPaths, executableChanges } from '../bin/wave-engine.mjs';
import { resolveContract, runProject } from '../bin/project-engine.mjs';
import { makeScriptedDriver } from '../bin/drivers/scripted-driver.mjs';
import { _internals as workflow } from '../bin/wave-workflow.js';

function tmp(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function write(dir, rel, content) {
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}
async function withProfile(profile, fn) {
  const was = process.env.FOREMAN_PROFILE;
  if (profile) process.env.FOREMAN_PROFILE = profile; else delete process.env.FOREMAN_PROFILE;
  try { return await fn(); } finally { if (was === undefined) delete process.env.FOREMAN_PROFILE; else process.env.FOREMAN_PROFILE = was; }
}
const GATE = 'node --test test/*.test.mjs';
const CALC_SRC = 'export const add = (a, b) => a + b;\n';
const CALC_TEST = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../src/calc.mjs';\ntest('adds', () => assert.equal(add(2, 3), 5));\n";

test('parseWaves carries each wave\'s kind, outputs, acceptance text and (oracle: ...) items - one representation for every consumer', () => {
  const plan = [
    '## Wave 1 — Renders', 'kind: render', 'outputs: `out/fig1.png`, "out/fig 2.png", out/fig3.png', 'Done when:', '- three figures render (oracle: the three files exist)', '',
    '## Wave 2 — Code', 'outputs: src/a.mjs', 'Done when:', '- adds two numbers (oracle: test/calc.test.mjs)',
    '- writes are atomic via temp + fsync + rename (oracle: test/atomic.test.mjs)', '```', '## Wave 9 — fenced', 'kind: docs', 'Test file test/fenced.test.mjs', '```', '',
    '## Wave 3 — Docs', 'kind: docs', '',
  ].join('\n');
  const w = parseWaves(plan);
  assert.equal(w[0].waveKind, 'render');
  assert.deepEqual(w[0].outputs, ['out/fig1.png', 'out/fig 2.png', 'out/fig3.png']);
  assert.equal(isNonCodeWave(w[0]), true);
  assert.equal(isNonCodeWave(w[1]), false, 'outputs without a non-code kind: a code wave');
  assert.equal(isNonCodeWave(w[2]), false, 'a non-code kind with nothing declared proves nothing');
  assert.match(w[1].acceptance, /atomic via temp \+ fsync \+ rename/);
  assert.doesNotMatch(w[1].acceptance, /Wave 9/, 'fenced examples are not acceptance');
  assert.equal(w[1].waveKind, undefined, 'a fenced kind: line is not a declaration');
  assert.deepEqual(w[1].oracles.map((o) => o.oracle), ['test/calc.test.mjs', 'test/atomic.test.mjs']);
  assert.equal(w[1].oracles[0].item, 'adds two numbers');
  assert.deepEqual(w[0].oracles, [{ item: 'three figures render', oracle: 'the three files exist' }]);
  assert.deepEqual(parseWaveOracles('- x (oracle: node a.mjs (prints 5))'), [{ item: 'x', oracle: 'node a.mjs (prints 5)' }]);
  assert.deepEqual(requiredWaveTestPaths(plan, 2), ['test/calc.test.mjs', 'test/atomic.test.mjs'], 'the fenced Test file line never counts');
});

test('the outputs gate passes only files this wave created or changed, inside the project - never ".", a folder, an escape, an empty or an untouched file', (t) => {
  const dir = tmp(t, 'foreman-s3-');
  write(dir, 'out/a.png', 'png');
  write(dir, 'out/old.png', 'old');
  write(dir, 'out/empty.png', '');
  fs.mkdirSync(path.join(dir, 'out', 'sub'));
  const foremanDir = path.join(dir, '.foreman');
  const wave = { n: 1, waveKind: 'render', outputs: ['out/a.png', 'out/old.png', 'out/empty.png', 'out/gone.png', '../escape.txt', '.', 'out', 'out/sub/../a.png', path.join(dir, 'out', 'a.png')] };
  const g = outputsGate({ projectDir: dir, foremanDir, wave, iteration: 0, changed: ['out/a.png', 'out/empty.png'] });
  assert.equal(g.green, false);
  assert.deepEqual(g.outputs.map((r) => r.state),
    ['present', 'unchanged this wave', 'empty file', 'missing', 'outside the project', 'not a file path', 'a folder, not a file', 'outside the project', 'outside the project']);
  assert.equal(g.tap.pass, 1);
  assert.equal(g.tap.tests, 9);
  assert.equal(g.written_by, 'orchestrator');
  assert.ok(fs.existsSync(g.artifact_path));
  assert.match(g.command, /declared outputs \(render wave/);
  const ok = outputsGate({ projectDir: dir, foremanDir, wave: { ...wave, outputs: ['out/a.png'] }, iteration: 0, changed: ['out/a.png'] });
  assert.equal(ok.green, true);
  // the outputs' own wave-start snapshot proves a change the generic diff cannot see (docs/ is an ignored folder)
  const snapped = outputsGate({ projectDir: dir, foremanDir, wave: { ...wave, outputs: ['out/old.png'] }, iteration: 0, changed: [], before: { 'out/old.png': 'some-other-hash' } });
  assert.equal(snapped.green, true);
  const same = outputsGate({ projectDir: dir, foremanDir, wave: { ...wave, outputs: ['out/old.png'] }, iteration: 0, changed: [], before: { 'out/old.png': null }, artifact: 'outputs' });
  assert.equal(same.green, true, 'absent at wave start, present now: created by this wave');
  assert.match(same.artifact_path, /wave-1-outputs\.json$/);
  assert.equal(outputsGate({ projectDir: dir, foremanDir, wave: { ...wave, outputs: [] }, iteration: 0, changed: ['out/a.png'] }).green, false, 'nothing declared proves nothing');
});

test('production startup: an artifact-only plan resolves its contract with NO test command, and its docs wave GOes on outputs it produced', async (t) => {
  const dir = tmp(t, 'foreman-s3w-');
  write(dir, 'DESCRIPTION.md', '# Guide project\n');
  write(dir, 'EXECUTION-LOG.md', '# Log\n');
  write(dir, 'IMPLEMENTATION-PLAN.md', '# Plan\n\n## Wave 1 — Guide\nkind: docs\noutputs: `docs/GUIDE.md`\nDone when:\n- the guide has a Usage section (oracle: docs/GUIDE.md contains "## Usage")\n');
  const c = resolveContract(dir);
  assert.equal(c.testCmd.command, null);
  assert.match(c.testCmd.source, /every wave is a non-code wave/);
  const driver = makeScriptedDriver({ onExecute: async () => write(dir, 'docs/GUIDE.md', '# Guide\n## Usage\nhow to use it\n'), reviewerFindings: [] });
  const r = await runProject({ projectDir: dir, driver, reviewerCount: 1, fixIterCap: 1 });
  assert.equal(r.status, 'DONE', JSON.stringify(r.waveResults));
  const gate = JSON.parse(fs.readFileSync(path.join(dir, '.foreman', 'wave-1-gate.json'), 'utf8'));
  assert.equal(gate.green, true);
  assert.match(gate.command, /declared outputs/);
  assert.deepEqual(gate.outputs, [{ output: 'docs/GUIDE.md', state: 'present' }]);
  assert.match(fs.readFileSync(path.join(dir, 'EXECUTION-LOG.md'), 'utf8'), /Wave 1\/1 GREEN[^\n]*outputs 1 pass 1 fail 0/);
});

test('a mixed plan still needs its ground-truth command: resolveContract halts as before; discoverGateCommand exempts only all-non-code plans', (t) => {
  const dir = tmp(t, 'foreman-s3m-');
  write(dir, 'DESCRIPTION.md', '# d\n');
  write(dir, 'EXECUTION-LOG.md', '# l\n');
  const planText = '## Wave 1 — Guide\nkind: docs\noutputs: docs/GUIDE.md\n\n## Wave 2 — Code\nDone when:\n- adds (oracle: test/calc.test.mjs)\n';
  write(dir, 'IMPLEMENTATION-PLAN.md', planText);
  assert.throws(() => resolveContract(dir), (e) => e instanceof HaltError && /no ground-truth test command/.test(e.reason));
  const waves = parseWaves(planText);
  assert.throws(() => discoverGateCommand(planText, dir, waves), HaltError);
  assert.equal(discoverGateCommand(planText, dir, [waves[0]]).command, null);
  assert.equal(discoverGateCommand('test-command: node --test\n' + planText, dir, [waves[0]]).command, 'node --test', 'a declared command is always used');
});

test('a docs label does not bypass the code gate: a "docs" wave that changed source runs the test command and fails its failing suite', async (t) => {
  const dir = tmp(t, 'foreman-s3b-');
  write(dir, 'README.md', '# old\n');
  write(dir, 'src/calc.mjs', CALC_SRC);
  write(dir, 'test/calc.test.mjs', CALC_TEST);
  const planPath = write(dir, 'IMPLEMENTATION-PLAN.md', `test-command: ${GATE}\n\n## Wave 1 — Docs\nkind: docs\noutputs: README.md\nDone when:\n- the readme names add (oracle: README.md mentions add)\n`);
  const wave = parseWaves(fs.readFileSync(planPath, 'utf8'))[0];
  assert.equal(isNonCodeWave(wave), true, 'declared non-code');
  const driver = makeScriptedDriver({ onExecute: async () => {
    write(dir, 'README.md', '# add\n');
    write(dir, 'src/calc.mjs', 'export const add = (a, b) => a - b;\n');   // the planted "docs" wave edits source
  }, reviewerFindings: [] });
  const r = await runWave({ projectDir: dir, testCommand: GATE, wave, totalWaves: 1, planPath, driver, reviewerCount: 1, fixIterCap: 0 });
  assert.notEqual(r.status, 'GO');
  assert.equal(r.gate.command, GATE, 'the ordinary test gate ran, not the outputs gate');
  assert.equal(r.gate.green, false);
});

test('a docs wave that changed executable files with NO test command halts naming the missing command - never GO on its outputs', async (t) => {
  const dir = tmp(t, 'foreman-s3c-');
  write(dir, 'README.md', '# old\n');
  const planPath = write(dir, 'IMPLEMENTATION-PLAN.md', '## Wave 1 — Docs\nkind: docs\noutputs: README.md\n');
  const wave = parseWaves(fs.readFileSync(planPath, 'utf8'))[0];
  const driver = makeScriptedDriver({ onExecute: async () => {
    write(dir, 'README.md', '# new\n');
    write(dir, '.github/workflows/ci.yml', 'on: push\n');
  } });
  const r = await runWave({ projectDir: dir, testCommand: null, wave, totalWaves: 1, planPath, driver, reviewerCount: 1, fixIterCap: 1 });
  assert.equal(r.status, 'HALT');
  assert.match(r.haltReason, /\[taxonomy:missing-test-command\][^\n]*\.github\/workflows\/ci\.yml/);
  assert.equal(r.gate, null, 'no gate of any kind ran');
});

test('an existing, untouched output proves nothing: a docs wave whose execute leaves the declared file as it was does not pass', async (t) => {
  const dir = tmp(t, 'foreman-s3x-');
  write(dir, 'README.md', '# already here\n');
  const planPath = write(dir, 'IMPLEMENTATION-PLAN.md', '## Wave 1 — Docs\nkind: docs\noutputs: README.md\n');
  const wave = parseWaves(fs.readFileSync(planPath, 'utf8'))[0];
  // (a) execute touches something else: the outputs gate is RED on "unchanged this wave"
  const r1 = await runWave({ projectDir: dir, testCommand: null, wave, totalWaves: 1, planPath,
    driver: makeScriptedDriver({ onExecute: async () => write(dir, 'notes.txt', 'x') }), reviewerCount: 1, fixIterCap: 0 });
  assert.notEqual(r1.status, 'GO');
  assert.deepEqual(r1.gate.outputs, [{ output: 'README.md', state: 'unchanged this wave' }]);
  // (b) execute changes nothing at all: wave-not-implemented, before any gate
  fs.rmSync(path.join(dir, 'notes.txt'));
  fs.rmSync(path.join(dir, '.foreman'), { recursive: true, force: true });
  fs.rmSync(path.join(dir, 'foreman-checkpoint.json'), { force: true });
  const r2 = await runWave({ projectDir: dir, testCommand: null, wave, totalWaves: 1, planPath, driver: makeScriptedDriver({}), reviewerCount: 1, fixIterCap: 0 });
  assert.equal(r2.status, 'HALT');
  assert.match(r2.haltReason, /\[taxonomy:wave-not-implemented\][^\n]*declared outputs/);
});

test('S5: (oracle: test/...) names a REQUIRED test - a slim wave that adds untested code and omits it halts before any coverage is advisory', async (t) => {
  const dir = tmp(t, 'foreman-s5-');
  write(dir, 'src/calc.mjs', CALC_SRC);
  write(dir, 'test/calc.test.mjs', CALC_TEST);
  const planPath = write(dir, 'IMPLEMENTATION-PLAN.md', `test-command: ${GATE}\n\n## Wave 1 — Registry\nDone when:\n- a registry keeps entries (oracle: test/registry.test.mjs)\n- add still adds (oracle: test/calc.test.mjs)\n- the CLI prints usage (oracle: node src/cli.mjs --help prints usage)\n`);
  const planText = fs.readFileSync(planPath, 'utf8');
  assert.deepEqual(requiredWaveTestPaths(planText, 1), ['test/registry.test.mjs', 'test/calc.test.mjs']);
  const wave = parseWaves(planText)[0];
  assert.deepEqual(wave.oracles.map((o) => o.oracle), ['test/registry.test.mjs', 'test/calc.test.mjs', 'node src/cli.mjs --help prints usage']);
  const driver = makeScriptedDriver({ onExecute: async () => {
    write(dir, 'src/registry.mjs', 'export const registry = new Map();\n');
    write(dir, 'src/calc.mjs', 'export const add = (a, b) => b + a;\n');
  }, reviewerFindings: [] });
  const r = await withProfile('slim', () => runWave({ projectDir: dir, testCommand: GATE, wave, totalWaves: 1, planPath, driver, reviewerCount: 1, fixIterCap: 2 }));
  assert.equal(r.status, 'HALT');
  assert.match(r.haltReason, /\[taxonomy:wave-not-implemented\] HALT: wave 1 is missing required test file\(s\): test\/registry\.test\.mjs/);
  assert.equal(r.gate, null, 'halted before the gate: the required test, not the suite, was the missing proof');
});

test('S5: with the oracle test present, coverage BEYOND the plan\'s oracles is advisory in slim (recorded, traced) while standard still halts', async (t) => {
  const make = () => {
    const dir = tmp(t, 'foreman-s5b-');
    write(dir, 'src/calc.mjs', CALC_SRC);
    write(dir, 'test/calc.test.mjs', CALC_TEST);
    const planPath = write(dir, 'IMPLEMENTATION-PLAN.md', `test-command: ${GATE}\n\n## Wave 1 — Registry\nDone when:\n- a registry keeps entries (oracle: test/registry.test.mjs)\n`);
    const driver = makeScriptedDriver({ onExecute: async () => {
      write(dir, 'src/registry.mjs', 'export const registry = new Map();\nexport const put = (k, v) => registry.set(k, v);\n');
      write(dir, 'test/registry.test.mjs', "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { put, registry } from '../src/registry.mjs';\ntest('keeps entries', () => { put('a', 1); assert.equal(registry.get('a'), 1); });\n");
      write(dir, 'src/ledger.mjs', 'export const ledger = [];\n');   // a persistence surface no test names
    }, reviewerFindings: [] });
    return { dir, planPath, wave: parseWaves(fs.readFileSync(planPath, 'utf8'))[0], driver };
  };
  const a = make();
  const slim = await withProfile('slim', () => runWave({ projectDir: a.dir, testCommand: GATE, wave: a.wave, totalWaves: 1, planPath: a.planPath, driver: a.driver, reviewerCount: 1, fixIterCap: 2 }));
  assert.equal(slim.status, 'GO', slim.haltReason);
  assert.match(slim.dashboard, /delta-coverage \(advisory, slim: required oracle tests enforced/);
  assert.match(slim.dashboard, /oracles: 1\/1 acceptance item\(s\) name a test file \(all present\)/);
  const rec = JSON.parse(fs.readFileSync(path.join(a.dir, '.foreman', 'wave-1-delta-coverage.json'), 'utf8'));
  assert.deepEqual(rec.oracle_map.oracles[0].tests, ['test/registry.test.mjs']);
  assert.equal(rec.oracle_map.oracles[0].present, true);
  assert.deepEqual(rec.oracle_map.required, ['test/registry.test.mjs']);
  assert.deepEqual(rec.oracle_map.tests_beyond_oracles, []);
  assert.ok(rec.uncovered.some((u) => u.file === 'src/ledger.mjs'), 'the extra surface is recorded as uncovered, not hidden');
  const b = make();
  const std = await withProfile(null, () => runWave({ projectDir: b.dir, testCommand: GATE, wave: b.wave, totalWaves: 1, planPath: b.planPath, driver: b.driver, reviewerCount: 2, fixIterCap: 2 }));
  assert.equal(std.status, 'HALT');
  assert.match(std.haltReason, /delta-coverage HALT/);
});

test('executableChanges: source, tests, manifests, scripts and CI workflows carry executable meaning; documents, renders and data do not', () => {
  assert.deepEqual(executableChanges(['README.md', 'docs/a.md', 'out/fig.png', 'site/index.html', 'site/style.css', 'data/rows.csv', 'data/rows.json', '.foreman/wave-1-gate.json', '_foreman-status.log']), []);
  assert.deepEqual(
    executableChanges(['src/a.js', 'lib/b.py', 'package.json', '.github/workflows/ci.yml', 'scripts/build.ps1', 'test/x.test.mjs', 'pyproject.toml', 'Makefile', 'old/c.ts (deleted)']),
    ['src/a.js', 'lib/b.py', 'package.json', '.github/workflows/ci.yml', 'scripts/build.ps1', 'test/x.test.mjs', 'pyproject.toml', 'Makefile', 'old/c.ts'],
  );
});

test('the seats are told the truth about a non-code wave: execute gets the declared outputs as its gate, the reviewer judges them, and tests beyond any oracle are named', () => {
  const wave = { n: 1, title: 'Guide', waveKind: 'docs', outputs: ['docs/GUIDE.md'] };
  const ctx = { wave, projectDir: '.', foremanDir: '.foreman', planText: '## Wave 1 — Guide\nkind: docs\noutputs: docs/GUIDE.md\n', testCommand: null };
  const ex = workflow.executePrompt(ctx);
  assert.match(ex, /declared outputs — docs\/GUIDE\.md/);
  assert.doesNotMatch(ex, /vacuous-GREEN HALT/);
  const gate = { artifact_path: 'g.json', exit_code: 0, tap: { pass: 1, tests: 1 } };
  const rv = workflow.reviewPrompt({ ...ctx, reviewerIndex: 0, changed: ['docs/GUIDE.md'] }, gate);
  assert.match(rv, /NON-CODE wave \(kind: docs\)/);
  assert.doesNotMatch(rv, /only regenerated data\/doc/);
  const code = { wave: { n: 2, title: 'Code' }, reviewerIndex: 0, changed: ['src/a.mjs'], projectDir: '.', foremanDir: '.foreman', eleganceInReview: true,
    oracles: { oracles: [], tests_beyond_oracles: ['test/extra.test.mjs'] } };
  assert.match(workflow.reviewPrompt(code, gate), /no acceptance item's \(oracle: \.\.\.\) names: test\/extra\.test\.mjs/);
  assert.match(workflow.executePrompt({ ...code, planText: '## Wave 2 — Code\n', testCommand: 'node --test' }), /ORCHESTRATOR GATE \(you do NOT run it\): node --test/);
});
