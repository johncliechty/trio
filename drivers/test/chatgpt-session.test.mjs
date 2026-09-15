// Hermetic public-API protocol peer. No CLI, server, auth file or model calls.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDataSession, runAgent, resolveDriverFromFamilies, VERIFICATION_ROLES } from '../index.mjs';
import { DATA_SESSION_DISABLED_FEATURES } from '../chatgpt-session.mjs';
import { defaultRunCodexCli } from '../chatgpt-cli.mjs';

const model = 'gpt-6-astra'; // explicit test request, never production policy
const scalar = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false };
const request = { prompt: 'Extract the supplied data.', schema: scalar };
const dataPrefsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'data-session-default-prefs-'));
fs.writeFileSync(path.join(dataPrefsDir, 'settings.json'), JSON.stringify({ coding_family: 'chatgpt', review_family: 'grok', default_cli: 'chatgpt' }));
after(() => fs.rmSync(dataPrefsDir, { recursive: true, force: true }));
const sceneSchema = (heading, key) => ({ type: 'object', additionalProperties: false,
  required: ['heading', key], properties: { heading: { type: 'string', const: heading },
    [key]: { type: 'array', minItems: 1, items: { type: 'string' } } } });
const evidenceSchema = { type: 'object', additionalProperties: false, required: ['rows'], properties: {
  rows: { type: 'array', minItems: 2, items: { type: 'object', additionalProperties: false,
    required: ['idea', 'scene', 'evidence'], properties: { idea: { type: 'string' }, scene: { type: 'string' }, evidence: { type: 'string' } } } },
} };

function assertLaunchIsolation(spawned) {
  const expectedFeatures = ['shell_tool', 'unified_exec', 'apps', 'plugins', 'hooks', 'multi_agent',
    'remote_plugin', 'workspace_dependencies', 'browser_use', 'computer_use',
    'image_generation', 'code_mode_host', 'view_image', 'skill_search', 'tool_suggest'];
  assert.deepEqual(spawned.args.filter((arg, i, args) => args[i - 1] === '--disable'), expectedFeatures);
  assert.equal(spawned.args.includes('--enable'), false);
  const configs = spawned.args.filter((arg, i, args) => args[i - 1] === '-c');
  for (const config of ['mcp_servers={}', 'web_search="disabled"', 'sandbox_mode="read-only"',
    'approval_policy="never"', 'forced_login_method="chatgpt"']) assert.ok(configs.includes(config), config);
  assert.equal(spawned.options.shell, false);
  assert.equal(spawned.options.windowsHide, true);
}

function fakePeer(settings = {}) {
  const child = new EventEmitter();
  child.pid = 43127;
  child.stdin = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin.destroyed = false;
  child.stdin.writableEnded = false;
  const peer = { child, spawns: [], calls: [], denials: [], kills: 0, turns: 0, closed: false };
  peer.emit = (message) => child.stdout.emit('data', Buffer.from(JSON.stringify(message) + '\n'));
  peer.raw = (text) => child.stdout.emit('data', Buffer.from(text));
  peer.close = () => {
    if (peer.closed) return;
    peer.closed = true;
    child.exitCode = 0;
    child.stdout.emit('end');
    child.emit('close', 0, null);
  };
  peer.finish = (id, value = { ok: true }, extra = {}) => {
    const item = { type: 'agentMessage', phase: 'final_answer', id: `answer-${id}`, text: JSON.stringify(value), ...extra.item };
    peer.emit({ method: 'item/completed', params: { threadId: 'thread-data', turnId: id, item, ...extra.ids } });
    peer.emit({ method: 'turn/completed', params: { threadId: 'thread-data', turn: { id, status: 'completed', error: null, items: [item], ...extra.turn }, ...extra.completedParams } });
  };
  const reply = (msg, result) => peer.emit({ id: msg.id, result });
  child.stdin.write = (line, callback) => {
    const msg = JSON.parse(line);
    if (!msg.method) { peer.denials.push(msg); callback?.(); return true; }
    peer.calls.push({ ...msg, pid: child.pid });
    if (settings.intercept?.(msg, peer, reply)) { callback?.(); return true; }
    const defaults = {
      initialize: { userAgent: 'fake/0.153.4', codexHome: 'private-path' },
      'account/read': { account: { type: 'chatgpt', email: 'private-account@example.test' } },
      'config/read': { config: { model, features: Object.fromEntries(DATA_SESSION_DISABLED_FEATURES.map((k) => [k, false])), web_search: 'disabled', mcp_servers: {} } },
      'mcpServerStatus/list': { data: [], nextCursor: null },
      'model/list': { data: [{ model, supportedReasoningEfforts: [{ reasoningEffort: 'ultra' }] }], nextCursor: null },
      'thread/start': { thread: { id: 'thread-data' }, model, modelProvider: 'openai', approvalPolicy: 'never', sandbox: { type: 'readOnly', networkAccess: false } },
      'turn/interrupt': {},
    };
    if (msg.method === 'initialized') { callback?.(); return true; }
    if (msg.method === 'turn/start') {
      const id = `turn-${++peer.turns}`;
      const start = () => reply(msg, { turn: { id, status: 'inProgress', items: [], error: null } });
      if (!settings.early) start();
      if (settings.onTurn) settings.onTurn(msg, peer, id);
      else peer.finish(id, settings.values?.[peer.turns - 1] ?? { ok: true });
      if (settings.early) start();
    } else {
      assert.ok(Object.hasOwn(defaults, msg.method), `unexpected RPC ${msg.method}`);
      const result = settings.responses && Object.hasOwn(settings.responses, msg.method) ? settings.responses[msg.method] : defaults[msg.method];
      reply(msg, result);
    }
    callback?.();
    return true;
  };
  child.stdin.end = () => {
    child.stdin.writableEnded = true;
    if (!settings.holdClose) peer.close();
  };
  peer.options = {
    driver: 'chatgpt-cli', model, reasoningEffort: 'ultra', env: { ANCHOR_DATA_DIR: dataPrefsDir },
    rpcTimeoutMs: 500, openTimeoutMs: 1500, turnTimeoutMs: 500, closeGraceMs: 5, killCloseMs: 100,
    spawnImpl: (command, args, options) => { peer.spawns.push({ command, args, options }); return child; },
    killTreeImpl: () => { peer.kills++; peer.close(); },
  };
  peer.assertReaped = () => {
    assert.equal(peer.closed, true);
    for (const emitter of [child, child.stdin, child.stdout, child.stderr]) assert.equal(emitter.eventNames().length, 0, 'owned listeners removed after close');
  };
  return peer;
}

