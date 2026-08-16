// agent-died-halt.test.mjs — the 0102 guard: a dead agent is a LOUD, NAMED halt.
//
// THE INCIDENT (journal 0102, 2026-08-13): a per-call-timeout SIGKILL of the
// execute agent — 20 minutes, 60 tool calls, ZERO bytes written — was logged
// "execute: agent execute complete" and auto-advanced to a gate that would have
// returned GREEN (it re-proves the whole tree, and the PREVIOUS wave's tree was
// green), committing an empty wave as done. Caught by a human relay, not a guard.
// The 0082 guard only caught LAUNCH deaths (<2s, 0 tools); the discriminating
// field was always `ok:false`, full stop.
//
// These tests prove: a driver result carrying the typed { agent_failed } marker
// (which run-live now emits whenever the transport's rec.ok === false) HALTs the
// wave as [taxonomy:agent-died] BEFORE the gate ever runs — for execute AND fix —
// and the wave-workflow driver forwards the marker instead of blessing it.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { locateDocs, parseWaves, discoverTestCommand, readCheckpoint } from '../bin/foreman-lib.mjs';
import { runWave } from '../bin/wave-engine.mjs';
import { makeAgentDriver } from '../bin/wave-workflow.js';

const FIXTURE = path.resolve(import.meta.dirname, '../fixtures/canonical-project');

function freshCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foreman-adied-'));
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

/** The typed marker run-live emits when the transport's rec.ok === false. */
const DEATH = {
  agent_failed: true, exit_class: 'TIMEOUT_KILLED', label: 'execute:w1',
  tools: 60, duration_ms: 1200050,
  detail: 'agent execute:w1 died: class TIMEOUT_KILLED, 60 tool calls, 1200050ms',
};

test('0102: a dead EXECUTE agent halts [taxonomy:agent-died] and never reaches the gate', async () => {
  const dir = freshCopy();
  try {
    const { docs, waves, testCmd, wave } = contractOf(dir);
    let gateWouldHaveRun = false;
    const driver = {
      async execute() { return { note: 'agent execute DIED (TIMEOUT_KILLED)', agent_failed: DEATH }; },
      async review() { gateWouldHaveRun = true; return { reviewer: 'r', findings: [] }; },
      async fix() { gateWouldHaveRun = true; return { note: 'x' }; },
    };
    const result = await runWave({
      projectDir: dir, testCommand: testCmd.command, wave, totalWaves: waves.length,
      planPath: docs.plan, driver, reviewerCount: 1, fixIterCap: 2,
    });
    assert.equal(result.status, 'HALT', 'a dead agent is a HALT, never a GO');
    assert.match(result.haltReason, /\[taxonomy:agent-died\]/);
    assert.match(result.haltReason, /nothing was executed/);
    assert.match(result.recommend ?? '', /--call-timeout-min/,
      'a TIMEOUT death recommends raising the per-call cap (0102 attempt 2 needed 43m vs the 20m default)');
    assert.equal(gateWouldHaveRun, false, 'review/fix never ran — the wave stopped at the death');
    const cp = readCheckpoint(result.checkpointPath);
    assert.equal(cp.status, 'halted', 'checkpoint records the halt (resumable, honest)');
  } finally { cleanup(dir); }
});

test('0102: a dead FIX agent halts [taxonomy:agent-died] instead of looping on "applied"', async () => {
  const dir = freshCopy();
  try {
    const { docs, waves, testCmd, wave } = contractOf(dir);
    const launchDeath = { ...DEATH, exit_class: 'NONZERO_EXIT', tools: 0, duration_ms: 858,
      label: 'fix:w1.1', detail: 'agent fix:w1.1 died: class NONZERO_EXIT, 0 tool calls, 858ms' };
    const driver = {
      async execute() { return { note: 'agent execute complete', raw: '' }; }, // fixture stays red → fix loop
      async review() { return { reviewer: 'r', findings: [] }; },
      async fix() { return { note: 'agent fix DIED (NONZERO_EXIT)', agent_failed: launchDeath }; },
    };
    const result = await runWave({
      projectDir: dir, testCommand: testCmd.command, wave, totalWaves: waves.length,
      planPath: docs.plan, driver, reviewerCount: 1, fixIterCap: 3,
    });
    assert.equal(result.status, 'HALT');
    assert.match(result.haltReason, /\[taxonomy:agent-died\]/);
    assert.match(result.recommend ?? '', /launch-failure|CLI\/auth/,
      'a non-timeout death points at the 0082 launch-failure class (usage limits / broken CLI)');
  } finally { cleanup(dir); }
});

test('wave-workflow forwards the typed marker instead of blessing it as complete', async () => {
  const agent = async () => DEATH; // the transport marker reaches the workflow layer
  const driver = makeAgentDriver({ agent });
  const out = await driver.execute({ wave: { n: 1 }, planText: '', projectDir: '.', foremanDir: '.' });
  assert.equal(out.agent_failed, DEATH);
  assert.match(out.note, /DIED/);
  assert.doesNotMatch(out.note, /complete/i, 'the word "complete" never describes a dead agent');
  const fixOut = await driver.fix({ wave: { n: 1 }, iteration: 1, planText: '', projectDir: '.', foremanDir: '.' }, {}, []);
  assert.equal(fixOut.agent_failed, DEATH);
});
