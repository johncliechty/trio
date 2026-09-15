/**
 * Hermetic transport integration: every provider, policy probe and Codex auth
 * preflight is injected. CRUCIBLE_AGENT_LIVE enables the adapter code path only;
 * these tests must never launch a native CLI, authenticate, or generate a turn.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultRunCodexCli } from '../chatgpt-cli.mjs';
import { defaultRunGrokCli } from '../grok-cli.mjs';
import { defaultRunClaude } from '../claude.mjs';
import { PolicyUnavailable } from '../model-policy.mjs';

const POLICY = { mode: 'latest_supported', effort: 'highest_supported' };
const PROVIDERS = [
  { family: 'chatgpt', run: defaultRunCodexCli, model: 'gpt-synthetic-current', effort: 'ultra' },
  { family: 'grok', run: defaultRunGrokCli, model: 'grok-synthetic-current', effort: 'xhigh' },
  { family: 'claude', run: defaultRunClaude, model: 'claude-synthetic-current', effort: 'max' },
];

test('capability rejection has a replay-safe prelaunch receipt and no served-model claim', () => {
  const error = new PolicyUnavailable('chatgpt', 'Synthetic unavailable capability.', 'synthetic_capability_unavailable');
  assert.equal(error.seat_unavailable, true);
  assert.equal(error.seat_status, 'synthetic_capability_unavailable');
  assert.deepEqual(error.raw_receipt, {
    ok: false, status: 'synthetic_capability_unavailable', error: error.message,
    replay_safe: true, model_served: null, model_attested: false, family_attested: false,
  });
});

function stdoutFor(family) {
  if (family === 'chatgpt') return [
    { type: 'thread.started', thread_id: 'synthetic-hermetic-thread' },
    { type: 'item.completed', item: { id: 'synthetic-message', type: 'agent_message', text: 'ok' } },
    { type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1 } },
  ].map(item => JSON.stringify(item)).join('\n') + '\n';
  if (family === 'grok') return JSON.stringify({
    text: 'ok', modelUsage: { 'grok-synthetic-served': {} }, stopReason: 'end_turn',
  });
  return [
    { type: 'system', subtype: 'init', model: 'claude-synthetic-served', session_id: '00000000-0000-4000-8000-000000000001' },
    { type: 'result', subtype: 'success', is_error: false, result: 'ok', session_id: '00000000-0000-4000-8000-000000000001' },
  ].map(item => JSON.stringify(item)).join('\n') + '\n';
}

function flagValue(args, names) {
  for (let index = 0; index < args.length; index++) {
    for (const name of names) {
      if (args[index] === name) return args[index + 1];
      if (args[index].startsWith(`${name}=`)) return args[index].slice(name.length + 1);
    }
  }
  return undefined;
}

function allowedTools(args) {
  const names = ['--allowedTools', '--allowed-tools'];
  const result = [];
  for (let index = 0; index < args.length; index++) {
    if (names.includes(args[index])) {
      for (let next = index + 1; next < args.length && !args[next].startsWith('-'); next++) {
        result.push(...args[next].split(/[\s,]+/).filter(Boolean));
      }
    } else {
      for (const name of names) {
        if (args[index].startsWith(`${name}=`)) result.push(...args[index].slice(name.length + 1).split(/[\s,]+/).filter(Boolean));
      }
    }
  }
  return [...new Set(result)].sort();
}

async function runInjected(provider, role) {
  const processCalls = [];
  const policyCalls = [];
  const preflightCalls = [];
  const env = {
    CRUCIBLE_AGENT_LIVE: '1',
    CODEX_CLI_CMD: 'synthetic-codex-command-never-executed',
    PATH: '',
    OPENAI_API_KEY: 'synthetic-api-key-never-used',
    ANTHROPIC_API_KEY: 'synthetic-api-key-never-used',
    XAI_API_KEY: 'synthetic-api-key-never-used',
    GEMINI_API_KEY: 'synthetic-api-key-never-used',
    CLAUDE_CODE_OAUTH_TOKEN: 'synthetic-subscription-identity-preserved',
    CODEX_MODEL: 'synthetic-stale-env-model',
    OPENAI_MODEL: 'synthetic-stale-env-model',
    GROK_MODEL: 'synthetic-stale-env-model',
    GROK_DEFAULT_MODEL: 'synthetic-stale-env-model',
    ANTHROPIC_MODEL: 'synthetic-stale-env-model',
    ANTHROPIC_DEFAULT_FABLE_MODEL: 'synthetic-stale-env-model',
    CLAUDE_MODEL: 'synthetic-stale-env-model',
    CLAUDE_CODE_EFFORT_LEVEL: 'low',
    CODEX_REASONING_EFFORT: 'low',
    TRIO_MODEL_REVIEW: 'synthetic-stale-env-model',
    TRIO_DRIVER_CODING: 'synthetic-stale-family',
    CODEX_APPROVAL_POLICY: 'never',
    CODEX_SANDBOX_MODE: role === 'review' ? 'read-only' : 'workspace-write',
    CUSTOM_PERMISSION_SCOPE_FIXTURE: 'preserve-this-permission-setting',
  };
  const selection = {
    family: provider.family, model: provider.model, effort: provider.effort,
    policy_version: 1, requested_policy: { ...POLICY },
    selection_evidence: 'synthetic-hermetic-capability-catalog',
    settings_revision: 17, discovered_at: new Date().toISOString(), model_attested: false,
  };
  const processRunner = async request => {
    processCalls.push(request);
    return { stdout: stdoutFor(provider.family), stderr: '', terminal: 'closed', code: 0, kill_status: 'not_needed' };
  };
  const policyResolver = (family, options) => {
    policyCalls.push({ family, options });
    assert.equal(family, provider.family);
    return { ...selection, requested_policy: { ...selection.requested_policy } };
  };
  const preflightImpl = request => {
    preflightCalls.push(request);
    return { ok: true, subscription_auth: true };
  };
  // LIVE is never supplied without the complete injection set below.
  const result = await provider.run('Return the literal text ok. This is an injected transport fixture.', `hermetic-policy-${provider.family}-${role}`, {
    env, target: process.cwd(), role, platform: 'win32',
    model: 'synthetic-stale-explicit-model', reasoningEffort: 'low', tier: 'regular',
    timeoutMs: 1_000, log: () => {},
    processRunner, policyResolver, preflightImpl,
  });
  assert.equal(processCalls.length, 1, 'Exactly one injected process runner call is expected; no retries or native fallback.');
  assert.equal(policyCalls.length, 1, 'A single resolved model selection must be frozen for the seat.');
  if (provider.family === 'chatgpt') assert.equal(preflightCalls.length, 1, 'Codex auth/capability preflight must use the injected implementation.');
  const request = processCalls[0];
  assert.ok(Array.isArray(request.args));
  assert.ok(request.options && request.options.env, 'The final child environment must be inspectable.');
  return { request, originalEnv: env, result };
}

function assertSelectionAndEnvironment(provider, request, originalEnv) {
  const { args, options } = request;
  const childEnv = options.env;
  assert.equal(flagValue(args, ['--model', '-m']), provider.model);
  assert.equal(args.join(' ').includes('synthetic-stale-explicit-model'), false);
  assert.equal(args.join(' ').includes('synthetic-stale-env-model'), false);
  if (provider.family === 'chatgpt') {
    for (const required of [
      'model_reasoning_effort="ultra"',
      'agents.default_subagent_model="gpt-synthetic-current"',
      'agents.default_subagent_reasoning_effort="ultra"',
      'forced_login_method="chatgpt"',
    ]) assert.ok(args.includes(required), `Codex must explicitly pass ${required}`);
  } else {
    assert.equal(flagValue(args, [provider.family === 'grok' ? '--reasoning-effort' : '--effort']), provider.effort);
  }
  for (const key of [
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'XAI_API_KEY', 'GEMINI_API_KEY',
    'CODEX_MODEL', 'OPENAI_MODEL', 'GROK_MODEL', 'GROK_DEFAULT_MODEL', 'ANTHROPIC_MODEL',
    'ANTHROPIC_DEFAULT_FABLE_MODEL', 'CLAUDE_MODEL', 'CLAUDE_CODE_EFFORT_LEVEL',
    'CODEX_REASONING_EFFORT', 'TRIO_MODEL_REVIEW', 'TRIO_DRIVER_CODING',
  ]) {
    assert.equal(childEnv[key], undefined, `${provider.family} must remove ${key} from its child environment`);
    assert.notEqual(originalEnv[key], undefined, 'Environment cleaning must not mutate the caller.');
  }
  assert.equal(childEnv.CLAUDE_CODE_OAUTH_TOKEN, 'synthetic-subscription-identity-preserved');
  assert.equal(childEnv.CUSTOM_PERMISSION_SCOPE_FIXTURE, originalEnv.CUSTOM_PERMISSION_SCOPE_FIXTURE);
  assert.equal(childEnv.CODEX_APPROVAL_POLICY, originalEnv.CODEX_APPROVAL_POLICY);
  assert.equal(childEnv.CODEX_SANDBOX_MODE, originalEnv.CODEX_SANDBOX_MODE);
  for (const forbidden of ['--dangerously-bypass-approvals-and-sandbox', '--dangerously-skip-permissions', '--yolo']) {
    assert.equal(args.includes(forbidden), false, 'Model selection must not broaden permissions.');
  }
}

for (const provider of PROVIDERS) {
  test(`${provider.family}: current policy overrides stale pins while verification remains read-only`, async () => {
    const { request, originalEnv } = await runInjected(provider, 'review');
    assertSelectionAndEnvironment(provider, request, originalEnv);
    if (provider.family === 'chatgpt') {
      assert.equal(flagValue(request.args, ['--sandbox', '-s']), 'read-only');
      assert.equal(request.args.includes('--full-auto'), false);
    } else {
      assert.equal(flagValue(request.args, ['--permission-mode']), 'plan');
      if (provider.family === 'claude') assert.deepEqual(allowedTools(request.args), ['Glob', 'Grep', 'Read']);
    }
  });

  test(`${provider.family}: latest/highest selection preserves the existing execution permission scope`, async () => {
    const { request, originalEnv } = await runInjected(provider, 'execute');
    assertSelectionAndEnvironment(provider, request, originalEnv);
    if (provider.family === 'chatgpt') {
      assert.equal(flagValue(request.args, ['--sandbox', '-s']), 'workspace-write');
      assert.ok(request.args.includes('windows.sandbox="unelevated"'));
    } else {
      assert.equal(flagValue(request.args, ['--permission-mode']), 'acceptEdits');
    }
  });
}
