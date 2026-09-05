// drivers/test/chatgpt-cli-seam.test.mjs — ChatGPT/Codex subscription driver.
// Hermetic: injected runCodexCli, no subprocess.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  runAgent, familyToDriverName, listDrivers, makeRoleRoutedAgent,
} from '../index.mjs';
import {
  buildCodexExecArgs,
  classifyCodexFailure,
  defaultRunCodexCli,
  isPlausibleCodexModelId,
  makeChatgptCliAgentSeam,
  parseCodexJsonl,
  parseCodexModelCatalog,
  preflightCodexSubscription,
  resolveCodexCliModel,
  resolveCodexReasoningEffort,
  resolveCodexSandbox,
  subscriptionOnlyEnv,
} from '../chatgpt-cli.mjs';

test('family chatgpt/codex maps to chatgpt-cli, not openai HTTP', () => {
  assert.equal(familyToDriverName('chatgpt'), 'chatgpt-cli');
  assert.equal(familyToDriverName('codex'), 'chatgpt-cli');
  assert.equal(familyToDriverName('openai'), null);
  assert.ok(listDrivers().includes('chatgpt-cli'));
  assert.ok(listDrivers().includes('openai'));
});

test('chatgpt-cli seam, no schema: returns plain text via injected runCodexCli', async () => {
  const out = await runAgent({
    driver: 'chatgpt-cli', prompt: 'say hi',
    runCodexCli: async () => ({ text: 'hello from codex', rec: { ok: true } }),
  });
  assert.equal(out, 'hello from codex');
});

test('chatgpt-cli seam + schema: parses JSON', async () => {
  const out = await runAgent({
    driver: 'chatgpt-cli', prompt: 'gate',
    schema: { type: 'object', properties: { passed: { type: 'boolean' } }, required: ['passed'] },
    runCodexCli: async () => ({ text: '{"passed":true}', rec: { ok: true } }),
  });
  assert.equal(out.passed, true);
});

test('plausible Codex model ids reject other families', () => {
  assert.equal(isPlausibleCodexModelId('gpt-5-codex'), true);
  assert.equal(isPlausibleCodexModelId('grok-4.5'), false);
  assert.equal(isPlausibleCodexModelId('claude-fable-5'), false);
  assert.equal(resolveCodexCliModel({}), null);
});

test('heavy ChatGPT resolves Sol + Ultra and never treats Ultra as a guessed model id', () => {
  const env = { TRIO_TIER: 'heavy' };
  assert.equal(resolveCodexCliModel({ env }), 'gpt-5.6-sol');
  assert.equal(resolveCodexReasoningEffort({ env }), 'ultra');
  assert.equal(resolveCodexReasoningEffort({ env: {}, reasoningEffort: 'max' }), 'max');
  assert.throws(
    () => resolveCodexReasoningEffort({ env: {}, reasoningEffort: 'legendary' }),
    /unsupported Codex reasoning effort/,
  );
});

test('Codex argv is ephemeral, config-isolated, prompt-on-stdin, read-only, JSONL, and Ultra', () => {
  const args = buildCodexExecArgs({
    model: 'gpt-5.6-sol', reasoningEffort: 'ultra', sandbox: 'read-only', target: 'C:\\work',
  });
  assert.deepEqual(args.slice(0, 2), ['exec', '--skip-git-repo-check']);
  for (const required of ['--ephemeral', '--ignore-user-config', '--strict-config', '--json']) {
    assert.ok(args.includes(required), `missing ${required}`);
  }
  assert.deepEqual(args.slice(-1), ['-'], 'prompt must ride stdin, never argv');
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  assert.equal(args[args.indexOf('--model') + 1], 'gpt-5.6-sol');
  assert.ok(args.includes('model_reasoning_effort="ultra"'));
  assert.ok(args.includes('approval_policy="never"'));
  assert.throws(
    () => buildCodexExecArgs({ sandbox: 'danger-full-access' }),
    /unsupported Codex sandbox/,
  );
});

