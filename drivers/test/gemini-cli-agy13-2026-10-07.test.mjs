// agy 1.3.x streamed transport for the gemini-cli driver (2026-10-07, John: "Get Gemini tested and working
// (fully) in Anchor"). Hermetic: the process runner and the policy resolver are injected; no agy is spawned.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgyStreamArgs, agyStreamInput, parseAgyStream, defaultRunGeminiCli,
} from '../gemini-cli.mjs';

const CONV = '839e3931-a668-499b-8105-c26e60d500b2';
const stream = (model, response, status = 'SUCCESS') => [
  { event: 'init', conversation_id: CONV, init: { model } },
  { event: 'step_update', step_update: { conversation_id: CONV, step_index: 1, step_type: 'tool', tool_name: 'view_file' } },
  { event: 'step_update', step_update: { conversation_id: CONV, step_index: 2, step_type: 'agent_response', text_delta: response } },
  { event: 'result', result: { conversation_id: CONV, status, response, duration_seconds: 2.5,
    usage: { input_tokens: 100, output_tokens: 7, thinking_tokens: 3, total_tokens: 110 } } },
].map(e => JSON.stringify(e)).join('\n') + '\n';

test('argv: stdin stream-json, the suffixed model id, plan mode for read-only seats only', () => {
  assert.deepEqual(buildAgyStreamArgs({ model: 'gemini-3.8-flash-high', readonly: true }),
    ['--input-format', 'stream-json', '--output-format', 'stream-json', '--model', 'gemini-3.8-flash-high', '--mode', 'plan', '-p=']);
  assert.ok(!buildAgyStreamArgs({ model: 'm', readonly: false }).includes('--mode'));
  assert.deepEqual(JSON.parse(agyStreamInput('hi')), { event: 'user', message: { role: 'user', content: 'hi' } });
});

test('parseAgyStream reads the reply, model, conversation, usage and tool steps', () => {
  const parsed = parseAgyStream(stream('gemini-3.8-flash-high', 'PONG'));
  assert.equal(parsed.status, 'SUCCESS');
  assert.equal(parsed.text, 'PONG');
  assert.equal(parsed.model, 'gemini-3.8-flash-high');
  assert.equal(parsed.conversation_id, CONV);
  assert.equal(parsed.tools, 1);
});

const run = (stdout, code = 0) => defaultRunGeminiCli('prompt', 'review:x', {
  env: { CRUCIBLE_AGENT_LIVE: '1' }, role: 'review', target: process.cwd(),
  policyResolver: () => ({ family: 'gemini', model: 'gemini-3.8-flash', effort: 'high' }),
  processRunner: async ({ args, input }) => {
    assert.equal(args[args.indexOf('--model') + 1], 'gemini-3.8-flash-high');
    assert.ok(JSON.parse(input).message.content.endsWith('prompt'));
    return { terminal: 'closed', code, stdout, stderr: '' };
  },
});

test('a served model equal to the requested id is an attested Gemini seat', async () => {
  const { text, rec } = await run(stream('gemini-3.8-flash-high', 'PONG'));
  assert.equal(text, 'PONG');
  assert.equal(rec.ok, true);
  assert.equal(rec.model_family, 'gemini');
  assert.equal(rec.model_attested, true);
  assert.equal(rec.family_attested, true);
  assert.equal(rec.output_tokens, 10);
  assert.equal(rec.conversation_id, CONV);
});

test('a different served model is a substitution, never a success', async () => {
  const { rec } = await run(stream('gemini-3.6-flash-low', 'PONG'));
  assert.equal(rec.ok, false);
  assert.equal(rec.status, 'model_substituted');
});

test('an agy ERROR result fails the seat honestly', async () => {
  const { rec } = await run(stream('gemini-3.8-flash-high', '', 'ERROR'), 1);
  assert.equal(rec.ok, false);
  assert.equal(rec.model_attested, false);
});
