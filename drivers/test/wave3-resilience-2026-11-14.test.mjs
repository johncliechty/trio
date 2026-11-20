import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  runAgent,
  registerDriver,
  getDriver,
  hostIpcDriver,
} from '../index.mjs';
import { defaultRunHostIpc } from '../host-ipc.mjs';
import {
  classifyFault,
  makeReliableAgent,
} from '../reliability.mjs';
import {
  makePerProviderBreaker,
  BreakerOpenError,
} from '../reliability-breaker.mjs';
import {
  classifySubscriptionOutcome,
} from '../subscription-outcome.mjs';
import {
  preflightSubscriptionCli,
  preflightAllSubscriptionClis,
} from '../model-policy.mjs';
import {
  defaultRunGeminiCli,
  hasAgyTerminalResult,
  buildAgyStreamArgs,
} from '../gemini-cli.mjs';
import {
  buildCodexExecArgs,
  makeChatgptCliAgentSeam,
} from '../chatgpt-cli.mjs';
import { runCliSchemaAttempts } from '../cli-schema.mjs';
import { PHYSICAL_RECEIPT_HOOK } from '../seat-contract.mjs';
import { runCloseBoundProcess } from '../subscription-process.mjs';

function makeTempProfile(t, prefs = {
  coding_family: 'gemini',
  review_family: 'claude',
  default_cli: 'chatgpt',
  settings_revision: 1,
  model_policy: { mode: 'latest_supported', effort: 'highest_supported' },
}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trio-wave3-resilience-'));
  const mirror = path.join(dir, '.anchor', 'model_prefs.json');
  fs.mkdirSync(path.dirname(mirror), { recursive: true });
  fs.writeFileSync(mirror, JSON.stringify(prefs), 'utf8');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return {
    dir,
    env: {
      USERPROFILE: dir,
      HOME: dir,
      ANCHOR_DATA_DIR: path.join(dir, 'anchor-data'),
      PATH: '',
      CRUCIBLE_AGENT_LIVE: '',
    },
  };
}

test('1. explicit opts.driver is honored while prefs still override stale TRIO_DRIVER_* env when opts.driver is omitted', async (t) => {
  const { env } = makeTempProfile(t, {
    coding_family: 'claude',
    review_family: 'claude',
    default_cli: 'claude',
    settings_revision: 1,
    model_policy: { mode: 'latest_supported', effort: 'highest_supported' },
  });
  env.TRIO_DRIVER_CODING = 'grok-cli';

  let customCalls = 0;
  registerDriver({
    name: 'wave3-custom-test-driver',
    subAgentCapable: false,
    structuredOutput: 'none',
    async runAgent(opts) {
      customCalls += 1;
      opts[PHYSICAL_RECEIPT_HOOK]?.({
        kind: 'initial',
        label: opts.label || 'execute',
        outcome: 'accepted',
        receipt: {
          ok: true, status: 'ok', model_family: 'claude',
          model_served: 'custom-v1', family_attested: true, model_attested: true,
        },
      });
      return `custom:${opts.prompt}`;
    },
  });

  // Explicit registered non-family driver name is preserved
  const customOut = await runAgent({
    driver: 'wave3-custom-test-driver',
    role: 'execute',
    prompt: 'hello',
    env,
    onRoutingEvent: async () => {},
  });
  assert.equal(customCalls, 1);
  assert.equal(customOut, 'custom:hello');

  // Explicit family driver ('chatgpt-cli') is respected even when coding_family === 'claude'
  const explicitFamilyCalls = [];
  const explicitOut = await runAgent({
    driver: 'chatgpt-cli',
    role: 'execute',
    prompt: 'explicit-chatgpt',
    env,
    runCodexCli: async () => {
      explicitFamilyCalls.push('chatgpt');
      return {
        text: 'from-chatgpt',
        rec: {
          ok: true, status: 'ok', requested_model: 'gpt-5.6-sol',
          model_served: 'gpt-5.6-sol', model_family: 'chatgpt',
          family_attested: true, model_attested: true,
        },
      };
    },
    runClaude: async () => {
      explicitFamilyCalls.push('claude');
      return { text: 'wrong', rec: { ok: true, status: 'ok', model_family: 'claude', family_attested: true, model_attested: true } };
    },
    onRoutingEvent: async () => {},
  });
  assert.deepEqual(explicitFamilyCalls, ['chatgpt']);
  assert.equal(explicitOut, 'from-chatgpt');

  // Omitting opts.driver lets Anchor prefs ('claude') override stale TRIO_DRIVER_CODING='grok-cli'
  const omittedCalls = [];
  const omittedOut = await runAgent({
    role: 'execute',
    prompt: 'omitted-driver',
    env,
    runClaude: async () => {
      omittedCalls.push('claude');
      return {
        text: 'from-claude-prefs',
        rec: {
          ok: true, status: 'ok', requested_model: 'claude-opus-5',
          model_served: 'claude-opus-5', model_family: 'claude',
          family_attested: true, model_attested: true,
        },
      };
    },
    runGrokCli: async () => {
      omittedCalls.push('grok');
      return { text: 'stale-env', rec: { ok: true, status: 'ok', model_family: 'grok', family_attested: true, model_attested: true } };
    },
    onRoutingEvent: async () => {},
  });
  assert.deepEqual(omittedCalls, ['claude']);
  assert.equal(omittedOut, 'from-claude-prefs');
});