test('public API: two W6 scene schemas and W9 continuation share one process and thread', async () => {
  const schemas = [sceneSchema('Scene one', 'actions'), sceneSchema('Scene two', 'observations'), evidenceSchema];
  const values = [{ heading: 'Scene one', actions: ['Mira hides the key'] },
    { heading: 'Scene two', observations: ['The locked door remains closed'] },
    { rows: [{ idea: 'Concealment', scene: 'Scene one', evidence: 'Mira hides the key' },
      { idea: 'Consequence', scene: 'Scene two', evidence: 'The locked door remains closed' }] }];
  const peer = fakePeer({ values, early: true });
  const session = await createDataSession({ ...peer.options, env: { ...peer.options.env, OPENAI_API_KEY: 'private-key', CODEX_ACCESS_TOKEN: 'private-token' } });
  try {
    assert.equal(peer.turns, 0);
    assert.equal(session.preflight.phase, 'session-open');
    assert.equal(session.preflight.subscription_auth, true);
    assert.deepEqual(session.preflight.disabled_features, Object.fromEntries(DATA_SESSION_DISABLED_FEATURES.map((key) => [key, false])));
    assert.equal(session.preflight.web_search, 'disabled');
    assert.equal(session.preflight.configured_mcp_servers, 0);
    assert.equal(session.preflight.mcp_catalog_entries, 0);
    assert.equal(session.preflight.mcp_catalog_complete, true);
    assert.equal(session.preflight.configured_tool_controls_verified, true);
    assert.equal(session.preflight.built_in_tool_catalog_observed, false);
    assert.deepEqual(session.preflight.thread_policy, { sandbox_type: 'readOnly', network_access: false, approval_policy: 'never' });
    assert.equal(Object.isFrozen(session.preflight), true);
    assert.equal(Object.isFrozen(session.preflight.disabled_features), true);
    assert.equal(Object.isFrozen(session.preflight.thread_policy), true);
    const prompts = ['# Scene one\nMira hides the key.', '# Scene two\nThe locked door remains closed.',
      'Continue the evidence table for the two scenes already supplied. Connect concealment and consequence.'];
    for (let i = 0; i < prompts.length; i++) {
      const out = await session.request({ prompt: prompts[i], schema: schemas[i] });
      assert.deepEqual(out.value, values[i]);
      assert.equal(out.receipt.pid, session.pid);
      assert.equal(out.receipt.thread_id, session.threadId);
      assert.equal(out.receipt.turn_id, `turn-${i + 1}`);
      assert.equal(out.receipt.requested_model, model);
      assert.equal(out.receipt.requested_effort, 'ultra');
      assert.equal(out.receipt.served_model, null);
      assert.equal(out.receipt.model_attested, false);
      assert.equal(out.receipt.completed, true);
      assert.equal(out.receipt.preflight, session.preflight);
      assert.equal(out.receipt.read_only, true);
      assert.equal(out.receipt.network_access, false);
      assert.equal(out.receipt.policy_observed_at, 'thread/start');
      assert.equal(out.receipt.runtime_policy_status, 'requested-unattested');
      assert.equal(out.receipt.tool_isolation_verified, null, 'no claim to a complete built-in catalog or runtime tool attestation');
      assert.deepEqual(out.receipt.turn_policy_requested, { approvalPolicy: 'never', approvalsReviewer: 'user',
        sandboxPolicy: { type: 'readOnly', networkAccess: false } });
      assert.doesNotMatch(JSON.stringify(out.receipt), /private-|example\.test/);
      assert.equal(session.closed, false, 'no thread terminal event is needed');
    }
    assert.equal(peer.spawns.length, 1);
    const calls = peer.calls.filter((c) => c.method !== 'initialized');
    assert.deepEqual(calls.slice(0, 7).map((c) => c.method), ['initialize', 'account/read', 'config/read', 'mcpServerStatus/list', 'model/list', 'thread/start', 'turn/start']);
    assert.ok(calls.every((c) => c.pid === session.pid));
    assert.equal(calls.filter((c) => c.method === 'thread/start').length, 1);
    const turns = calls.filter((c) => c.method === 'turn/start');
    for (const turn of turns) assert.deepEqual({ approvalPolicy: turn.params.approvalPolicy,
      approvalsReviewer: turn.params.approvalsReviewer, sandboxPolicy: turn.params.sandboxPolicy },
    { approvalPolicy: 'never', approvalsReviewer: 'user', sandboxPolicy: { type: 'readOnly', networkAccess: false } });
    assert.deepEqual(turns.map((c) => c.params.outputSchema), schemas, 'bare per-turn schemas');
    assert.ok(turns.every((c) => c.params.threadId === session.threadId));
    assert.ok(turns.every((c) => c.params.sandboxPolicy.type === 'readOnly' && c.params.sandboxPolicy.networkAccess === false));
    assert.equal(calls.find((c) => c.method === 'thread/start').params.sandbox, 'read-only');
    const spawn = peer.spawns[0];
    assertLaunchIsolation(spawn);
    assert.equal(spawn.options.shell, false);
    assert.equal(spawn.options.windowsHide, true);
    assert.equal(spawn.options.env.OPENAI_API_KEY, undefined);
    assert.equal(spawn.options.env.CODEX_ACCESS_TOKEN, undefined);
    assert.deepEqual(spawn.args.slice(0, 3), ['app-server', '--stdio', '--strict-config']);
    assert.ok(!spawn.args.includes('--ignore-user-config'));
    assert.ok(prompts.every((p) => !spawn.args.includes(p)));
  } finally { await session.close(); }
  peer.assertReaped();
});

