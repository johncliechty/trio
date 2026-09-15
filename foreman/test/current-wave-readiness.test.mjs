import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setImmediate as nextTick } from 'node:timers/promises';
import { runWave, runGate, collectFindings, judge, requiredWaveTestPaths, writeWaveProvenLedger } from '../bin/wave-engine.mjs';
import { makeAgentDriver } from '../bin/wave-workflow.js';
import { clearHaltedCheckpoint, planResume } from '../bin/project-engine.mjs';
import { newCheckpoint, readCheckpoint, writeCheckpointAtomic } from '../bin/foreman-lib.mjs';

const required = 'test/w06-commit-accept.test.mjs';
const gateCommand = 'node --test test/*.test.mjs';
const plan = `test-command: ${gateCommand}
## Wave 5 — Old suite
**Deliverables:** Test file test/old.test.mjs with ids: old
## Wave 6 — Scene acceptance
**Deliverables:** Use a shared data session. Test file ${required} with ids: W6-SCENE
See docs/spec.md and examples/sample.test.mjs for examples.
## Wave 7 — Later
**Deliverables:** Test file test/later.test.mjs with ids: later
`;
const testBody = (name) => `import test from 'node:test';
import assert from 'node:assert/strict';
import { value } from '../src/value.mjs';
test('${name}', () => assert.equal(value, 2));\n`;

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foreman-current-wave-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const sub of ['src', 'test', '.foreman']) fs.mkdirSync(path.join(dir, sub));
  fs.writeFileSync(path.join(dir, 'src/value.mjs'), 'export const value = 2;\n');
  fs.writeFileSync(path.join(dir, 'test/old.test.mjs'), testBody('old suite'));
  const planPath = path.join(dir, 'IMPLEMENTATION-PLAN.md');
  fs.writeFileSync(planPath, plan);
  const driver = {
    async execute() {
      fs.writeFileSync(path.join(dir, 'src/value.mjs'), 'export const value = 1 + 1;\n');
      return { note: 'unrelated source correction only' };
    },
    async review({ reviewerIndex }) { return { reviewer: `reviewer-${reviewerIndex}`, answerable: 'yes', findings: [] }; },
    async fix() { throw new Error('fixture must not enter fix'); },
  };
  return { dir, driver, options: { projectDir: dir, planPath, testCommand: gateCommand,
    wave: { n: 6, title: 'Scene acceptance' }, totalWaves: 6, reviewerCount: 2, fixIterCap: 0, driver } };
}

test('W6 literal declaration excludes incidental docs, examples, fixtures and other waves', () => {
  assert.deepEqual(requiredWaveTestPaths(plan, 6), [required]);
  assert.deepEqual(requiredWaveTestPaths('## Wave 6\nTest file test/fixtures/w6.test.mjs with ids: W6\n', 6), ['test/fixtures/w6.test.mjs']);
  const incidental = `## Wave 6
Reference test file test/reference.test.mjs for context.
Example: Test file test/example.test.mjs with ids: example
The spec describes test file test/spec.test.mjs.
No test file test/not-required.test.mjs is required.
**Deliverables:** docs/spec.md and test/fixtures/input.json.
See test/old.test.mjs.
\`\`\`md
Test file test/fenced.test.mjs with ids: sample
\`\`\`
`;
  assert.deepEqual(requiredWaveTestPaths(incidental, 6), []);
  assert.deepEqual(requiredWaveTestPaths('## Wave 6\n**Deliverables:**\n- `test/new.test.mjs`\n', 6), []);
});

