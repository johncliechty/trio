/**
 * Transport-boundary canaries. Every runtime path has an injected processRunner;
 * Codex also has an injected preflight. No subscriptions or native processes are
 * used. Grok prompts are deliberately short, avoiding its prompt-file branch.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultRunCodexCli } from '../chatgpt-cli.mjs';
import { defaultRunClaude } from '../claude.mjs';
import { defaultRunGrokCli } from '../grok-cli.mjs';
import { defaultRunGeminiCli } from '../gemini-cli.mjs';

const PROMPT = 'Synthetic routing canary: answer once with a short acknowledgement.';

test('unverified Gemini policy fails before a dated label or process can be used', () => {
  let spawned = false;
  assert.throws(() => defaultRunGeminiCli('synthetic', 'refuter', {
    env: { CRUCIBLE_AGENT_LIVE: '1' },
    policyResolver: family => { assert.equal(family, 'gemini'); throw new Error('capabilities unavailable'); },
    processRunner: () => { spawned = true; },
  }), /capabilities unavailable/);
  assert.equal(spawned, false);
});

for (const failure of [
  { is_error: true, text: 'Usage limit reached' },
  { isError: true, result: 'Rejected' },
  { stopReason: 'cancelled', text: 'Partial answer' },
  { stopReason: 'max_turns', text: 'Partial answer' },
  { errors: ['Usage limit reached'], text: 'Partial answer' },
]) test('Grok native failure cannot become success through exit code zero: ' + JSON.stringify(failure), async () => {
  const { options } = harness('grok', JSON.stringify(failure));
  const { rec } = await defaultRunGrokCli(PROMPT, 'refuter', options);
  assert.equal(rec.ok, false);
  assert.equal(rec.replay_safe, false);
});
const SESSION = '12345678-1234-4234-8234-123456789abc';
const jsonl = (...frames) => frames.map(frame => JSON.stringify(frame)).join('\n') + '\n';
const modelSelections = {
  chatgpt: { family: 'chatgpt', model: 'gpt-synthetic', effort: 'ultra' },
  claude: { family: 'claude', model: 'best', effort: 'max' },
  grok: { family: 'grok', model: 'grok-synthetic', effort: 'xhigh' },
};

function harness(family, stdout, { code = 0, ...overrides } = {}) {
  const calls = [];
  const selection = { ...modelSelections[family] };
  const options = {
    env: { CRUCIBLE_AGENT_LIVE: '1' },
    platform: 'win32',
    target: 'C:\\synthetic\\subscription-routing-canary',
    role: 'orchestrator',
    policyResolver: () => ({ ...selection }),
    preflightImpl: () => ({ ok: true, subscription_auth: true }),
    processRunner: async request => {
      calls.push(request);
      return { stdout, stderr: '', code, terminal: 'closed', kill_status: null, spawned: true };
    },
    ...overrides,
  };
  return { calls, options, selection };
}

function assertOneOwnedInvocation(calls) {
  assert.equal(calls.length, 1);
  assert.equal(typeof calls[0].command, 'string');
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].options.windowsHide, true);
  assert.ok(Array.isArray(calls[0].args));
  return calls[0];
}

function argument(args, flag) {
  const position = args.indexOf(flag);
  assert.notEqual(position, -1, `Expected ${flag} in native argv`);
  return args[position + 1];
}

function claudeInit(model = 'configured-alias-is-not-serving-evidence') {
  return { type: 'system', subtype: 'init', session_id: SESSION, model };
}

function claudeFailure(changes = {}) {
  return {
    type: 'result', subtype: 'error_during_execution', is_error: true,
    session_id: SESSION, num_turns: 0,
    usage: { input_tokens: 0, output_tokens: 0 },
    errors: ['Usage limit reached'], ...changes,
  };
}

function claudeSuccess() {
  return {
    type: 'result', subtype: 'success', is_error: false, session_id: SESSION,
    num_turns: 1, result: 'Acknowledged.', usage: { input_tokens: 2, output_tokens: 1 },
  };
}

test('Codex transport preserves clean native pre-activity quota replay proof', async () => {
  const stdout = jsonl(
    { type: 'thread.started', thread_id: SESSION },
    { type: 'turn.started' },
    { type: 'turn.failed', error: { code: 'usage_limit_reached', message: 'Usage limit reached' } },
  );
  const { calls, options } = harness('chatgpt', stdout, { code: 1 });
  const { rec } = await defaultRunCodexCli(PROMPT, 'orchestrator-quota-canary', options);
  const invocation = assertOneOwnedInvocation(calls);
  assert.equal(rec.replay_safe, true);
  assert.equal(rec.replay_evidence, 'codex_native_pre_activity_rejection');
  assert.equal(argument(invocation.args, '--model'), 'gpt-synthetic');
  assert.ok(invocation.args.some(value => String(value).includes('model_reasoning_effort="ultra"')));
  assert.ok(String(invocation.input).includes(PROMPT));
});

test('Codex transport does not authorize replay after native tool activity', async () => {
  const stdout = jsonl(
    { type: 'thread.started', thread_id: SESSION },
    { type: 'turn.started' },
    { type: 'item.completed', item: { id: 'owned-tool', type: 'command_execution', status: 'completed', exit_code: 0 } },
    { type: 'turn.failed', error: { code: 'usage_limit_reached', message: 'Usage limit reached' } },
  );
  const { calls, options } = harness('chatgpt', stdout, { code: 1 });
  const { rec } = await defaultRunCodexCli(PROMPT, 'orchestrator-partial-canary', options);
  assertOneOwnedInvocation(calls);
  assert.equal(rec.replay_safe, false);
  assert.equal(rec.replay_evidence, 'native_activity_defeats_replay_proof');
});

test('Codex failed subscription preflight never invokes the process runner', async () => {
  const { calls, options } = harness('chatgpt', '', {
    preflightImpl: () => ({ ok: false, subscription_auth: false, error: 'Synthetic subscription preflight rejection' }),
  });
  const { rec } = await defaultRunCodexCli(PROMPT, 'orchestrator-preflight-canary', options);
  assert.equal(calls.length, 0);
  assert.equal(rec.replay_safe, true);
  assert.equal(typeof rec.replay_evidence, 'string');
  assert.ok(rec.replay_evidence.length > 0);
});

test('Claude transport preserves explicit native zero-turn rejection proof', async () => {
  const { calls, options } = harness('claude', jsonl(claudeInit(), claudeFailure()), { code: 1 });
  const { rec } = await defaultRunClaude(PROMPT, 'orchestrator-quota-canary', options);
  const invocation = assertOneOwnedInvocation(calls);
  assert.equal(rec.replay_safe, true);
  assert.equal(rec.replay_evidence, 'claude_native_zero_turn_zero_output_rejection');
  assert.equal(argument(invocation.args, '--model'), 'best');
  assert.equal(argument(invocation.args, '--effort'), 'max');
  assert.ok(String(invocation.input).includes(PROMPT));
});

test('Claude transport denies replay after assistant/tool activity', async () => {
  const stdout = jsonl(
    claudeInit(),
    { type: 'assistant', session_id: SESSION, message: {
      model: 'claude-synthetic-served',
      content: [{ type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: 'synthetic.txt' } }],
    } },
    claudeFailure({ num_turns: 1, usage: { input_tokens: 4, output_tokens: 2 } }),
  );
  const { calls, options } = harness('claude', stdout, { code: 1 });
  const { rec } = await defaultRunClaude(PROMPT, 'orchestrator-partial-canary', options);
  assertOneOwnedInvocation(calls);
  assert.equal(rec.replay_safe, false);
  assert.equal(rec.replay_evidence, 'native_activity_defeats_replay_proof');
});

test('Claude orchestrator read-only request preserves plan mode and read-only tools', async () => {
  const { calls, options } = harness('claude', jsonl(claudeInit(), claudeSuccess()), { sandbox: 'read-only' });
  await defaultRunClaude(PROMPT, 'orchestrator-read-only-canary', options);
  const { args } = assertOneOwnedInvocation(calls);
  assert.equal(argument(args, '--permission-mode'), 'plan');
  assert.equal(argument(args, '--allowedTools'), 'Read,Glob,Grep');
  assert.equal(args.includes('--dangerously-skip-permissions'), false);
  assert.equal(args.includes('bypassPermissions'), false);
});

test('Claude system/init model is not promoted to actual-model attestation', async () => {
  const { calls, options } = harness('claude', jsonl(claudeInit('claude-configured-alias'), claudeSuccess()));
  const { rec } = await defaultRunClaude(PROMPT, 'orchestrator-attestation-canary', options);
  assertOneOwnedInvocation(calls);
  assert.equal(rec.model_attested, false);
  assert.equal(rec.model_served, null);
});

test('Grok transport retains conservative replay denial even with apparent zero counters', async () => {
  const stdout = JSON.stringify({
    type: 'result', session_id: SESSION, is_error: true, stopReason: 'error',
    num_turns: 0, tool_count: 0, usage: { output_tokens: 0 }, errors: ['Usage limit reached'],
  });
  const { calls, options } = harness('grok', stdout, { code: 1 });
  const { rec } = await defaultRunGrokCli(PROMPT, 'orchestrator-quota-canary', options);
  const { args } = assertOneOwnedInvocation(calls);
  assert.equal(rec.replay_safe, false);
  assert.equal(rec.replay_evidence, 'grok_native_zero_activity_contract_not_established');
  assert.equal(argument(args, '--model'), 'grok-synthetic');
  assert.equal(argument(args, '--reasoning-effort'), 'xhigh');
});

test('Grok orchestrator read-only request preserves native plan mode', async () => {
  const stdout = JSON.stringify({
    is_error: false, stopReason: 'completed', result: 'Acknowledged.',
    modelUsage: { 'grok-synthetic-served': { inputTokens: 2, outputTokens: 1 } },
  });
  const { calls, options } = harness('grok', stdout, { sandbox: 'read-only' });
  await defaultRunGrokCli(PROMPT, 'orchestrator-read-only-canary', options);
  const { args } = assertOneOwnedInvocation(calls);
  assert.equal(argument(args, '--permission-mode'), 'plan');
  assert.equal(args.includes('bypassPermissions'), false);
});

test('Grok multiple modelUsage contributors do not attest the requested model as the main seat', async () => {
  const stdout = JSON.stringify({
    is_error: false, stopReason: 'completed', result: 'Acknowledged.',
    modelUsage: {
      'grok-synthetic': { inputTokens: 2, outputTokens: 1 },
      'grok-other-served': { inputTokens: 3, outputTokens: 1 },
    },
  });
  const { calls, options } = harness('grok', stdout);
  const { rec } = await defaultRunGrokCli(PROMPT, 'orchestrator-multiple-models-canary', options);
  assertOneOwnedInvocation(calls);
  assert.equal(rec.model_served, null);
  assert.equal(rec.model_attested, false);
});