test('serial API refuses overlap without spawning or steering an active turn', async () => {
  const peer = fakePeer({ onTurn() {} });
  const session = await createDataSession(peer.options);
  try {
    const first = session.request(request);
    await assert.rejects(session.request(request), { code: 'busy' });
    assert.equal(peer.turns, 1);
    peer.finish('turn-1');
    assert.deepEqual((await first).value, { ok: true });
    const second = session.request(request);
    peer.finish('turn-2');
    await second;
    assert.equal(peer.spawns.length, 1);
  } finally { await session.close(); }
  peer.assertReaped();
});

for (const [name, method, response] of [
  ['API auth', 'account/read', { account: { type: 'apiKey' } }],
  ['missing auth', 'account/read', { account: null }],
  ['unknown model', 'model/list', { data: [{ model: 'gpt-other', supportedReasoningEfforts: [{ reasoningEffort: 'ultra' }] }] }],
  ['unsupported ultra', 'model/list', { data: [{ model, supportedReasoningEfforts: [{ reasoningEffort: 'high' }] }] }],
  ['missing effective config', 'config/read', {}],
  ['MCP server', 'mcpServerStatus/list', { data: [{ tools: {} }], nextCursor: null }],
  ['MCP pagination', 'mcpServerStatus/list', { data: [], nextCursor: 'unproved' }],
  ['thread network widening', 'thread/start', { thread: { id: 'thread-data' }, model, modelProvider: 'openai', approvalPolicy: 'never', sandbox: { type: 'readOnly', networkAccess: true } }],
  ['custom provider', 'thread/start', { thread: { id: 'thread-data' }, model, modelProvider: 'custom-api', approvalPolicy: 'never', sandbox: { type: 'readOnly', networkAccess: false } }],
]) {
  test(`preflight refuses ${name} before any model turn and joins its owned child`, async () => {
    const peer = fakePeer({ responses: { [method]: response } });
    await assert.rejects(createDataSession(peer.options));
    assert.equal(peer.turns, 0);
    assert.equal(peer.spawns.length, 1);
    peer.assertReaped();
  });
}

for (const badConfig of [...DATA_SESSION_DISABLED_FEATURES, 'web_search', 'mcp_servers', 'missing-mcp']) {
  test(`effective isolation refuses ${badConfig} inheritance rather than trusting argv`, async () => {
    const peer = fakePeer({ intercept(msg, p, reply) {
      if (msg.method !== 'config/read') return false;
      const config = { features: Object.fromEntries(DATA_SESSION_DISABLED_FEATURES.map((k) => [k, false])), web_search: 'disabled', mcp_servers: {} };
      if (DATA_SESSION_DISABLED_FEATURES.includes(badConfig)) config.features[badConfig] = true;
      else if (badConfig === 'web_search') config.web_search = 'live';
      else if (badConfig === 'missing-mcp') delete config.mcp_servers;
      else config.mcp_servers = { inherited: {} };
      reply(msg, { config });
      return true;
    } });
    await assert.rejects(createDataSession(peer.options), { code: 'isolation_unproven' });
    assert.equal(peer.turns, 0);
    peer.assertReaped();
  });
}

test('live catalog pagination runs on the same child and accepts only the exact model effort', async () => {
  const peer = fakePeer({ intercept(msg, p, reply) {
    if (msg.method !== 'model/list') return false;
    reply(msg, msg.params.cursor ? { data: [{ model, supportedReasoningEfforts: [{ reasoningEffort: 'ultra' }] }], nextCursor: null }
      : { data: [], nextCursor: 'page-two' });
    return true;
  } });
  const session = await createDataSession(peer.options);
  await session.close();
  assert.equal(peer.calls.filter((c) => c.method === 'model/list').length, 2);
  assert.equal(peer.spawns.length, 1);
  peer.assertReaped();
});