test('affirmative declarations survive ordinary preceding text without promoting references', () => {
  for (const declaration of [
    `Replace the old suite with Test file ${required} with ids: W6-SCENE`,
    `**Deliverables:** Use the old helper without changing it; Test file ${required} with ids: W6-SCENE`,
    `**Deliverables:** See the existing source for context. Test file ${required} with ids: W6-SCENE`,
    `- Implement new Test file \`${required}\` with ids: W6-SCENE`,
  ]) assert.deepEqual(requiredWaveTestPaths(`## Wave 6\n${declaration}\n`, 6), [required], declaration);
  for (const reference of [
    'No test file test/x.test.mjs is required',
    'The spec describes test file test/x.test.mjs.',
    'Reference test file test/x.test.mjs for context.',
    'Example: Test file test/x.test.mjs with ids: sample',
    '**Deliverables:** test/x.test.mjs and test/helper.mjs',
    '**Deliverables:** Use test/x.test.mjs for context.',
  ]) assert.deepEqual(requiredWaveTestPaths(`## Wave 6\n${reference}\n`, 6), [], reference);
});

test('implemented wave GO ignores absent bare test/helper paths in Deliverables', async (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.options.planPath, plan.replace('Use a shared data session.',
    'test/incidental.test.mjs and test/helper.mjs; Use a shared data session.'));
  fs.writeFileSync(path.join(f.dir, required), testBody('W6-SCENE'));
  const result = await runWave(f.options);
  assert.equal(result.status, 'GO', result.dashboard);
  assert.equal(result.gate.tap.pass, 2);
  assert.match(result.gate.stdout, /W6-SCENE/);
  assert.equal(fs.existsSync(path.join(f.dir, 'test/incidental.test.mjs')), false);
  assert.equal(fs.existsSync(path.join(f.dir, 'test/helper.mjs')), false);
});

test('real old-suite GREEN plus unrelated executed source edit HALTs on absent current-wave test', async (t) => {
  const f = fixture(t);
  const old = await runGate({ projectDir: f.dir, foremanDir: path.join(f.dir, '.foreman'),
    testCommand: gateCommand, wave: { n: 5 }, iteration: 0 });
  assert.equal(old.green, true);
  const result = await runWave(f.options);
  assert.equal(result.status, 'HALT');
  assert.match(result.haltReason, /wave-not-implemented.*w06-commit-accept/);
  assert.match(fs.readFileSync(path.join(f.dir, 'src/value.mjs'), 'utf8'), /1 \+ 1/);
});

for (const intraStep of ['review', 'gate']) {
  test(`resume at ${intraStep} with an old proven ledger still HALTs on missing W6 tests`, async (t) => {
    const f = fixture(t);
    writeWaveProvenLedger(path.join(f.dir, '.foreman'), 6, { changed: ['src/value.mjs'], tests: 1, pass: 1 });
    f.driver.execute = async () => { assert.fail('resume must skip execute'); };
    const result = await runWave({ ...f.options, resumeFrom: { intraStep, iteration: 1 } });
    assert.equal(result.status, 'HALT');
    assert.match(result.haltReason, /wave-not-implemented.*w06-commit-accept/);
  });
}

