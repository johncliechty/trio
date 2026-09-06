// drivers/test/cli-schema-cancelled.test.mjs — a headless turn that grok CANCELLED (a tool ask nobody
// could answer) is said aloud and re-prompted with the read-only constraint; twice ⇒ the error says
// cancelled, never "schema-nonconforming" (2026-09-05, foreman journal 0112 addendum). Hermetic.
import test from 'node:test';
import assert from 'node:assert/strict';

import { runCliSchemaAttempts } from '../cli-schema.mjs';
import { defaultRunGrokCli, GROK_HEADLESS_READONLY_NOTE } from '../grok-cli.mjs';

const SCHEMA = { type: 'object', required: ['answerable'], properties: { answerable: { enum: ['yes', 'no'] } } };
const parse = (t) => { try { return JSON.parse(String(t).slice(String(t).indexOf('{'))); } catch { return null; } };
const okRec = (extra = {}) => ({ ok: true, status: 'success', label: 'x', model_served: 'grok-4.6-build', family_attested: true, model_attested: true, ...extra });

test('a cancelled first turn is logged as cancelled and the retry carries the read-only constraint', async () => {
  const prompts = [];
  const logs = [];
  let n = 0;
  const run = async (prompt) => {
    prompts.push(prompt);
    n += 1;
    if (n === 1) return { text: "I'll run that command now.", rec: okRec({ stop_reason: 'cancelled', turn_cancelled: true }) };
    return { text: '{"answerable":"yes"}', rec: okRec({ stop_reason: 'end_turn', turn_cancelled: false }) };
  };
  const out = await runCliSchemaAttempts({ run, prompt: 'review', schema: SCHEMA, label: 'review:w1#0', log: (m) => logs.push(m), parse });
  assert.deepEqual(out, { answerable: 'yes' });
  assert.ok(logs.some((l) => /turn was CANCELLED \(a tool ask cannot be answered headless\)/.test(l)), logs.join(' | '));
  assert.match(prompts[1], /Your previous turn was CANCELLED because a shell command needed an approval/);
  assert.match(prompts[1], /Do not chain \(;\), branch \(if\/else\) or redirect/);
});

test('cancelled twice fails closed with an error that says cancelled, not schema-nonconforming', async () => {
  const run = async () => ({ text: 'narration', rec: okRec({ stop_reason: 'cancelled', turn_cancelled: true }) });
  await assert.rejects(
    () => runCliSchemaAttempts({ run, prompt: 'review', schema: SCHEMA, label: 'review:w1#0', parse }),
    (e) => /CANCELLED twice — a tool ask cannot be answered headless/.test(e.message) && e.seat_status === 'schema_nonconforming',
  );
});

test('a verification seat is told the read-only constraint up front; a drafting seat is not', async () => {
  const seen = [];
  const processRunner = async ({ args }) => {
    seen.push(args[args.indexOf('-p') + 1]);
    return { stdout: JSON.stringify({ text: '{}', stopReason: 'end_turn', num_turns: 1, modelUsage: { 'grok-4.6-build': {} } }), stderr: '', code: 0, terminal: 'closed' };
  };
  await defaultRunGrokCli('judge this', 'review:w2#1', { env: { CRUCIBLE_AGENT_LIVE: '1' }, processRunner, platform: 'win32', role: 'review' });
  await defaultRunGrokCli('write this', 'execute:w2', { env: { CRUCIBLE_AGENT_LIVE: '1' }, processRunner, platform: 'win32', role: 'execute' });
  assert.ok(seen[0].startsWith(GROK_HEADLESS_READONLY_NOTE), 'verification prompt carries the note first');
  assert.ok(!seen[1].includes(GROK_HEADLESS_READONLY_NOTE), 'a drafting seat is not lectured');
});