test('common policy resolves before spawning; complete child catalog validates it without replacing its rank', async () => {
  const chosenModel = 'gpt-policy-selected';
  const rows = [
    { model: chosenModel, supportedReasoningEfforts: [{ reasoningEffort: 'ultra' }] },
    { model: 'gpt-other-page-two', supportedReasoningEfforts: [{ reasoningEffort: 'high' }] },
    { model: 'gpt-other-page-three', supportedReasoningEfforts: [{ reasoningEffort: 'low' }] },
  ];
  const policyReceipt = { family: 'chatgpt', selected_model: chosenModel, selected_effort: 'ultra',
    source: 'injected-test-policy', catalog_count: 3, evidence: { complete: true } };
  const expectedReceipt = structuredClone(policyReceipt);
  let policyCalls = 0;
  let sanitized = 0;
  const peer = fakePeer({ intercept(msg, p, reply) {
    if (msg.method === 'model/list') {
      assert.equal(policyCalls, 1, 'common policy is selected before the data child is spawned');
      const page = msg.params.cursor ? Number(msg.params.cursor) : 0;
      reply(msg, { data: [rows[page]], nextCursor: page < 2 ? String(page + 1) : null });
      return true;
    }
    if (msg.method === 'thread/start') {
      assert.equal(policyCalls, 1);
      assert.equal(msg.params.model, chosenModel);
      assert.equal(msg.params.config.model_reasoning_effort, 'ultra');
      reply(msg, { thread: { id: 'thread-data' }, model: chosenModel, modelProvider: 'openai',
        approvalPolicy: 'never', sandbox: { type: 'readOnly', networkAccess: false } });
      return true;
    }
    if (msg.method === 'initialize') assert.equal(sanitized, 1);
    return false;
  } });
  const pins = ['TRIO_MODEL', 'TRIO_MODEL_EXTRACTOR', 'CODEX_MODEL', 'CHATGPT_MODEL',
    'CODEX_REASONING_EFFORT', 'TRIO_REASONING_EFFORT_EXTRACTOR', 'TRIO_TIER'];
  const env = { ...peer.options.env, ...Object.fromEntries(pins.map((key) => [key, 'untrusted-pin'])),
    OPENAI_API_KEY: 'private-key', CODEX_ACCESS_TOKEN: 'private-token' };
  const session = await createDataSession({ ...peer.options, role: 'extractor', env,
    model: chosenModel, reasoningEffort: 'ultra',
    policyEnvironment(input) {
      assert.equal(input, env);
      assert.equal(peer.spawns.length, 0);
      sanitized++;
      const clean = { ...input, POLICY_ENV_MARKER: 'sanitized' };
      for (const key of pins) delete clean[key];
      return clean;
    },
    policyResolver(family, options) {
      policyCalls++;
      assert.equal(family, 'chatgpt');
      assert.equal(options.env, env);
      assert.equal(options.force, true);
      assert.equal(peer.spawns.length, 0);
      assert.equal(peer.turns, 0);
      assert.deepEqual(peer.calls, []);
      assert.equal(options.discoverer, undefined, 'use common discovery and its installed-catalog reconciliation');
      return { model: chosenModel, effort: 'ultra', receipt: policyReceipt };
    },
  });
  try {
    assert.equal(policyCalls, 1);
    assert.equal(sanitized, 1);
    const spawned = peer.spawns[0];
    assertLaunchIsolation(spawned);
    assert.ok(!spawned.args.some((arg) => arg.includes('untrusted-pin')), 'no stale model or effort CLI pins');
    assert.equal(peer.calls.filter((call) => call.method === 'model/list').length, 3, 'all live capability pages are validated');
    for (const key of [...pins, 'OPENAI_API_KEY', 'CODEX_ACCESS_TOKEN']) assert.equal(spawned.options.env[key], undefined, key);
    assert.equal(spawned.options.env.POLICY_ENV_MARKER, 'sanitized');
    assert.equal(env.TRIO_MODEL, 'untrusted-pin', 'caller environment remains unchanged');
    policyReceipt.evidence.complete = false;
    const first = await session.request(request);
    assert.deepEqual(first.value, { ok: true });
    assert.equal(first.receipt.requested_model, chosenModel);
    assert.equal(first.receipt.configured_model, chosenModel);
    assert.equal(first.receipt.requested_effort, 'ultra');
    assert.equal(first.receipt.served_model, null);
    assert.deepEqual(first.receipt.caller_requested, { model: chosenModel, effort: 'ultra' });
    assert.deepEqual(first.receipt.policy_selected, { model: chosenModel, effort: 'ultra' });
    assert.deepEqual(first.receipt.policy_receipt, expectedReceipt);
    first.receipt.policy_receipt.evidence.complete = false;
    assert.deepEqual((await session.request(request)).receipt.policy_receipt, expectedReceipt);
    for (const call of peer.calls.filter((call) => call.method === 'turn/start')) {
      assert.equal(call.params.model, chosenModel);
      assert.equal(call.params.effort, 'ultra');
    }
    assert.equal(peer.spawns.length, 1);
    assert.ok(peer.calls.every((call) => call.pid === session.pid));
  } finally { await session.close(); }
  peer.assertReaped();
});

for (const [name, caller, selectedEffort] of [
  ['different model', { model: 'gpt-other-explicit' }, 'ultra'],
  ['ultra silently lowered', { reasoningEffort: 'ultra' }, 'high'],
  ['unsupported explicit effort', { reasoningEffort: 'invented' }, 'ultra'],
]) {
  test(`injected policy refuses conflicting caller constraints: ${name}`, async () => {
    const peer = fakePeer({ intercept(msg, p, reply) {
      if (msg.method !== 'model/list') return false;
      reply(msg, { data: [{ model, supportedReasoningEfforts: [{ reasoningEffort: selectedEffort }] }], nextCursor: null });
      return true;
    } });
    await assert.rejects(createDataSession({ ...peer.options, ...caller,
      policyEnvironment: (env) => ({ ...env }),
      policyResolver: () => ({ model, effort: selectedEffort, receipt: { source: 'same-child-test-catalog' } }),
    }), { code: 'capability_unavailable' });
    assert.equal(peer.turns, 0);
    assert.equal(peer.calls.some((call) => call.method === 'thread/start'), false);
    assert.equal(peer.spawns.length, 0, 'conflicting constraints are refused before any child exists');
  });
}