test('2. failedSeatError attaches provider_status/classification and trips reliability.mjs circuit breakers', async (t) => {
  const { env } = makeTempProfile(t, {
    coding_family: 'claude',
    review_family: 'claude',
    default_cli: 'claude',
    settings_revision: 1,
    model_policy: { mode: 'latest_supported', effort: 'highest_supported' },
  });

  // Non-recoverable auth_expired error attaches provider_status + classification(recoverable: false)
  let authErr = null;
  try {
    await runAgent({
      driver: 'claude',
      role: 'execute',
      prompt: 'trigger auth error',
      env,
      runClaude: async () => ({
        text: '',
        rec: {
          ok: false,
          status: 'auth_expired',
          exit: 1,
          requested_model: 'claude-opus-5',
          model_family: 'claude',
          replay_safe: true,
        },
      }),
      onRoutingEvent: async () => {},
    });
  } catch (err) {
    authErr = err;
  }
  assert.ok(authErr, 'Expected runAgent to reject');
  assert.equal(authErr.provider_status, 'auth_expired');
  assert.equal(authErr.classification.recoverable, false);

  // Recoverable timeout error attaches exit/classification(recoverable: true) and trips makePerProviderBreaker!
  let timeoutErr = null;
  try {
    await runAgent({
      driver: 'claude',
      role: 'execute',
      prompt: 'trigger timeout',
      env,
      runClaude: async () => ({
        text: '',
        rec: {
          ok: false,
          status: 'timeout',
          exit: 124,
          requested_model: 'claude-opus-5',
          model_family: 'claude',
          replay_safe: true,
        },
      }),
      onRoutingEvent: async () => {},
    });
  } catch (err) {
    timeoutErr = err;
  }
  assert.ok(timeoutErr);
  assert.equal(timeoutErr.provider_status, 'timeout');
  assert.equal(timeoutErr.classification.recoverable, true);
  assert.equal(classifyFault(timeoutErr).recoverable, true);

  let physicalCalls = 0;
  const breaker = makePerProviderBreaker({ threshold: 2, cooldownMs: 60_000 });
  const reliable = makeReliableAgent({
    agent: async () => { physicalCalls += 1; throw timeoutErr; },
    breaker,
    provider: 'claude',
    maxAttempts: 2,
    sleep: async () => {},
  });
  await assert.rejects(() => reliable('probe-1'), (e) => e === timeoutErr);
  assert.equal(physicalCalls, 2, 'recoverable failedSeatError triggers typed retry');
  await assert.rejects(() => reliable('probe-2'), (e) => e === timeoutErr);
  assert.equal(breaker.stateOf('claude').state, 'open');
  await assert.rejects(() => reliable('probe-3'), (e) => e instanceof BreakerOpenError);
});

