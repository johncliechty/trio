// foreman/test/elegance-review.test.mjs — the Elegance / Rabbit-Catcher review after a GREEN wave
// (John, 2026-09-05): a CUT confirmed by the second seat is one fix iteration before GO; HOLDs ride
// the execution log; a driver without the seat is unchanged. Hermetic: the canonical fixture, the
// real gate, scripted seats.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { locateDocs, parseWaves, discoverTestCommand } from '../bin/foreman-lib.mjs';
import { runWave } from '../bin/wave-engine.mjs';
import { makeScriptedDriver } from '../bin/drivers/scripted-driver.mjs';
import { makeAgentDriver, northStarFromPlan, waveSectionText } from '../bin/wave-workflow.js';

const FIXTURE = path.resolve(import.meta.dirname, '../fixtures/canonical-project');
const CALC_REPAIR = { file: 'src/calc.js', findLast: 'return a + b;', replace: 'return a - b;' };
const RABBIT_TEST = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { rabbit } from '../src/extra.js';\ntest('rabbit', () => assert.equal(rabbit, 1));\n";

function freshCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foreman-elegance-'));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}
function cleanup(dir) { fs.rmSync(dir, { recursive: true, force: true }); }
function contractOf(dir) {
  const docs = locateDocs(dir);
  const planText = fs.readFileSync(docs.plan, 'utf8');
  const waves = parseWaves(planText);
  const testCmd = discoverTestCommand(planText, dir);
  return { docs, waves, testCmd, wave: waves[waves.length - 1] };
}

test('the driver seat: makeAgentDriver.elegance runs the catcher (synthesizer) then the adversary (shark) over the changed files', async () => {
  const roles = [];
  const agent = async (prompt, opts) => {
    roles.push(opts.role);
    if (opts.role === 'synthesizer') {
      assert.ok(prompt.includes('[F1]') && prompt.includes('src/extra.js'));
      return { verdicts: [
        { id: 'F1', verdict: 'CUT', need: 'none', provenance: 'none', rc2: 'nothing breaks without it', needed_because: '' },
        { id: 'F2', verdict: 'KEEP', need: 'the plan section names calc', provenance: 'record', rc2: 'the wave fails', needed_because: 'plan' },
      ] };
    }
    return { disputes: [] };
  };
  const driver = makeAgentDriver({ agent });
  const ctx = { wave: { n: 1, title: 'Wave one' }, changed: ['src/extra.js', 'src/calc.js', 'test/calc.test.mjs'], planText: '**North Star:** a calculator\n\n## Wave 1 — Wave one\n- deliverable: `src/calc.js`\n', log: () => {} };
  const out = await driver.elegance(ctx, { tap: { pass: 3, tests: 3 } });
  assert.deepEqual(roles, ['synthesizer', 'shark']);
  assert.deepEqual(out.cuts, ['F1']);
  assert.ok(out.verdicts.find((v) => v.id === 'F3' && v.verdict === 'HOLD'), 'the unjudged test file is HOLD, never a silent KEEP');
  assert.equal(northStarFromPlan(ctx.planText), 'a calculator');
  assert.match(waveSectionText(ctx.planText, 1), /deliverable: `src\/calc\.js`/);
});