test('omitted caller constraints preserve policy-selected effort without claiming a caller request', async () => {
  const peer = fakePeer({ intercept(msg, p, reply) {
    if (msg.method !== 'model/list') return false;
    reply(msg, { data: [{ model, supportedReasoningEfforts: [{ reasoningEffort: 'high' }] }], nextCursor: null });
    return true;
  } });
  const session = await createDataSession({ ...peer.options, model: undefined, reasoningEffort: undefined,
    policyEnvironment: (env) => ({ ...env }),
    policyResolver: () => ({ model, effort: 'high', receipt: { source: 'same-child-test-catalog' } }),
  });
  try {
    const result = await session.request(request);
    assert.deepEqual(result.receipt.caller_requested, { model: null, effort: null });
    assert.deepEqual(result.receipt.policy_selected, { model, effort: 'high' });
    assert.equal(result.receipt.requested_effort, 'high');
    assert.equal(result.receipt.served_model, null);
  } finally { await session.close(); }
  peer.assertReaped();
});

for (const selection of [
  { model: 'gpt-absent', effort: 'ultra', receipt: {} },
  { model, effort: 'unsupported', receipt: {} },
]) {
  test(`injected policy cannot bypass live model/effort support: ${selection.model}/${selection.effort}`, async () => {
    const peer = fakePeer();
    await assert.rejects(createDataSession({ ...peer.options, model: undefined, reasoningEffort: undefined,
      policyEnvironment: (env) => ({ ...env }), policyResolver: () => selection,
    }), { code: 'capability_unavailable' });
    assert.equal(peer.turns, 0);
    assert.equal(peer.calls.some((call) => call.method === 'thread/start'), false);
    peer.assertReaped();
  });
}

test('default data transport retains prompts and schema responses above former byte quotas', async () => {
  const value = { text: 'abcdefgh'.repeat(1150000) };
  const prompt = 'Source material '.repeat(150000);
  const peer = fakePeer({ values: [value] });
  const session = await createDataSession({ ...peer.options, turnTimeoutMs: 5000 });
  try {
    const result = await session.request({ prompt, schema: { type: 'object',
      properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false }, timeoutMs: 5000 });
    assert.equal(peer.calls.find((call) => call.method === 'turn/start').params.input[0].text, prompt);
    assert.equal(result.value.text, value.text);
  } finally { await session.close(); }
  peer.assertReaped();
});

test('explicit total-byte bound remains a local transport failure', async () => {
  const peer = fakePeer({ onTurn(msg, p) { p.child.stderr.emit('data', Buffer.alloc(6000)); } });
  const session = await createDataSession({ ...peer.options, maxTurnBytes: 5000 });
  await assert.rejects(session.request(request), { code: 'overflow' });
  await session.close();
  peer.assertReaped();
});

test('Sol-first child catalog cannot replace Astra selected by the common policy', async () => {
  const peer = fakePeer({ responses: { 'model/list': { data: [
    { model: 'gpt-5.6-sol', isDefault: true, supportedReasoningEfforts: [{ reasoningEffort: 'ultra' }] },
    { model, supportedReasoningEfforts: [{ reasoningEffort: 'ultra' }] },
  ], nextCursor: null } } });
  const session = await createDataSession({ ...peer.options,
    policyEnvironment: (env) => ({ ...env }),
    policyResolver: () => ({ model, effort: 'ultra', receipt: { source: 'common-policy' } }),
  });
  try {
    const result = await session.request(request);
    assert.equal(result.receipt.requested_model, model);
    assert.equal(result.receipt.requested_effort, 'ultra');
  } finally { await session.close(); }
  peer.assertReaped();
});

test('injected policy requires its environment sanitizer before spawning', async () => {
  const peer = fakePeer();
  await assert.rejects(createDataSession({ ...peer.options, policyResolver: () => assert.fail('must not select') }),
    /policyResolver requires a policyEnvironment sanitizer/);
  assert.equal(peer.spawns.length, 0);
});