test('3. agy (gemini-cli.mjs) resolves cleanly on terminal result frame via early-grace reap without 60m hang', async () => {
  const args = buildAgyStreamArgs({ model: 'gemini-3.1-pro-high', readonly: true, timeoutMs: 120_000 });
  assert.ok(args.includes('--print-timeout'));
  assert.ok(args.includes('114s'));

  // Spawn a real Node child that writes a valid agy stream-json result frame and intentionally hangs for 30s!
  const script = [
    'process.stdout.write(JSON.stringify({ event: "init", conversation_id: "c1", init: { model: "gemini-3.1-pro-high" } }) + "\\n");',
    'process.stdout.write(JSON.stringify({ event: "result", result: { status: "SUCCESS", response: "Hello from agy", usage: { input_tokens: 12, output_tokens: 4 } } }) + "\\n");',
    'setTimeout(() => {}, 30000);',
  ].join(' ');

  const startMs = Date.now();
  const procRes = await runCloseBoundProcess({
    command: process.execPath,
    args: ['-e', script],
    timeoutMs: 20_000,
    earlyGraceMs: 200,
    shouldCompleteEarly: hasAgyTerminalResult,
  });
  const elapsedMs = Date.now() - startMs;
  assert.ok(elapsedMs < 4000, `Expected early-grace reap < 4s, got ${elapsedMs}ms`);
  assert.equal(procRes.reaped_after_result, true);
  assert.equal(procRes.terminal, 'closed');

  // Also verify defaultRunGeminiCli preserves a valid SUCCESS result frame even if terminal==='timeout' on the wrapper
  const gemOut = await defaultRunGeminiCli('test prompt', 'gem-linger-test', {
    env: { CRUCIBLE_AGENT_LIVE: '1' },
    model: 'gemini-3.1-pro-high',
    timeoutMs: 30_000,
    processRunner: async () => ({
      code: null,
      terminal: 'timeout',
      completed_early: false,
      kill_status: 'killed',
      spawned: true,
      stdout: [
        JSON.stringify({ event: 'init', conversation_id: 'c2', init: { model: 'gemini-3.1-pro-high' } }),
        JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'Verified response', usage: { input_tokens: 50, output_tokens: 10 } } }),
      ].join('\n'),
      stderr: '',
    }),
  });
  assert.equal(gemOut.rec.ok, true);
  assert.equal(gemOut.rec.status, 'success');
  assert.equal(gemOut.text, 'Verified response');
  assert.equal(gemOut.rec.model_served, 'gemini-3.1-pro-high');
});

test('4. auth preflight across all 4 subscription CLIs surfaces auth_expired before Wave 1 starts', () => {
  const mkSpawn = (byCmd) => (cmd) => {
    const base = path.basename(String(cmd)).toLowerCase();
    for (const [needle, resp] of Object.entries(byCmd)) {
      if (base.includes(needle)) return resp;
    }
    return { status: 0, stdout: '{}', stderr: '' };
  };

  const spawnSyncImpl = mkSpawn({
    claude: { status: 0, stdout: JSON.stringify({ loggedIn: false, authMethod: 'none' }), stderr: '' },
    codex: { status: 0, stdout: 'Logged in using ChatGPT', stderr: '' },
    agy: { status: 0, stdout: 'gemini-3.1-pro-high', stderr: '' },
    grok: { status: 1, stdout: '', stderr: 'Error: not logged in. Run grok login.' },
  });

  const claudeCheck = preflightSubscriptionCli('claude', {
    spawnSyncImpl,
    executable: 'C:\\fake\\claude.exe',
  });
  assert.equal(claudeCheck.ok, false);
  assert.equal(claudeCheck.status, 'auth_expired');
  assert.equal(claudeCheck.login_required, true);

  const all = preflightAllSubscriptionClis(['claude', 'chatgpt', 'gemini', 'grok'], {
    spawnSyncImpl,
    executables: {
      claude: 'C:\\fake\\claude.exe',
      chatgpt: 'C:\\fake\\codex.exe',
      gemini: 'C:\\fake\\agy.exe',
      grok: 'C:\\fake\\grok.exe',
    },
  });
  assert.equal(all.ok, false);
  assert.equal(all.byFamily.claude.status, 'auth_expired');
  assert.equal(all.byFamily.chatgpt.ok, true);
  assert.equal(all.byFamily.gemini.ok, true);
  assert.equal(all.byFamily.grok.status, 'auth_expired');
});