for (const force of [false, true]) {
  test(`paused review/iteration0 recovery with unrelated proven ledger: clear-halt force=${force}`, async (t) => {
    const f = fixture(t);
    const checkpointPath = path.join(f.dir, 'foreman-checkpoint.json');
    fs.mkdirSync(path.join(f.dir, 'lib'));
    fs.writeFileSync(path.join(f.dir, 'lib/prose.mjs'), 'export const unrelated = true;\n');
    const ledgerPath = writeWaveProvenLedger(path.join(f.dir, '.foreman'), 6,
      { changed: ['lib/prose.mjs'], tests: 1, pass: 1 });
    const priorLedger = fs.readFileSync(ledgerPath, 'utf8');
    writeCheckpointAtomic(checkpointPath, {
      ...newCheckpoint({ plan_path: f.options.planPath, total_waves: 6 }),
      current_wave: 6, status: 'running', intra_wave_step: 'review', iteration: 0,
    });
    f.driver.execute = async () => assert.fail('initial review resume must skip execute');
    const initial = planResume(checkpointPath, 6);
    assert.deepEqual(initial.resumeFrom, { intraStep: 'review', iteration: 0 });
    const halted = await runWave({ ...f.options, resumeFrom: initial.resumeFrom });
    assert.equal(halted.status, 'HALT');
    assert.equal(halted.gate, null, 'readiness halts before trusting any old-suite result');
    assert.equal(halted.haltSubType, 'missing-required-tests');
    assert.match(readCheckpoint(checkpointPath).pending_action, /^\[taxonomy:missing-required-tests\]/);
    assert.throws(() => planResume(checkpointPath, 6), /HALTED/);
    assert.equal(fs.readFileSync(ledgerPath, 'utf8'), priorLedger);

    const cleared = clearHaltedCheckpoint(checkpointPath, { force });
    assert.equal(cleared.cleared, true);
    assert.equal(cleared.reentry, force ? 'execute' : 'gate');
    const resume = planResume(checkpointPath, 6);
    assert.equal(resume.startWave, 6);
    assert.deepEqual(resume.resumeFrom, { intraStep: force ? 'execute' : 'gate', iteration: 0 });
    assert.equal(resume.cp.last_verdict, 'HALT', 'clear never stamps GO');
    assert.equal(fs.readFileSync(ledgerPath, 'utf8'), priorLedger);
    const executed = [];
    const reviewed = [];
    f.driver.execute = async () => {
      executed.push('execute');
      assert.equal(fs.readFileSync(ledgerPath, 'utf8'), priorLedger, 'recovery retains the old ledger');
      fs.writeFileSync(path.join(f.dir, 'src/scene.mjs'), 'export const accepted = true;\n');
      fs.writeFileSync(path.join(f.dir, required), `import test from 'node:test';
import assert from 'node:assert/strict';
import { accepted } from '../src/scene.mjs';
test('W6-SCENE', () => assert.equal(accepted, true));\n`);
      return { note: 'implemented W6 source and declared tests' };
    };
    const review = f.driver.review;
    f.driver.review = async (ctx, gate) => {
      assert.deepEqual(executed, ['execute']);
      assert.equal(gate.green, true);
      assert.equal(gate.tap.pass, 2);
      assert.match(gate.stdout, /W6-SCENE/);
      reviewed.push(ctx.reviewerIndex);
      return review(ctx);
    };
    const result = await runWave({ ...f.options, resumeFrom: resume.resumeFrom });
    if (!force) {
      assert.equal(result.status, 'HALT');
      assert.equal(result.gate, null);
      assert.deepEqual(executed, []);
      assert.deepEqual(reviewed, []);
      assert.equal(fs.existsSync(path.join(f.dir, required)), false);
      assert.equal(fs.readFileSync(ledgerPath, 'utf8'), priorLedger);
      assert.match(readCheckpoint(checkpointPath).pending_action, /^\[taxonomy:missing-required-tests\]/);
      return;
    }
    assert.equal(result.status, 'GO', result.dashboard);
    assert.equal(result.gate.tap.pass, 2);
    assert.deepEqual(executed, ['execute']);
    assert.deepEqual(reviewed.sort(), [0, 1], 'both independent review seats run after the fresh gate');
    assert.equal(readCheckpoint(checkpointPath).last_verdict, 'GO');
    const evidence = JSON.parse(fs.readFileSync(path.join(f.dir, '.foreman/wave-6-review-0.json'), 'utf8'));
    assert.equal(evidence.phase, 'complete');
    assert.deepEqual(evidence.completed_reviewers.sort(), ['reviewer-0', 'reviewer-1']);
    assert.equal(evidence.decision.go, true);
  });
}