for (const [name, onTurn, code] of [
  ['malformed JSONL', (m, p) => p.raw('{broken\n'), 'malformed_jsonl'],
  ['oversize output', (m, p) => p.raw('x'.repeat(2200)), 'overflow'],
  ['wrong thread', (m, p, id) => p.finish(id, { ok: true }, { ids: { threadId: 'alien' } }), 'wrong_id'],
  ['wrong turn', (m, p) => p.finish('alien'), 'wrong_id'],
  ['schema mismatch', (m, p, id) => p.finish(id, { ok: 'true' }), 'schema_nonconforming'],
  ['additional property', (m, p, id) => p.finish(id, { ok: true, fabricated: true }), 'schema_nonconforming'],
  ['JSON fences', (m, p, id) => p.finish(id, null, { item: { text: '```json\n{"ok":true}\n```' } }), 'invalid_json'],
  ['partial final JSON', (m, p, id) => p.finish(id, null, { item: { text: '{"ok":' } }), 'invalid_json'],
  ['commentary-only result', (m, p, id) => p.finish(id, { ok: true }, { item: { phase: 'commentary' } }), 'invalid_final'],
  ['unknown final phase', (m, p, id) => p.finish(id, { ok: true }, { item: { phase: null } }), 'invalid_final'],
  ['terminal failure', (m, p, id) => p.finish(id, { ok: true }, { turn: { status: 'failed', error: { message: 'failed' } } }), 'turn_error'],
  ['terminal error notification', (m, p, id) => p.emit({ method: 'error', params: { threadId: 'thread-data', turnId: id, willRetry: false, error: {} } }), 'turn_error'],
  ['closed input', (m, p, id) => { p.finish(id); p.child.stdin.emit('error', new Error('EPIPE')); }, 'pipe_error'],
  ['exited child', (m, p, id) => { p.finish(id); p.child.emit('exit', 1, null); }, 'eof'],
  ['error after completion', (m, p, id) => { p.finish(id); p.emit({ method: 'error', params: { threadId: 'thread-data', turnId: id, willRetry: true, error: {} } }); }, 'turn_error'],
  ['tool item', (m, p, id) => p.emit({ method: 'item/started', params: { threadId: 'thread-data', turnId: id, item: { id: 'cmd', type: 'commandExecution' } } }), 'tool_requested'],
]) {
  test(`public request rejects ${name}, never replays and cleans up`, async () => {
    const peer = fakePeer({ onTurn });
    const session = await createDataSession({ ...peer.options, maxLineBytes: 2000 });
    await assert.rejects(session.request(request), (error) => {
      assert.equal(error.code, code);
      assert.equal(error.receipt.completed, false);
      assert.equal(error.receipt.closed, true);
      if (code === 'tool_requested') {
        assert.equal(error.receipt.tool_isolation_verified, false);
        assert.equal(error.receipt.runtime_policy_status, 'contradicted');
        assert.equal(error.receipt.preflight.configured_tool_controls_verified, true, 'open-time evidence remains factual');
      }
      return true;
    });
    await assert.rejects(session.request(request));
    assert.equal(peer.turns, 1);
    assert.equal(peer.spawns.length, 1);
    peer.assertReaped();
  });
}

test('optional contradictory policy evidence in turn replies or completion refuses and reaps', async () => {
  for (const evidence of [
    { sandboxPolicy: { type: 'readOnly', networkAccess: true } },
    { sandbox: { type: 'workspaceWrite', networkAccess: false } },
    { approvalPolicy: 'on-request' },
  ]) for (const phase of ['start', 'completion']) {
    const peer = fakePeer({
      intercept(msg, p, reply) {
        if (phase !== 'start' || msg.method !== 'turn/start') return false;
        p.turns++;
        reply(msg, { turn: { id: 'turn-1', status: 'inProgress', error: null, items: [] }, ...evidence });
        return true;
      },
      onTurn(msg, p, id) { p.finish(id, { ok: true }, { turn: evidence }); },
    });
    const session = await createDataSession(peer.options);
    await assert.rejects(session.request(request), (error) => {
      assert.equal(error.code, 'isolation_changed');
      assert.equal(error.receipt.completed, false);
      assert.equal(error.receipt.closed, true);
      assert.equal(error.receipt.tool_isolation_verified, false);
      assert.equal(error.receipt.runtime_policy_status, 'contradicted');
      assert.equal(error.receipt.preflight.thread_policy.network_access, false);
      assert.equal(error.receipt.preflight.configured_tool_controls_verified, true);
      return true;
    });
    await assert.rejects(session.request(request));
    assert.equal(peer.turns, 1);
    assert.equal(peer.spawns.length, 1);
    peer.assertReaped();
  }
});

test('reasoning/commentary/deltas are excluded; retryable request errors wait for the matching outcome', async () => {
  const peer = fakePeer({ early: true, onTurn(m, p, id) {
    const params = { threadId: 'thread-data', turnId: id };
    p.emit({ method: 'error', params: { ...params, willRetry: true, error: { message: 'retrying internally' } } });
    p.emit({ method: 'item/completed', params: { ...params, item: { id: 'reasoning', type: 'reasoning', text: '{"ok":false}' } } });
    p.emit({ method: 'item/completed', params: { ...params, item: { id: 'progress', type: 'agentMessage', phase: 'commentary', text: '{"ok":false}' } } });
    p.emit({ method: 'item/agentMessage/delta', params: { ...params, itemId: 'answer', delta: '{"ok":false}' } });
    p.finish(id);
  } });
  const session = await createDataSession(peer.options);
  try {
    const out = await session.request(request);
    assert.deepEqual(out.value, { ok: true });
    assert.equal(out.receipt.retryable_errors, 1);
    assert.equal(peer.turns, 1, 'client never retries');
  } finally { await session.close(); }
  peer.assertReaped();
});

test('stale prior-turn output cannot satisfy a later schema request', async () => {
  const peer = fakePeer({ onTurn(m, p, id) { p.finish(id === 'turn-2' ? 'turn-1' : id); } });
  const session = await createDataSession(peer.options);
  await session.request(request);
  await assert.rejects(session.request(request), { code: 'wrong_id' });
  assert.equal(peer.turns, 2);
  peer.assertReaped();
});

for (const [method, denial] of [
  ['item/commandExecution/requestApproval', { decision: 'cancel' }],
  ['item/fileChange/requestApproval', { decision: 'cancel' }],
  ['item/permissions/requestApproval', { permissions: {}, scope: 'turn' }],
  ['item/tool/call', { contentItems: [], success: false }],
  ['unknown/interactive', null],
]) {
  test(`server ${method} is denied and terminates the data session`, async () => {
    const peer = fakePeer({ onTurn(m, p) { p.emit({ id: 'server-request', method, params: {} }); } });
    const session = await createDataSession(peer.options);
    await assert.rejects(session.request(request), { code: 'interactive_request' });
    await assert.rejects(session.request(request), (error) => {
      assert.equal(error.receipt.tool_isolation_verified, false);
      assert.equal(error.receipt.runtime_policy_status, 'contradicted');
      assert.equal(error.receipt.preflight.configured_tool_controls_verified, true);
      return true;
    });
    assert.equal(peer.denials.length, 1);
    if (denial) assert.deepEqual(peer.denials[0].result, denial);
    else assert.equal(peer.denials[0].error.code, -32601);
    peer.assertReaped();
  });
}

