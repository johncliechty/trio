// S4 of the slim plan (2026-10-10, John's Q3): Foreman's slim profile - one reviewer with the elegance check folded
// in, no separate elegance phase, and a stop when a fix leaves the very same tests failing. Plus the one rule every
// profile now keeps: a one-wave job is not given the terminal-wave panel. Real engine, real gate, scripted seats.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { locateDocs, parseWaves, discoverTestCommand } from '../bin/foreman-lib.mjs';
import { runWave, failingTests } from '../bin/wave-engine.mjs';
import { makeScriptedDriver } from '../bin/drivers/scripted-driver.mjs';
import { _internals } from '../bin/wave-workflow.js';

const FIXTURE = path.resolve(import.meta.dirname, '../fixtures/canonical-project');
const CALC_REPAIR = { file: 'src/calc.js', findLast: 'return a + b;', replace: 'return a - b;' };

function freshCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foreman-slim-'));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}
function contractOf(dir) {
  const docs = locateDocs(dir);
  const planText = fs.readFileSync(docs.plan, 'utf8');
  const waves = parseWaves(planText);
  return { docs, testCmd: discoverTestCommand(planText, dir), wave: waves[waves.length - 1] };
}
function counted(driver) {
  const n = { review: 0, elegance: 0 };
  return {
    n,
    driver: {
      ...driver,
      async review(ctx, gate) { n.review++; return driver.review(ctx, gate); },
      async elegance() { n.elegance++; return { verdicts: [], keeps: [], markdown: '' }; },
    },
  };
}
function repairAtExecute(dir) {
  const abs = path.join(dir, CALC_REPAIR.file);
  const txt = fs.readFileSync(abs, 'utf8');
  const i = txt.lastIndexOf(CALC_REPAIR.findLast);
  fs.writeFileSync(abs, txt.slice(0, i) + CALC_REPAIR.replace + txt.slice(i + CALC_REPAIR.findLast.length));
}
async function withProfile(profile, fn) {
  const was = process.env.FOREMAN_PROFILE;
  if (profile) process.env.FOREMAN_PROFILE = profile; else delete process.env.FOREMAN_PROFILE;
  try { return await fn(); } finally { if (was === undefined) delete process.env.FOREMAN_PROFILE; else process.env.FOREMAN_PROFILE = was; }
}

test('failingTests names the failures of TAP, node spec and pytest output', () => {
  assert.deepEqual(failingTests({ stdout: 'ok 1 - a\nnot ok 2 - subtracts # TODO\nnot ok 3 - adds\n' }), ['adds', 'subtracts']);
  assert.deepEqual(failingTests({ stdout: '✔ fine (1ms)\n✖ subtracts (2.1ms)\n✖ failing tests:\n' }), ['subtracts']);
  assert.deepEqual(failingTests({ stdout: 'FAILED tests/test_x.py::test_y - assert 1\nERROR tests/test_z.py::test_w\n' }),
    ['tests/test_x.py::test_y', 'tests/test_z.py::test_w']);
  assert.deepEqual(failingTests({ stdout: 'all good\n' }), []);
});

test('slim: a fix that leaves the very same tests failing stops the wave at once (no-progress)', async () => {
  const dir = freshCopy();
  const { docs, testCmd, wave } = contractOf(dir);
  const r = await withProfile('slim', () => runWave({
    projectDir: dir, testCommand: testCmd.command, wave, totalWaves: wave.n,
    planPath: docs.plan, driver: makeScriptedDriver({ repairs: [] }), reviewerCount: 1, fixIterCap: 2,
  }));
  assert.equal(r.status, 'HALT');
  assert.match(r.haltReason, /\[taxonomy:no-progress\]/);
  assert.equal(r.iterations, 1, 'stopped after the first fix made no progress, not at the cap');
});

test('standard keeps spending its cap on the same failure unless no-progress is opted in', async () => {
  const dir = freshCopy();
  const { docs, testCmd, wave } = contractOf(dir);
  const r = await withProfile(null, () => runWave({
    projectDir: dir, testCommand: testCmd.command, wave, totalWaves: wave.n,
    planPath: docs.plan, driver: makeScriptedDriver({ repairs: [] }), reviewerCount: 2, fixIterCap: 2,
  }));
  assert.match(r.haltReason, /non-convergence HALT: hit MAX_ITERS=2/);
});

