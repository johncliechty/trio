// drivers/test/grok-cli-flags.test.mjs — the headless grok call carries an explicit turn cap and
// NEVER grok's --json-schema (2026-09-05: a reviewer that read files stopped at grok's default turn
// cap mid-investigation, its last prose line was the whole reply, schema-nonconforming twice, and
// every Foreman wave went GREEN as review:degraded; under --json-schema the model instead answers on
// its first turn without touching its tools). Hermetic: an injected processRunner captures argv.
import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultRunGrokCli, parseGrokJsonOutput, DEFAULT_GROK_CLI_MAX_TURNS } from '../grok-cli.mjs';

const ENVELOPE = JSON.stringify({
  text: '{"answerable":"yes","findings":[]}',
  stopReason: 'end_turn',
  num_turns: 3,
  modelUsage: { 'grok-4.6-build': { inputTokens: 1, outputTokens: 1 } },
});

function capture() {
  const seen = { args: null };
  const processRunner = async ({ args }) => {
    seen.args = args;
    return { stdout: ENVELOPE, stderr: '', code: 0, terminal: 'closed' };
  };
  return { seen, processRunner };
}

test('grok headless call: --max-turns is always passed (default 40, env-tunable); --json-schema never (it suppresses tool use)', async () => {
  const { seen, processRunner } = capture();
  const out = await defaultRunGrokCli('review this', 'review:w1#0', {
    env: { CRUCIBLE_AGENT_LIVE: '1' }, processRunner, platform: 'win32',
    schema: { type: 'object', required: ['answerable'], properties: { answerable: { enum: ['yes', 'no'] } } },
  });
  const a = seen.args;
  const i = a.indexOf('--max-turns');
  assert.ok(i >= 0, `--max-turns missing in ${a.join(' ')}`);
  assert.equal(a[i + 1], String(DEFAULT_GROK_CLI_MAX_TURNS));
  assert.ok(!a.includes('--json-schema'), 'a schema seat must still let grok use its tools');
  assert.equal(out.text, '{"answerable":"yes","findings":[]}');
  assert.equal(out.rec.stop_reason, 'end_turn');
  assert.equal(out.rec.num_turns, 3);
  assert.equal(out.rec.model_served, 'grok-4.6-build');

  const tuned = capture();
  await defaultRunGrokCli('say hi', 'chat', { env: { CRUCIBLE_AGENT_LIVE: '1', GROK_CLI_MAX_TURNS: '7' }, processRunner: tuned.processRunner, platform: 'win32' });
  assert.equal(tuned.seen.args[tuned.seen.args.indexOf('--max-turns') + 1], '7');
});

test('parseGrokJsonOutput keeps stopReason and num_turns so a cap hit can be said aloud', () => {
  const p = parseGrokJsonOutput(ENVELOPE);
  assert.equal(p.stopReason, 'end_turn');
  assert.equal(p.numTurns, 3);
  const q = parseGrokJsonOutput(JSON.stringify({ text: 'x', modelUsage: {} }));
  assert.equal(q.stopReason, null);
  assert.equal(q.numTurns, null);
});