for (const mode of ['cancel', 'signal', 'timeout', 'EOF', 'close']) {
  test(`${mode} interrupts/joins the owned process and never permits uncertain reuse`, async () => {
    const peer = fakePeer({ holdClose: true, onTurn() {} });
    const session = await createDataSession(peer.options);
    const controller = new AbortController();
    const pending = session.request({ ...request, signal: controller.signal, timeoutMs: mode === 'timeout' ? 10 : 500 });
    const rejected = assert.rejects(pending, (error) => error.receipt.completed === false && error.receipt.closed === true);
    if (mode === 'cancel') await session.cancel();
    if (mode === 'signal') controller.abort();
    if (mode === 'EOF') peer.child.stdout.emit('end');
    if (mode === 'close') await session.close();
    await rejected;
    assert.ok(peer.calls.some((c) => c.method === 'turn/interrupt'));
    assert.equal(peer.kills, 1);
    await session.close(); // idempotent, no second kill
    await assert.rejects(session.request(request));
    assert.equal(peer.kills, 1);
    peer.assertReaped();
  });
}

test('RPC preflight timeout and malformed early response reap before rejection', async () => {
  for (const broken of ['timeout', 'wrong-id']) {
    const peer = fakePeer({ holdClose: true, intercept(msg, p) {
      if (msg.method !== 'initialize') return false;
      if (broken === 'wrong-id') p.emit({ id: 9999, result: {} });
      return true;
    } });
    await assert.rejects(createDataSession({ ...peer.options, rpcTimeoutMs: 10 }));
    assert.equal(peer.turns, 0);
    assert.equal(peer.kills, 1);
    peer.assertReaped();
  }
});

test('unsupported schema semantics fail before a turn; valid next request remains usable', async () => {
  const peer = fakePeer();
  const session = await createDataSession(peer.options);
  try {
    await assert.rejects(session.request({ ...request, schema: { type: 'string', pattern: '^x$' } }), { code: 'unsupported_schema' });
    await assert.rejects(session.request({ prompt: 'data' }), { code: 'invalid_schema' });
    assert.equal(peer.turns, 0);
    await session.request(request);
  } finally { await session.close(); }
});

test('selection errors and pre-aborted startup do not launch a child', async () => {
  const peer = fakePeer();
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(createDataSession({ ...peer.options, signal: abort.signal }), { code: 'cancelled' });
  await assert.rejects(createDataSession({ ...peer.options, model: 'grok-not-codex' }), { code: 'capability_unavailable' });
  await assert.rejects(createDataSession({ ...peer.options, reasoningEffort: 'invented' }), /unsupported Codex reasoning effort/);
  assert.equal(peer.spawns.length, 0);
});

test('partial deltas and retryable errors without a completed outcome time out, never succeed', async () => {
  const peer = fakePeer({ onTurn(m, p, id) {
    p.emit({ method: 'error', params: { threadId: 'thread-data', turnId: id, willRetry: true, error: {} } });
    p.emit({ method: 'item/agentMessage/delta', params: { threadId: 'thread-data', turnId: id, delta: '{"ok":true}' } });
  } });
  const session = await createDataSession(peer.options);
  await assert.rejects(session.request({ ...request, timeoutMs: 10 }), { code: 'turn_timeout' });
  assert.equal(peer.turns, 1);
  peer.assertReaped();
});

test('UTF-8 and JSONL chunk boundaries preserve the actual final answer', async () => {
  const peer = fakePeer({ onTurn(m, p, id) {
    const item = { type: 'agentMessage', id: 'answer', phase: 'final_answer', text: JSON.stringify({ heading: 'Сцена', actions: ['鍵'] }) };
    const line = Buffer.from(JSON.stringify({ method: 'turn/completed', params: { threadId: 'thread-data', turn: { id, status: 'completed', items: [item] } } }) + '\n');
    const start = line.indexOf(Buffer.from('鍵'));
    p.child.stdout.emit('data', line.subarray(0, start + 1));
    p.child.stdout.emit('data', line.subarray(start + 1, start + 2));
    p.child.stdout.emit('data', line.subarray(start + 2));
  } });
  const session = await createDataSession(peer.options);
  try { assert.deepEqual((await session.request({ prompt: 'scene', schema: sceneSchema('Сцена', 'actions') })).value, { heading: 'Сцена', actions: ['鍵'] }); }
  finally { await session.close(); }
  peer.assertReaped();
});

test('unconfirmed cleanup is reported as failure; later close is still observed and reaped', async () => {
  const peer = fakePeer({ holdClose: true, onTurn() {} });
  const session = await createDataSession({ ...peer.options, killCloseMs: 10, killTreeImpl: () => { peer.kills++; } });
  await assert.rejects(session.request({ ...request, timeoutMs: 10 }), (error) => {
    assert.equal(error.receipt.closed, false);
    assert.equal(error.receipt.cleanup_error, 'cleanup_unconfirmed');
    assert.equal(error.receipt.completed, false);
    return true;
  });
  assert.equal(session.state, 'failed');
  await assert.rejects(session.request(request));
  peer.close();
  peer.assertReaped();
});