test('explicit force neither waives missing tests nor sends an untyped halt to execute', async (t) => {
  const f = fixture(t);
  const halted = await runWave(f.options);
  assert.equal(halted.status, 'HALT');
  assert.equal(clearHaltedCheckpoint(halted.checkpointPath, { force: true }).reentry, 'execute');
  const stillMissing = await runWave({ ...f.options, resumeFrom: planResume(halted.checkpointPath, 6).resumeFrom });
  assert.equal(stillMissing.status, 'HALT');
  assert.match(stillMissing.haltReason, /wave-not-implemented.*w06-commit-accept/);
  const cp = readCheckpoint(halted.checkpointPath);
  writeCheckpointAtomic(halted.checkpointPath, { ...cp, iteration: 2,
    pending_action: '[taxonomy:agent-died] Unrelated failure mentioning missing-required-tests' });
  assert.equal(clearHaltedCheckpoint(halted.checkpointPath, { force: true }).reentry, 'gate');
  assert.equal(readCheckpoint(halted.checkpointPath).iteration, 2);
  fs.writeFileSync(halted.checkpointPath, '{"status":"halted"}');
  assert.throws(() => clearHaltedCheckpoint(halted.checkpointPath, { force: true }), /checkpoint missing required field/);
});

test('present and exercised current-wave test permits real runWave GO', async (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.dir, required), testBody('W6-SCENE'));
  const result = await runWave(f.options);
  assert.equal(result.status, 'GO', result.dashboard);
  assert.equal(result.gate.tap.pass, 2);
  assert.match(result.gate.stdout, /W6-SCENE/);
  const record = path.join(f.dir, '.foreman/wave-6-review-0.json');
  const prior = JSON.parse(fs.readFileSync(record, 'utf8'));
  const resumed = await runWave({ ...f.options, resumeFrom: { intraStep: 'review', iteration: 0 } });
  assert.equal(resumed.status, 'GO', resumed.dashboard);
  const latest = JSON.parse(fs.readFileSync(record, 'utf8'));
  assert.notEqual(latest.round_id, prior.round_id);
  const retained = JSON.parse(fs.readFileSync(record.replace(/\.json$/, `-${prior.round_id}.json`), 'utf8'));
  assert.equal(retained.phase, 'complete');
  assert.deepEqual(retained, prior);
});

const recovered = [
  { reviewer: 'grok-0', answerable: 'yes', findings: [{ severity: 'BLOCKER', file: 'IMPLEMENTATION-PLAN.md', line: 210,
    rule: 'wave-not-implemented', repro: { command: 'node --test test/old.test.mjs', failing: false, output: 'old tests pass' } }] },
  { reviewer: 'grok-1', answerable: 'yes', findings: [{ severity: 'BLOCKER', file: required, line: null,
    rule: 'wave-not-implemented', repro: { command: `node --test ${required}`, failing: true, output: 'exit 1: missing file' } }] },
];

test('recovered cross-file wave-wide pair preserves both identities/repros and strongest failing evidence', () => {
  const merged = collectFindings(recovered);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].agreement, 2);
  assert.deepEqual(merged[0].reviewer_ids, ['grok-0', 'grok-1']);
  assert.deepEqual(merged[0].evidence.map((e) => e.repro), recovered.map((r) => r.findings[0].repro));
  assert.notEqual(merged[0].evidence[0].id, merged[0].evidence[1].id);
  assert.equal(merged[0].repro.command, `node --test ${required}`);
  assert.equal(judge({ green: true }, merged, { panelSize: 2 }).go, false);
  const duplicate = collectFindings([recovered[0], { ...recovered[1], reviewer: 'grok-0' }]);
  assert.equal(duplicate[0].agreement, 1);
  assert.equal(duplicate[0].evidence.length, 2);
  assert.equal(judge({ green: true }, duplicate, { panelSize: 2 }).go, true);
  const ordinary = collectFindings(recovered.map((r) => ({ ...r, findings: r.findings.map((f) => ({ ...f, rule: 'ordinary-defect' })) })));
  assert.equal(ordinary.length, 2);
  assert.ok(ordinary.every((f) => f.agreement === 1));
  const stronger = collectFindings([{ ...recovered[0], findings: [{ ...recovered[0].findings[0], repro: { command: 'weak', failing: true } }] }, recovered[1]]);
  assert.equal(stronger[0].repro.output, 'exit 1: missing file');
});

