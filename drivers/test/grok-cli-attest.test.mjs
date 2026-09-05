// (2026-09-04, foreman journal 0109) grok-cli asks for JSON output and attests the served
// model from `modelUsage`, so a Grok verification seat passes the seat contract honestly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGrokJsonOutput, defaultRunGrokCli } from '../grok-cli.mjs';

const ENVELOPE = JSON.stringify({
  text: 'PONG', stopReason: 'end_turn', sessionId: 's', requestId: 'r',
  usage: { input_tokens: 1, output_tokens: 1 }, num_turns: 1, total_cost_usd: 0.01,
  modelUsage: { 'grok-4.6-build': { inputTokens: 1, outputTokens: 1, modelCalls: 1, costUSD: 0.01 } },
});

test('parseGrokJsonOutput: the envelope yields the text and the single served model', () => {
  assert.deepEqual(parseGrokJsonOutput(ENVELOPE), { text: 'PONG', servedModel: 'grok-4.6-build' });
  // narration glued before the envelope still parses
  assert.equal(parseGrokJsonOutput('thinking...\n' + ENVELOPE).servedModel, 'grok-4.6-build');
  // several served models: only the requested one attests
  const multi = JSON.stringify({ text: 'x', modelUsage: { a: {}, b: {} } });
  assert.equal(parseGrokJsonOutput(multi).servedModel, null);
  assert.equal(parseGrokJsonOutput(multi, { requested: 'b' }).servedModel, 'b');
  // plain text is not the envelope
  assert.equal(parseGrokJsonOutput('just prose'), null);
  assert.equal(parseGrokJsonOutput(''), null);
});

function fakeRunner(stdout, code = 0) {
  return async ({ args }) => ({ stdout, stderr: '', code, terminal: 'closed', kill_status: null, _args: args });
}

test('defaultRunGrokCli: asks for JSON and stamps model_served + model_attested from the envelope', async () => {
  let seen = null;
  const processRunner = async (spec) => { seen = spec; return { stdout: ENVELOPE, stderr: '', code: 0, terminal: 'closed', kill_status: null }; };
  const { text, rec } = await defaultRunGrokCli('say PONG', 'reviewer:t', {
    env: { CRUCIBLE_AGENT_LIVE: '1' }, role: 'reviewer', processRunner, platform: 'win32',
  });
  assert.equal(text, 'PONG');
  assert.ok(seen.args.includes('--output-format') && seen.args[seen.args.indexOf('--output-format') + 1] === 'json');
  assert.equal(rec.ok, true);
  assert.equal(rec.model_served, 'grok-4.6-build');
  assert.equal(rec.model_attested, true);
  assert.equal(rec.family_attested, true);
  assert.equal(rec.degraded, false);
});

test('defaultRunGrokCli: plain (non-envelope) output stays honestly unattested', async () => {
  const { text, rec } = await defaultRunGrokCli('say PONG', 'coder:t', {
    env: { CRUCIBLE_AGENT_LIVE: '1' }, role: 'coder', processRunner: fakeRunner('PONG'), platform: 'win32',
  });
  assert.equal(text, 'PONG');
  assert.equal(rec.model_served, null);
  assert.equal(rec.model_attested, false);
  assert.equal(rec.degraded, true);
});