test('selected unsupported family/capability refuses without spawning; verification never routes to coding', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'data-session-prefs-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ coding_family: 'chatgpt', review_family: 'grok', default_cli: 'chatgpt' }));
  const env = { ANCHOR_DATA_DIR: dir };
  const peer = fakePeer();
  const options = { ...peer.options, driver: undefined, env };
  for (const role of ['reviewer', 'judge', 'verify', 'analysis', 'shark', 'gate3', 'refuter']) {
    assert.equal(resolveDriverFromFamilies(role, env), 'grok-cli');
    await assert.rejects(createDataSession({ ...options, role }), { code: 'capability_unavailable' });
  }
  await assert.rejects(createDataSession({ ...options, label: 'judge:derived' }), { code: 'capability_unavailable' });
  await assert.rejects(createDataSession({ ...options, role: 'extractor', capability: 'coding' }), { code: 'capability_unavailable' });
  assert.equal(peer.spawns.length, 0);
  const session = await createDataSession({ ...options, role: 'extractor' });
  await session.close();
  assert.equal(peer.spawns.length, 1);
});

test('explicit chatgpt driver cannot admit canonical verification roles even with chatgpt review preferences', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'data-session-verification-prefs-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ coding_family: 'chatgpt', review_family: 'chatgpt', default_cli: 'chatgpt' }));
  const peer = fakePeer();
  const options = { ...peer.options, driver: 'chatgpt-cli', env: { ANCHOR_DATA_DIR: dir } };
  for (const role of VERIFICATION_ROLES) {
    assert.equal(resolveDriverFromFamilies(role, options.env), 'chatgpt-cli');
    await assert.rejects(createDataSession({ ...options, role }), { code: 'capability_unavailable' });
    await assert.rejects(createDataSession({ ...options, label: `${role}:derived` }), { code: 'capability_unavailable' });
  }
  await assert.rejects(createDataSession({ ...options, role: ' REVIEWER:seat ' }), { code: 'capability_unavailable' });
  assert.equal(peer.spawns.length, 0);
});

test('data-session driver overrides cannot bypass the saved coding family', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'data-session-override-prefs-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ coding_family: 'grok', review_family: 'chatgpt', default_cli: 'grok' }));
  const peer = fakePeer();
  const env = { ANCHOR_DATA_DIR: dir, TRIO_DRIVER: 'chatgpt-cli' };
  assert.equal(resolveDriverFromFamilies('extractor', env), 'grok-cli');
  await assert.rejects(createDataSession({ ...peer.options, role: 'extractor', env }), { code: 'capability_unavailable' });
  await assert.rejects(createDataSession({ ...peer.options, driver: undefined, role: 'extractor', env }), { code: 'capability_unavailable' });
  await assert.rejects(createDataSession({ ...peer.options, driver: 'grok-cli', role: 'extractor' }), { code: 'capability_unavailable' });
  assert.equal(peer.spawns.length, 0);
  const session = await createDataSession({ ...peer.options, driver: undefined, role: 'extractor',
    env: { ...peer.options.env, TRIO_DRIVER: 'grok-cli' } });
  await session.close();
  assert.equal(peer.spawns.length, 1, 'eligible data role follows saved coding preference');
  peer.assertReaped();
});

test('ordinary imported runAgent author and reviewer keep fresh ephemeral exec transport', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'data-session-ephemeral-prefs-'));
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ coding_family: 'chatgpt', review_family: 'chatgpt', default_cli: 'chatgpt' }));
  const previousDataDir = process.env.ANCHOR_DATA_DIR;
  process.env.ANCHOR_DATA_DIR = dir;
  t.after(() => {
    if (previousDataDir === undefined) delete process.env.ANCHOR_DATA_DIR;
    else process.env.ANCHOR_DATA_DIR = previousDataDir;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const calls = [];
  const runCodexCli = (prompt, label, options) => defaultRunCodexCli(prompt, label, {
    ...options, model, reasoningEffort: 'ultra', env: { CRUCIBLE_AGENT_LIVE: '1' },
    // Existing canonical policy hook: fake discovery stays hermetic; this does
    // not change the real exec argv or its fresh author/reviewer contract.
    policyResolver: () => ({ family: 'chatgpt', model, effort: 'ultra', model_attested: false }),
    preflightImpl: () => ({ ok: true, auth: 'chatgpt', subscription_auth: true }),
    processRunner: async (call) => {
      calls.push(call);
      return { code: 0, terminal: 'closed', stderr: '', stdout: [
        { type: 'thread.started', thread_id: `fresh-${calls.length}` },
        { type: 'item.completed', item: { type: 'agent_message', text: 'done' } },
        { type: 'turn.completed', usage: {} },
      ].map((e) => JSON.stringify(e)).join('\n') };
    },
  });
  for (const role of ['execute', 'reviewer']) assert.equal(await runAgent({ driver: 'chatgpt-cli', role, prompt: 'ordinary work', runCodexCli }), 'done');
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.args[0], 'exec');
    assert.ok(call.args.includes('--ephemeral'));
    assert.ok(!call.args.includes('app-server'));
    assert.equal(call.options.shell, false);
    assert.equal(call.options.windowsHide, true);
  }
  assert.equal(calls[0].args[calls[0].args.indexOf('--sandbox') + 1], 'workspace-write');
  assert.equal(calls[1].args[calls[1].args.indexOf('--sandbox') + 1], 'read-only');
});