test('completed panel evidence is durable before elegance, and last GO check catches a disappearing test', async (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.dir, required), testBody('W6-SCENE'));
  f.driver.review = async ({ reviewerIndex }) => ({ ...recovered[reviewerIndex],
    findings: recovered[reviewerIndex].findings.map((finding) => ({ ...finding, severity: 'MINOR' })) });
  f.driver.elegance = async () => {
    const evidence = JSON.parse(fs.readFileSync(path.join(f.dir, '.foreman/wave-6-review-0.json'), 'utf8'));
    assert.equal(evidence.phase, 'complete');
    assert.deepEqual(evidence.expected_reviewers, ['reviewer-0', 'reviewer-1']);
    assert.deepEqual(evidence.completed_reviewers.sort(), ['reviewer-0', 'reviewer-1']);
    assert.deepEqual(evidence.failed_reviewers, []);
    assert.equal(evidence.responses.length, 2);
    assert.equal(evidence.merged_findings[0].evidence.length, 2);
    assert.equal(evidence.decision.go, true);
    fs.unlinkSync(path.join(f.dir, required));
    throw new Error('simulated interruption after persisted review');
  };
  const result = await runWave(f.options);
  assert.equal(result.status, 'HALT');
  assert.match(result.haltReason, /wave-not-implemented/);
  const evidence = JSON.parse(fs.readFileSync(path.join(f.dir, '.foreman/wave-6-review-0.json'), 'utf8'));
  assert.equal(evidence.decision.go, false);
  assert.equal(evidence.responses.length, 2);
});

test('pending and degraded panel accounts for interrupted/malformed seats without inventing a clean vote', async (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.dir, required), testBody('W6-SCENE'));
  let release;
  let entered;
  const waiting = new Promise((resolve) => { entered = resolve; });
  const held = new Promise((resolve) => { release = resolve; });
  f.driver.review = async ({ reviewerIndex }) => {
    if (reviewerIndex === 0) return recovered[0];
    entered();
    return held;
  };
  const running = runWave(f.options);
  let inspectionError;
  try {
    await Promise.race([waiting, running.then(() => { throw new Error('wave ended before the pending review'); })]);
    await nextTick();
    const evidence = JSON.parse(fs.readFileSync(path.join(f.dir, '.foreman/wave-6-review-0.json'), 'utf8'));
    assert.equal(evidence.phase, 'pending');
    assert.equal(evidence.decision, null);
    assert.deepEqual(evidence.completed_reviewers, ['reviewer-0']);
    assert.equal(evidence.responses[0].original.findings.length, 1);
  } catch (error) { inspectionError = error; }
  finally { release({}); }
  const result = await running;
  if (inspectionError) throw inspectionError;
  assert.equal(result.status, 'GO', result.dashboard); // existing explicit degradation policy
  const evidence = JSON.parse(fs.readFileSync(path.join(f.dir, '.foreman/wave-6-review-0.json'), 'utf8'));
  assert.equal(evidence.review_status, 'degraded');
  assert.deepEqual(evidence.failed_reviewers, ['reviewer-1']);
  assert.deepEqual(evidence.completed_reviewers, ['reviewer-0']);
  assert.equal(evidence.merged_findings[0].agreement, 1);
});

test('production review adapter does not normalize missing fields into approval', async (t) => {
  const f = fixture(t);
  const driver = makeAgentDriver({ agent: async (prompt) => {
    assert.match(prompt, /rule: "wave-not-implemented"/);
    return {};
  } });
  const out = await driver.review({ projectDir: f.dir, wave: { n: 6 }, reviewerIndex: 0 }, { artifact_path: 'gate', exit_code: 0, tap: { pass: 1, tests: 1 } });
  assert.equal(out.answerable, undefined);
  assert.equal(out.findings, undefined);
});