test('Codex write seats on Windows select the unelevated Windows sandbox inline (2026-09-01: --ignore-user-config dropped it and every execute seat was silently read-only)', () => {
  const win = buildCodexExecArgs({ sandbox: 'workspace-write', target: 'C:\\work', platform: 'win32' });
  assert.equal(win[win.indexOf('--sandbox') + 1], 'workspace-write');
  assert.ok(win.includes('windows.sandbox="unelevated"'), 'workspace-write on win32 must name a Windows sandbox');
  assert.ok(win.includes('--ignore-user-config'), 'user config stays ignored — the override is inline, not inherited');
  const winRo = buildCodexExecArgs({ sandbox: 'read-only', target: 'C:\\work', platform: 'win32' });
  assert.ok(!winRo.includes('windows.sandbox="unelevated"'), 'read-only seats never widen');
  const posix = buildCodexExecArgs({ sandbox: 'workspace-write', target: '/work', platform: 'linux' });
  assert.ok(!posix.includes('windows.sandbox="unelevated"'), 'POSIX argv is unchanged');
});

test('Codex sandbox is role-aware and restricted to least-privilege production values', () => {
  assert.equal(resolveCodexSandbox({ role: 'reviewer', env: {} }), 'read-only');
  assert.equal(resolveCodexSandbox({
    role: 'judge', sandbox: 'workspace-write', env: { CODEX_CLI_SANDBOX: 'workspace-write' },
  }), 'read-only', 'verification role outranks explicit and environment write posture');
  assert.equal(resolveCodexSandbox({
    role: 'analysis', env: { CODEX_CLI_SANDBOX: 'workspace-write' },
  }), 'read-only', 'verification role cannot inherit an environment write posture');
  assert.equal(resolveCodexSandbox({ role: 'execute', env: {} }), 'workspace-write');
  assert.equal(resolveCodexSandbox({ role: 'fix', env: {} }), 'workspace-write');
  assert.throws(
    () => resolveCodexSandbox({ sandbox: 'danger-full-access', env: {} }),
    /unsupported Codex sandbox/,
  );
});

test('subscription-only child env scrubs API credentials and endpoint overrides', () => {
  const clean = subscriptionOnlyEnv({
    PATH: 'ok', OPENAI_API_KEY: 'secret', CODEX_API_KEY: 'secret2',
    CODEX_ACCESS_TOKEN: 'secret3', OPENAI_BASE_URL: 'https://example.invalid',
  });
  assert.equal(clean.PATH, 'ok');
  for (const key of ['OPENAI_API_KEY', 'CODEX_API_KEY', 'CODEX_ACCESS_TOKEN', 'OPENAI_BASE_URL']) {
    assert.equal(clean[key], undefined, `${key} must not reach codex.exe`);
  }
  assert.equal(clean.CI, '1');
});

test('installed-model catalog parser proves Ultra capability without retaining catalog prose', () => {
  const models = parseCodexModelCatalog(JSON.stringify({ models: [{
    slug: 'gpt-5.6-sol',
    description: 'large prose that must not enter a receipt',
    supported_reasoning_levels: [{ effort: 'max' }, { effort: 'ultra' }],
  }] }));
  assert.deepEqual(models, [{ slug: 'gpt-5.6-sol', efforts: ['max', 'ultra'] }]);
});