test('runWave: a confirmed CUT is one fix iteration that removes the rabbit hole, then the wave re-proves GREEN and GOes; HOLDs ride the execution log', async () => {
  const dir = freshCopy();
  try {
    const { docs, waves, testCmd, wave } = contractOf(dir);
    // The rabbit hole PASSES the gate and Foreman's delta-coverage guard on its own: an unneeded
    // module shipped WITH a test that names it. Only the battery can see that nobody asked for it.
    const scripted = makeScriptedDriver({
      repairs: [CALC_REPAIR],
      onExecute: async (ctx) => {
        fs.writeFileSync(path.join(ctx.projectDir, 'src', 'extra.js'), 'export const rabbit = 1;\n', 'utf8');
        fs.writeFileSync(path.join(ctx.projectDir, 'test', 'extra.test.mjs'), RABBIT_TEST, 'utf8');
      },
    });
    const fixCalls = [];
    let eleganceCalls = 0;
    const driver = {
      execute: scripted.execute.bind(scripted),
      review: scripted.review.bind(scripted),
      async fix(ctx, gate, findings) {
        fixCalls.push(findings);
        const rabbit = findings.find((f) => String(f.id || '').startsWith('rabbit-hole:'));
        if (rabbit) {
          fs.unlinkSync(path.join(ctx.projectDir, 'src', 'extra.js'));
          fs.unlinkSync(path.join(ctx.projectDir, 'test', 'extra.test.mjs'));
          return { note: 'removed the rabbit hole and its test' };
        }
        return scripted.fix(ctx, gate, findings);
      },
      async elegance(ctx, gate) {
        eleganceCalls += 1;
        assert.ok(gate && gate.green, 'the review runs only after a GREEN gate');
        return {
          verdicts: [
            { id: 'F1', text: 'src/extra.js', verdict: 'CUT', need: 'none', provenance: 'none', rc2: 'nothing breaks without it', needed_because: '' },
            { id: 'F2', text: 'src/calc.js', verdict: 'KEEP', need: 'the plan', provenance: 'record', rc2: 'the wave fails', needed_because: 'plan' },
            { id: 'F3', text: 'test/calc.test.mjs', verdict: 'HOLD', need: '', provenance: 'none', rc2: '', trigger: 'name the next change it cheapens', needed_because: '' },
            { id: 'F4', text: 'test/extra.test.mjs', verdict: 'CUT', need: 'none', provenance: 'none', rc2: 'a test for a module nobody asked for names no next change', needed_because: '' },
          ],
          cuts: ['F1', 'F4'], holds: ['F3'], keeps: ['F2'], markdown: '# pass\n',
        };
      },
    };
    const result = await runWave({
      projectDir: dir, testCommand: testCmd.command, wave, totalWaves: waves.length,
      planPath: docs.plan, driver, reviewerCount: 1, fixIterCap: 4,
    });
    assert.equal(result.status, 'GO', result.dashboard);
    assert.equal(eleganceCalls, 1, 'the pass runs once per wave, never twice');
    const rabbitFix = fixCalls.find((fs_) => fs_.some((f) => String(f.id || '').startsWith('rabbit-hole:')));
    assert.ok(rabbitFix, 'the confirmed cut became a fix iteration');
    assert.match(rabbitFix[0].message, /\[taxonomy:rabbit-hole\] REMOVE src\/extra\.js/);
    assert.equal(fs.existsSync(path.join(dir, 'src', 'extra.js')), false, 'the rabbit hole is gone before GO');
    assert.ok(fs.existsSync(path.join(dir, '.foreman', `wave-${wave.n}-elegance.md`)), 'the record is written');
    const log = fs.readFileSync(docs.execution_log, 'utf8');
    assert.match(log, /elegance HOLD \(Grasscatcher\): \[F3\] test\/calc\.test\.mjs — name the next change it cheapens/);
    assert.ok(/elegance review: keep 1 · hold 1 · cut 2/.test(result.dashboard), result.dashboard);
  } finally { cleanup(dir); }
});

test('runWave: a driver without the elegance seat is unchanged (GO with no elegance step)', async () => {
  const dir = freshCopy();
  try {
    const { docs, waves, testCmd, wave } = contractOf(dir);
    const driver = makeScriptedDriver({ repairs: [CALC_REPAIR] });
    const result = await runWave({
      projectDir: dir, testCommand: testCmd.command, wave, totalWaves: waves.length,
      planPath: docs.plan, driver, reviewerCount: 1, fixIterCap: 4,
    });
    assert.equal(result.status, 'GO');
    assert.ok(!/elegance review/.test(result.dashboard));
    assert.equal(fs.existsSync(path.join(dir, '.foreman', `wave-${wave.n}-elegance.md`)), false);
  } finally { cleanup(dir); }
});