test('5. Claude OAuth expiry & Grok Build usage limit regexes + 3rd-family review failover skipping coding_family', async (t) => {
  const claudeOutcome = classifySubscriptionOutcome({
    family: 'claude',
    code: 1,
    terminal: 'closed',
    kill_status: null,
    spawned: true,
    stdout: [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: 's1' }),
      JSON.stringify({
        type: 'result',
        session_id: 's1',
        is_error: true,
        subtype: 'error_during_execution',
        num_turns: 0,
        usage: { output_tokens: 0 },
        errors: ['OAuth session has expired. Please run claude login.'],
      }),
    ].join('\n'),
    stderr: '',
  });
  assert.equal(claudeOutcome.failure_status, 'auth_error');
  assert.equal(claudeOutcome.replay_safe, true);

  const grokOutcome = classifySubscriptionOutcome({
    family: 'grok',
    code: 1,
    terminal: 'closed',
    kill_status: null,
    spawned: true,
    stdout: JSON.stringify({
      type: 'result',
      is_error: true,
      stopReason: 'error',
      errors: ['You have reached your free Grok Build usage limit.'],
    }),
    stderr: '',
  });
  assert.equal(grokOutcome.failure_status, 'usage_limit');

  // coding_family = 'gemini', review_family = 'claude', default_cli = 'chatgpt'
  const { env } = makeTempProfile(t, {
    coding_family: 'gemini',
    review_family: 'claude',
    default_cli: 'chatgpt',
    settings_revision: 7,
    model_policy: { mode: 'latest_supported', effort: 'highest_supported' },
  });
  const calls = [];
  const receipts = [];
  const routingEvents = [];
  const out = await runAgent({
    role: 'review',
    prompt: 'Review Wave 1 diff',
    env,
    runClaude: async () => {
      calls.push('claude');
      return {
        text: '',
        rec: {
          ok: false, status: 'auth_expired', requested_model: 'claude-opus-5',
          model_family: 'claude', replay_safe: true,
        },
      };
    },
    runGeminiCli: async () => {
      calls.push('gemini');
      return {
        text: '{"go":true}',
        rec: { ok: true, status: 'ok', model_family: 'gemini', model_served: 'gemini-3.1-pro-high', family_attested: true, model_attested: true },
      };
    },
    runCodexCli: async () => {
      calls.push('chatgpt');
      return {
        text: '{"go":true,"blockers":[]}',
        rec: {
          ok: true, status: 'ok', requested_model: 'gpt-5.6-sol',
          model_served: 'gpt-5.6-sol', model_family: 'chatgpt',
          family_attested: true, model_attested: true,
        },
      };
    },
    onRoutingEvent: async (ev) => { routingEvents.push(ev); },
    onReceipt: async (r) => { receipts.push(r); },
  });

  // Must skip coding_family ('gemini') and land on healthy 3rd family ('chatgpt')!
  assert.deepEqual(calls, ['claude', 'chatgpt']);
  assert.equal(out, '{"go":true,"blockers":[]}');
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].status, 'success_after_failover');
  assert.equal(receipts[0].served.family, 'chatgpt');
  assert.equal(receipts[0].served.model, 'gpt-5.6-sol');
  assert.ok(routingEvents.some((e) => e.action === 'failover' && e.to_family === 'chatgpt'));
});

test('6. chatgpt-cli passes --output-schema in os.tmpdir() with zero worktree pollution + cli-schema runs fast zero-tool repair', async (t) => {
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'trio-clean-wt-'));
  t.after(() => fs.rmSync(worktree, { recursive: true, force: true }));

  const argsWithSchema = buildCodexExecArgs({
    model: 'gpt-5.6-sol',
    reasoningEffort: 'xhigh',
    sandbox: 'read-only',
    outputSchemaPath: path.join(os.tmpdir(), 'codex-schema-test.json'),
  });
  const idx = argsWithSchema.indexOf('--output-schema');
  assert.ok(idx >= 0);
  assert.equal(argsWithSchema[idx + 1], path.join(os.tmpdir(), 'codex-schema-test.json'));

  // Verify fast zero-tool JSON repair when first response > 50 chars fails JSON.parse
  const calls = [];
  const schema = {
    type: 'object',
    required: ['go', 'blockers'],
    properties: {
      go: { type: 'boolean' },
      blockers: { type: 'array' },
    },
  };
  const repaired = await runCliSchemaAttempts({
    prompt: 'Full cold-repo review prompt',
    schema,
    label: 'review-fast-repair',
    callOpts: { target: worktree, timeoutMs: 600_000 },
    parse: (txt) => {
      try { return JSON.parse(txt); } catch { return null; }
    },
    run: async (_prompt, _label, turnOpts) => {
      calls.push(turnOpts);
      if (calls.length === 1) {
        return {
          text: 'Here is my detailed review of the changes: everything passes cleanly with zero repro-backed blockers, go is true!',
          rec: { ok: true, status: 'ok' },
        };
      }
      return {
        text: '{"go":true,"blockers":[]}',
        rec: { ok: true, status: 'ok' },
      };
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].repairOnly, true);
  assert.equal(calls[1].allowedTools, '');
  assert.equal(calls[1].sandbox, 'read-only');
  assert.ok(calls[1].timeoutMs <= 60_000);
  assert.deepEqual(repaired, { go: true, blockers: [] });
  assert.deepEqual(fs.readdirSync(worktree), [], 'Worktree must have zero .provider-schema-* pollution');

  // Also check makeChatgptCliAgentSeam passes jsonSchema cleanly
  let seenSchema = null;
  const { agent: seamAgent } = makeChatgptCliAgentSeam({
    target: worktree,
    runCodexCli: async (_prompt, _label, opts) => {
      seenSchema = opts.jsonSchema;
      return {
        text: '{"go":true,"blockers":[]}',
        rec: { ok: true, status: 'ok', model_family: 'chatgpt', model_served: 'gpt-5.6-sol' },
      };
    },
  });
  const seamOut = await seamAgent('check', { schema });
  assert.deepEqual(seenSchema, schema);
  assert.deepEqual(seamOut, { go: true, blockers: [] });
});