test('slim: one reviewer even on the terminal wave after a fix, and no separate elegance phase', async () => {
  const dir = freshCopy();
  const { docs, testCmd, wave } = contractOf(dir);
  const { n, driver } = counted(makeScriptedDriver({ repairs: [CALC_REPAIR] }));
  const r = await withProfile('slim', () => runWave({
    projectDir: dir, testCommand: testCmd.command, wave, totalWaves: wave.n,
    planPath: docs.plan, driver, reviewerCount: 2, fixIterCap: 2,
  }));
  assert.equal(r.status, 'GO');
  assert.equal(n.elegance, 0, 'elegance is folded into the review');
  assert.ok(n.review >= 1 && n.review <= 2, `one reviewer per reviewed gate (saw ${n.review})`);
});

test('standard: a one-wave job is reviewed by one seat; elegance still runs', async () => {
  const dir = freshCopy();
  const { docs, testCmd, wave } = contractOf(dir);
  const { n, driver } = counted(makeScriptedDriver({ onExecute: async () => repairAtExecute(dir) }));
  const r = await withProfile(null, () => runWave({
    projectDir: dir, testCommand: testCmd.command, wave: { ...wave, n: 1 }, totalWaves: 1,
    planPath: docs.plan, driver, reviewerCount: 2, fixIterCap: 2,
  }));
  assert.equal(r.status, 'GO', r.haltReason);
  assert.equal(n.review, 1, 'the terminal-wave panel is for multi-wave projects');
  assert.equal(n.elegance, 1);
});

test('review r1: pytest node ids keep their spaces, so two parametrized failures stay two', () => {
  assert.deepEqual(failingTests({ stdout: 'FAILED tests/t.py::test_case[input A] - assert 1 == 2\nFAILED tests/t.py::test_case[input B]\n' }),
    ['tests/t.py::test_case[input A]', 'tests/t.py::test_case[input B]']);
});

test('review r2: a " - " inside the [params] stays part of the node id', () => {
  assert.deepEqual(failingTests({ stdout: 'FAILED t.py::case[input - A] - assert 0\nFAILED t.py::case[input - B]\n' }),
    ['t.py::case[input - A]', 't.py::case[input - B]']);
});

test('review r2: slim with no reviewer scheduled never reaches GO', async () => {
  const dir = freshCopy();
  const { docs, testCmd, wave } = contractOf(dir);
  const r = await withProfile('slim', () => runWave({
    projectDir: dir, testCommand: testCmd.command, wave: { ...wave, n: 1 }, totalWaves: 1,
    planPath: docs.plan, driver: makeScriptedDriver({ onExecute: async () => repairAtExecute(dir) }), reviewerCount: 0, fixIterCap: 2,
  }));
  assert.equal(r.status, 'HALT');
  assert.match(r.haltReason, /\[taxonomy:review-unavailable\]/);
});

test('review r1: slim never passes a wave whose one reviewer did not complete', async () => {
  const dir = freshCopy();
  const { docs, testCmd, wave } = contractOf(dir);
  const base = makeScriptedDriver({ onExecute: async () => repairAtExecute(dir) });
  const driver = { ...base, async review() { return { transport_failed: true, note: 'seat unreachable', findings: [] }; } };
  const r = await withProfile('slim', () => runWave({
    projectDir: dir, testCommand: testCmd.command, wave: { ...wave, n: 1 }, totalWaves: 1,
    planPath: docs.plan, driver, reviewerCount: 1, fixIterCap: 2,
  }));
  assert.equal(r.status, 'HALT');
  assert.match(r.haltReason, /\[taxonomy:review-unavailable\]/);
});

test('review r1: run-live passes the resolved profile on, whatever was inherited', () => {
  const src = fs.readFileSync(path.join(import.meta.dirname, '..', 'bin', 'run-live.mjs'), 'utf8');
  assert.match(src, /process\.env\.FOREMAN_PROFILE = PROFILE;/);
});

