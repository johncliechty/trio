import { test } from 'node:test';
import assert from 'node:assert/strict';

import { defaultRunClaude } from '../claude.mjs';
import { defaultRunGeminiCli } from '../gemini-cli.mjs';
import { defaultRunGrokCli } from '../grok-cli.mjs';
import { defaultRunCodexCli } from '../chatgpt-cli.mjs';

function closedResult(overrides = {}) {
  return {
    code: 0,
    stdout: '',
    stderr: '',
    terminal: 'closed',
    error: '',
    kill_status: null,
    spawned: true,
    ...overrides,
  };
}

test('Claude default transport propagates served identity from its result envelope', async () => {
  const stdout = `${JSON.stringify({
    type: 'result', is_error: false, result: 'claude answer', model: 'claude-actual',
  })}\n`;
  const out = await defaultRunClaude('work', 'execute:receipt', {
    env: { CRUCIBLE_AGENT_LIVE: '1' },
    model: 'claude-requested',
    processRunner: async () => closedResult({ stdout }),
  });
  assert.equal(out.text, 'claude answer');
  assert.equal(out.rec.ok, true);
  assert.equal(out.rec.requested_model, 'claude-requested');
  assert.equal(out.rec.model_family, 'claude');
  assert.equal(out.rec.family_attested, true);
  assert.equal(out.rec.model_served, 'claude-actual');
  assert.equal(out.rec.model_attested, true);
});

test('Gemini default failure receipt uses resolved mdl and never references an undefined model', async () => {
  const out = await defaultRunGeminiCli('review', 'reviewer:receipt', {
    env: { CRUCIBLE_AGENT_LIVE: '1' },
    model: 'Gemini 3.1 Pro',
    role: 'reviewer',
    processRunner: async () => closedResult({
      code: null, terminal: 'timeout', stderr: 'timed out',
      error: 'timeout after tree kill', kill_status: 'killed',
    }),
  });
  assert.equal(out.rec.ok, false);
  assert.equal(out.rec.status, 'timeout');
  assert.equal(out.rec.requested_model, 'Gemini 3.1 Pro');
  assert.equal(out.rec.model_served, null);
  assert.equal(out.rec.family_attested, false);
  assert.equal(out.rec.model_attested, false);
  assert.equal(out.rec.kill_status, 'killed');
});

test('Grok default success attests only family and never fabricates a session-default model', async () => {
  const out = await defaultRunGrokCli('work', 'execute:receipt', {
    env: { CRUCIBLE_AGENT_LIVE: '1' },
    role: 'execute',
    processRunner: async () => closedResult({ stdout: 'grok answer\n' }),
  });
  assert.equal(out.text, 'grok answer');
  assert.equal(out.rec.ok, true);
  assert.equal(out.rec.requested_model, null);
  assert.equal(out.rec.model_family, 'grok');
  assert.equal(out.rec.family_attested, true);
  assert.equal(out.rec.model_served, null);
  assert.equal(out.rec.model_attested, false);
});

test('ChatGPT default coding success attests family while preserving an unavailable served model', async () => {
  const stdout = [
    JSON.stringify({ type: 'thread.started', thread_id: 'thread-receipt' }),
    JSON.stringify({
      type: 'item.completed', item: { type: 'agent_message', text: 'codex answer' },
    }),
    JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 2 } }),
  ].join('\n');
  const out = await defaultRunCodexCli('work', 'execute:receipt', {
    env: { CRUCIBLE_AGENT_LIVE: '1' },
    role: 'execute',
    model: 'gpt-5.6-sol',
    preflightImpl: () => ({ ok: true, subscription_auth: true }),
    processRunner: async () => closedResult({ stdout }),
  });
  assert.equal(out.text, 'codex answer');
  assert.equal(out.rec.ok, true);
  assert.equal(out.rec.requested_model, 'gpt-5.6-sol');
  assert.equal(out.rec.model_family, 'chatgpt');
  assert.equal(out.rec.family_attested, true);
  assert.equal(out.rec.model_served, null);
  assert.equal(out.rec.model_attested, false);
});