test('preflight distinguishes subscription auth, missing Ultra, and transient spawn failures', () => {
  const authOnly = preflightCodexSubscription({
    cmd: 'fake-codex', model: 'gpt-5.6-sol', effort: 'ultra', env: {}, cache: new Map(),
    spawnSyncImpl: () => ({ status: 0, stdout: 'Logged in using an API key', stderr: '' }),
  });
  assert.equal(authOnly.status, 'subscription_auth_required');
  assert.equal(authOnly.subscription_auth, false);

  let catalogCalls = 0;
  const noUltra = preflightCodexSubscription({
    cmd: 'fake-codex', model: 'gpt-5.6-sol', effort: 'ultra', env: {}, cache: new Map(),
    spawnSyncImpl: (_cmd, args) => {
      catalogCalls += 1;
      if (args[0] === 'login') return { status: 0, stdout: 'Logged in using ChatGPT', stderr: '' };
      return {
        status: 0, stderr: '',
        stdout: JSON.stringify({ models: [{
          slug: 'gpt-5.6-sol', supported_reasoning_levels: [{ effort: 'max' }],
        }] }),
      };
    },
  });
  assert.equal(catalogCalls, 2);
  assert.equal(noUltra.status, 'capability_unavailable');
  assert.equal(noUltra.subscription_auth, true);

  let timeoutCalls = 0;
  const transientCache = new Map();
  const timeoutProbe = () => preflightCodexSubscription({
    cmd: 'fake-codex-timeout', model: 'gpt-5.6-sol', effort: 'ultra', env: {},
    cache: transientCache,
    spawnSyncImpl: () => {
      timeoutCalls += 1;
      return { status: null, stdout: '', stderr: '', error: Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }) };
    },
  });
  assert.equal(timeoutProbe().status, 'preflight_timeout');
  assert.equal(timeoutProbe().status, 'preflight_timeout');
  assert.equal(timeoutCalls, 2, 'negative preflights must not be cached for process lifetime');
  assert.equal(transientCache.size, 0);
});

test('Codex JSONL parser returns only final answer, thread, and numeric usage', () => {
  const parsed = parseCodexJsonl([
    JSON.stringify({ type: 'thread.started', thread_id: 'thread-1' }),
    JSON.stringify({ type: 'turn.started' }),
    JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'BOUND_OK' } }),
    JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 12, output_tokens: 3 } }),
  ].join('\n'));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.text, 'BOUND_OK');
  assert.equal(parsed.thread_id, 'thread-1');
  assert.deepEqual(parsed.usage, {
    input_tokens: 12, cached_input_tokens: 0, cache_write_input_tokens: 0,
    output_tokens: 3, reasoning_output_tokens: 0,
  });
});

test('usage limits are typed distinctly from ordinary CLI failures', () => {
  assert.equal(classifyCodexFailure('429: usage limit reached'), 'usage_limit');
  assert.equal(classifyCodexFailure('Not logged in'), 'auth_error');
  assert.equal(classifyCodexFailure('process crashed'), 'cli_error');
});

test('failed transport receipt rejects instead of laundering empty output', async () => {
  const { agent } = makeChatgptCliAgentSeam({
    runCodexCli: async () => ({
      text: '', rec: { ok: false, status: 'usage_limit', requested_model: 'gpt-5.6-sol' },
    }),
  });
  await assert.rejects(() => agent('work'), (error) => {
    assert.equal(error.seat_unavailable, true);
    assert.equal(error.seat_status, 'usage_limit');
    return true;
  });
});

test('supervisor cancellation propagates and never triggers a Claude failover', async () => {
  let codexCalls = 0;
  let claudeCalls = 0;
  await assert.rejects(
    () => runAgent({
      driver: 'chatgpt-cli', prompt: 'cancelled work',
      runCodexCli: async () => {
        codexCalls += 1;
        return { text: '', rec: { ok: false, status: 'aborted', aborted: true } };
      },
      runClaude: async () => {
        claudeCalls += 1;
        return 'must not run';
      },
    }),
    (error) => error.aborted === true && error.seat_unavailable !== true,
  );
  assert.equal(codexCalls, 1);
  assert.equal(claudeCalls, 0);
});

test('role-routed wrapper preserves cancellation and receipt callbacks', async () => {
  const controller = new AbortController();
  const receipts = [];
  let observedSignal = null;
  const agent = makeRoleRoutedAgent({
    routes: { synthesizer: { driver: 'chatgpt-cli' } },
    env: {},
    runCodexCli: async (_prompt, _label, opts) => {
      observedSignal = opts.signal;
      return { text: 'routed', rec: { ok: true, status: 'success' } };
    },
  });
  assert.equal(await agent('work', {
    role: 'synthesizer', signal: controller.signal, onReceipt: (rec) => receipts.push(rec),
  }), 'routed');
  assert.equal(observedSignal, controller.signal);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].status, 'success');
});