test('the slim reviewer is asked the three elegance questions; the standard one is not', () => {
  const gate = { artifact_path: 'g.json', exit_code: 0, tap: { pass: 1, tests: 1 } };
  const base = { wave: { n: 1 }, reviewerIndex: 0, changed: ['src/a.js'], projectDir: '.', foremanDir: '.foreman' };
  assert.match(_internals.reviewPrompt({ ...base, eleganceInReview: true }, gate), /ELEGANCE \(three questions/);
  assert.doesNotMatch(_internals.reviewPrompt(base, gate), /ELEGANCE \(three questions/);
});

test('final review: a slim elegance finding takes one fix iteration, then the wave re-proves GREEN', async () => {
  const dir = freshCopy();
  const { docs, testCmd, wave } = contractOf(dir);
  let reviews = 0, fixes = 0;
  const base = makeScriptedDriver({ onExecute: async () => repairAtExecute(dir) });
  const driver = {
    ...base,
    async review(ctx, gate) {
      reviews++;
      const r = await base.review(ctx, gate);
      return reviews === 1 ? { ...r, findings: [{ severity: 'MAJOR', file: 'src/calc.js', line: 1, rule: 'elegance', message: 'remove the unused helper' }] } : r;
    },
    async fix(ctx, gate, f) { fixes++; return base.fix(ctx, gate, f); },
  };
  const r = await withProfile('slim', () => runWave({
    projectDir: dir, testCommand: testCmd.command, wave: { ...wave, n: 1 }, totalWaves: 1,
    planPath: docs.plan, driver, reviewerCount: 1, fixIterCap: 2,
  }));
  assert.equal(r.status, 'GO', r.haltReason);
  assert.equal(fixes, 1, 'the elegance finding was acted on once');
});

test('final review r2: a test the slim reviewer names as unnecessary may be removed without an immutability halt', async () => {
  const dir = freshCopy();
  const { docs, testCmd, wave } = contractOf(dir);
  const extra = path.join(dir, 'test', 'extra.test.mjs');
  let reviews = 0, fixMessages = [];
  const base = makeScriptedDriver({ onExecute: async () => { repairAtExecute(dir); fs.writeFileSync(extra, "import test from 'node:test';\ntest('redundant', () => {});\n"); } });
  const driver = {
    ...base,
    async review(ctx, gate) {
      reviews++;
      const r = await base.review(ctx, gate);
      return reviews === 1 ? { ...r, findings: [{ severity: 'MAJOR', file: 'test/extra.test.mjs', line: 1, rule: 'elegance', message: 'a test beyond any acceptance item' }] } : r;
    },
    async fix(ctx, gate, f) { fixMessages = f.map((x) => x.message); fs.rmSync(extra, { force: true }); return { note: 'removed the redundant test' }; },
  };
  const r = await withProfile('slim', () => runWave({
    projectDir: dir, testCommand: testCmd.command, wave: { ...wave, n: 1 }, totalWaves: 1,
    planPath: docs.plan, driver, reviewerCount: 1, fixIterCap: 2,
  }));
  assert.equal(r.status, 'GO', r.haltReason);
  assert.match(fixMessages[0], /removing this test file is allowed/);
});

test('final review r3: the live fix prompt carries the removal and names the one test it may delete', () => {
  const gate = { artifact_path: 'g.json' };
  const ctx = { wave: { n: 1 }, iteration: 1, projectDir: '.', foremanDir: '.foreman' };
  const p = _internals.fixPrompt(ctx, gate, [{ id: 'rabbit-hole:x', file: 'test/extra.test.mjs', message: '[taxonomy:rabbit-hole] a test beyond any acceptance item (removing this test file is allowed); keep the gate green' }]);
  assert.match(p, /REMOVE, as the reviewer found: test\/extra\.test\.mjs/);
  assert.match(p, /ONE EXCEPTION: you MAY delete exactly these test files[^.]*test\/extra\.test\.mjs/);
  const plain = _internals.fixPrompt(ctx, gate, [{ id: 'src/a.js:1+assertion-failed' }]);
  assert.doesNotMatch(plain, /ONE EXCEPTION/);
});