test('7. first-class host-ipc driver writes atomic req-<id>.json, extends lease on hb-<id>.json, and parses resp-<id>.json', async (t) => {
  assert.equal(getDriver('host-ipc'), hostIpcDriver);
  const ipcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trio-host-ipc-'));
  t.after(() => fs.rmSync(ipcDir, { recursive: true, force: true }));

  // Simulate an external host watcher answering req-<id>.json atomically
  const responder = (async () => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const files = fs.readdirSync(ipcDir).filter((f) => f.startsWith('req-') && f.endsWith('.json'));
      if (files.length > 0) {
        const reqFile = files[0];
        const id = reqFile.slice('req-'.length, -'.json'.length);
        const req = JSON.parse(fs.readFileSync(path.join(ipcDir, reqFile), 'utf8'));
        fs.writeFileSync(path.join(ipcDir, `hb-${id}.json`), JSON.stringify({ ts: new Date().toISOString() }), 'utf8');
        const tmpResp = path.join(ipcDir, `.tmp-resp-${id}.json`);
        fs.writeFileSync(tmpResp, JSON.stringify({
          id,
          ok: true,
          status: 'ok',
          text: `IPC handled role=${req.role}`,
          model_served: 'host-delegate-v1',
          model_family: 'claude',
          tokens_in: 120,
          tokens_out: 45,
          cost_usd: 0.01,
        }), 'utf8');
        fs.renameSync(tmpResp, path.join(ipcDir, `resp-${id}.json`));
        return;
      }
      await new Promise((r) => setTimeout(r, 20));
    }
  })();

  const receipts = [];
  const res = await runAgent({
    driver: 'host-ipc',
    ipcDir,
    role: 'review',
    prompt: 'Review IPC turn',
    pollIntervalMs: 20,
    timeoutMs: 4000,
    onReceipt: (rec) => receipts.push(rec),
    onRoutingEvent: async () => {},
  });
  await responder;

  assert.equal(res, 'IPC handled role=review');
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].requested.driver, 'host-ipc');
  assert.equal(receipts[0].served.model, 'host-delegate-v1');
  assert.equal(receipts[0].ok, true);

  // Also check defaultRunHostIpc directly for token & cost receipt fields
  const responder2 = (async () => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const files = fs.readdirSync(ipcDir).filter((f) => f.startsWith('req-') && f.endsWith('.json'));
      if (files.length > 0) {
        const id = files[0].slice('req-'.length, -'.json'.length);
        const tmp = path.join(ipcDir, `.tmp-resp-${id}.json`);
        fs.writeFileSync(tmp, JSON.stringify({
          id, ok: true, text: 'direct-ok', model_served: 'host-delegate-v2', model_family: 'claude',
          usage: { input_tokens: 120, output_tokens: 45 }, cost_usd: 0.01,
        }), 'utf8');
        fs.renameSync(tmp, path.join(ipcDir, `resp-${id}.json`));
        return;
      }
      await new Promise((r) => setTimeout(r, 20));
    }
  })();
  const direct = await defaultRunHostIpc('ping', 'ipc-direct', { ipcDir, pollIntervalMs: 20, timeoutMs: 4000 });
  await responder2;
  assert.equal(direct.text, 'direct-ok');
  assert.equal(direct.rec.input_tokens, 120);
  assert.equal(direct.rec.output_tokens, 45);
  assert.equal(direct.rec.cost_usd, 0.01);
});