test('production verification roles run READ-ONLY after preflight and stamp the model unattested (John 2026-09-05)', async () => {
  let preflightCalls = 0;
  let seenArgs = null;
  const jsonl = [
    JSON.stringify({ type: 'thread.started', thread_id: 't-1' }),
    JSON.stringify({ type: 'turn.started' }),
    JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'VERDICT' } }),
    JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 5, output_tokens: 2 } }),
  ].join('\n');
  const result = await defaultRunCodexCli('review this', 'reviewer:preflight', {
    env: { CRUCIBLE_AGENT_LIVE: '1', TRIO_TIER: 'heavy' },
    role: 'reviewer',
    preflightImpl: () => {
      preflightCalls += 1;
      return { ok: true, status: 'ready', auth: 'chatgpt', subscription_auth: true, model: 'gpt-5.6', effort: 'high' };
    },
    processRunner: async ({ args }) => {
      seenArgs = args;
      return { stdout: jsonl, stderr: '', code: 0, terminal: 'closed', kill_status: null };
    },
  });
  assert.equal(preflightCalls, 1, 'preflight runs for a verification seat too');
  assert.ok(Array.isArray(seenArgs), 'the seat spawns');
  assert.equal(seenArgs[seenArgs.indexOf('--sandbox') + 1], 'read-only', 'a reviewer never writes');
  assert.equal(result.text, 'VERDICT');
  assert.equal(result.rec.ok, true);
  assert.equal(result.rec.model_family, 'chatgpt');
  assert.equal(result.rec.family_attested, true);
  assert.equal(result.rec.model_attested, false, 'Codex names no served model — stamped, not refused');
});

test('coding seat emits honest unattested receipt; verification seat is accepted with the model-unattested stamp (John 2026-09-05)', async () => {
  const receipts = [];
  const runCodexCli = async () => ({
    text: 'answer',
    rec: {
      ok: true, status: 'success', requested_model: 'gpt-5.6-sol',
      model_family: 'chatgpt', family_attested: true,
      model_served: null, model_attested: false, degraded: true,
    },
  });
  assert.equal(await runAgent({
    driver: 'chatgpt-cli', prompt: 'work', role: 'synthesizer', runCodexCli,
    onReceipt: (receipt) => receipts.push(receipt),
  }), 'answer');
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].schema, 'trio.seat.v1');
  assert.equal(receipts[0].served.family, 'chatgpt');
  assert.equal(receipts[0].served.model, null);
  assert.equal(receipts[0].served.model_attested, false);
  // ChatGPT reviews: family attested by the binary, model unattested — stamped, said, accepted.
  const said = [];
  assert.equal(await runAgent({
    driver: 'chatgpt-cli', prompt: 'review', role: 'reviewer', runCodexCli,
    onReceipt: (receipt) => receipts.push(receipt), log: (m) => said.push(m),
  }), 'answer');
  const rv = receipts[1];
  assert.equal(rv.status, 'success');
  assert.equal(rv.verification, true);
  assert.equal(rv.served.family, 'chatgpt');
  assert.equal(rv.served.family_attested, true);
  assert.equal(rv.served.model_attested, false);
  assert.ok(said.some((m) => /UNATTESTED model/.test(m)), 'the acceptance is said aloud');
  assert.equal(await runAgent({
    driver: 'chatgpt-cli', prompt: 'review', label: 'reviewer:derived', runCodexCli,
    onReceipt: (receipt) => receipts.push(receipt),
  }), 'answer');
  assert.equal(receipts[2].role, 'reviewer');
  assert.equal(receipts[2].served.model_attested, false);
  // a seat that cannot attest its FAMILY still fails closed
  const noFamily = async () => ({ text: 'x', rec: { ok: true, status: 'success', requested_model: 'm',
    model_family: null, family_attested: false, model_served: null, model_attested: false, degraded: true } });
  await assert.rejects(
    () => runAgent({ driver: 'chatgpt-cli', prompt: 'review', role: 'reviewer', runCodexCli: noFamily }),
    (error) => error.receipt.status === 'verification_fail_closed'
      && error.receipt.attempts[0].error.code === 'served_unattested',
  );
});
