import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_POLICY, PolicyUnavailable, loadPolicyPrefs, normalizeCatalog,
  selectModel, highestEffort, policyEnvironment, resolveModelPolicy,
  modelLaunchArgs, clearModelPolicyCache,
} from '../model-policy.mjs';

const prefs = (extra = {}) => ({
  coding_family: 'chatgpt', review_family: 'grok', default_cli: 'chatgpt',
  model_policy: { ...DEFAULT_POLICY }, settings_revision: 7, ...extra,
});
const codex = (model = 'synthetic-frontier-a', efforts = ['low', 'high', 'ultra']) => ({
  models: [{ slug: model, priority: 1, visibility: 'list', supported_reasoning_levels: efforts.map(effort => ({ effort })) }],
});

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'trio-model-policy-test-'));
  const env = { USERPROFILE: directory, HOME: directory, PATH: '', ANCHOR_DATA_DIR: path.join(directory, 'anchor-data') };
  const write = (filename, value) => {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, typeof value === 'string' ? value : JSON.stringify(value), 'utf8');
  };
  t.after(() => {
    clearModelPolicyCache();
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('trio-model-policy-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return {
    directory, env, write,
    primary: path.join(env.ANCHOR_DATA_DIR, 'settings.json'),
    mirror: path.join(directory, '.anchor', 'model_prefs.json'),
  };
}

test('standalone absence uses historical Claude seats, never stale seat environment', t => {
  const { env } = fixture(t);
  env.TRIO_DRIVER_CODING = 'grok';
  env.TRIO_DRIVER_REVIEW = 'gemini';
  const actual = loadPolicyPrefs(env);
  assert.equal(actual.source, 'historical-default');
  assert.equal(actual.coding_family, 'claude');
  assert.equal(actual.review_family, 'claude');
  assert.equal(actual.default_cli, 'claude');
  assert.deepEqual(actual.model_policy, DEFAULT_POLICY);
});

test('present primary beats a stale mirror and primary_path never redirects', t => {
  const { env, write, primary, mirror, directory } = fixture(t);
  const redirected = path.join(directory, 'unrelated.json');
  write(redirected, prefs({ coding_family: 'gemini' }));
  write(primary, prefs({ primary_path: redirected }));
  write(mirror, prefs({ coding_family: 'claude', settings_revision: 99, primary_path: redirected }));
  assert.equal(loadPolicyPrefs(env).coding_family, 'chatgpt');
  assert.equal(loadPolicyPrefs(env).settings_revision, 7);
  assert.equal(loadPolicyPrefs(env).source, 'primary');
});

test('absent primary permits a valid mirror even with ANCHOR_DATA_DIR configured', t => {
  const { env, write, mirror } = fixture(t);
  write(mirror, prefs({ primary_path: 'nonexistent-file-that-must-not-be-followed' }));
  assert.equal(loadPolicyPrefs(env).source, 'mirror');
  assert.equal(loadPolicyPrefs(env).coding_family, 'chatgpt');
  delete env.ANCHOR_DATA_DIR;
  assert.equal(loadPolicyPrefs(env).source, 'mirror');
});

test('corrupt present primary blocks rather than using valid mirror or defaults', t => {
  const { env, write, primary, mirror } = fixture(t);
  write(primary, '{');
  write(mirror, prefs());
  assert.throws(() => loadPolicyPrefs(env), error => error instanceof PolicyUnavailable && error.code === 'settings_invalid');
});

test('every present preference object requires all three valid family choices', t => {
  const { env, write, primary } = fixture(t);
  for (const key of ['coding_family', 'review_family', 'default_cli']) {
    const incomplete = prefs();
    delete incomplete[key];
    write(primary, incomplete);
    assert.throws(() => loadPolicyPrefs(env), /Missing or invalid/);
    write(primary, prefs({ [key]: 'invented-provider' }));
    assert.throws(() => loadPolicyPrefs(env), /Missing or invalid/);
  }
});

test('legacy complete prefs migrate policy intent in memory without model pins', t => {
  const { env, write, primary } = fixture(t);
  const legacy = prefs();
  delete legacy.model_policy;
  delete legacy.settings_revision;
  write(primary, legacy);
  const actual = loadPolicyPrefs(env);
  assert.deepEqual(actual.model_policy, DEFAULT_POLICY);
  assert.equal(actual.settings_revision, 0);
  assert.equal(JSON.parse(fs.readFileSync(primary, 'utf8')).model_policy, undefined);
});

test('invalid policy and invalid revisions fail closed', t => {
  const { env, write, primary } = fixture(t);
  for (const model_policy of [null, {}, { mode: 'pinned', effort: 'highest_supported' }, { ...DEFAULT_POLICY, model: 'pin' }, { ...DEFAULT_POLICY, constructor: 'unexpected' }]) {
    write(primary, prefs({ model_policy }));
    assert.throws(() => loadPolicyPrefs(env), error => error.code === 'settings_invalid');
  }
  for (const settings_revision of [null, false, -1, 0.5, '2', Number.MAX_SAFE_INTEGER + 1]) {
    write(primary, prefs({ settings_revision }));
    assert.throws(() => loadPolicyPrefs(env), /settings_revision/);
  }
});

test('Codex selects by advertised priority, excludes hidden entries, and uses highest effort', () => {
  const raw = { models: [
    { slug: 'aaa-hidden', priority: 0, hidden: true, supported_reasoning_levels: [{ effort: 'ultra' }] },
    { slug: 'aaa-visible', priority: 9, supported_reasoning_levels: [{ effort: 'max' }] },
    { slug: 'zzz-current', priority: 1, supported_reasoning_levels: [{ effort: 'low' }, { effort: 'ultra' }] },
  ] };
  const actual = selectModel('chatgpt', normalizeCatalog('chatgpt', raw));
  assert.equal(actual.model, 'zzz-current');
  assert.equal(actual.effort, 'ultra');
  assert.equal(actual.selection_evidence, 'provider_priority');
  assert.equal(actual.model_attested, false);
});

test('Codex data/camelCase catalog form is supported', () => {
  const actual = selectModel('chatgpt', normalizeCatalog('chatgpt', { data: [{
    id: 'synthetic-catalog-id', priority: 0,
    supportedReasoningEfforts: [{ reasoningEffort: 'high' }, { reasoningEffort: 'max' }],
  }] }));
  assert.equal(actual.model, 'synthetic-catalog-id');
  assert.equal(actual.effort, 'max');
});

test('no priority means stable provider order with an explicit evidence warning', () => {
  const actual = selectModel('chatgpt', { models: [
    { model: 'zzz-first', supportedReasoningEfforts: ['high'] },
    { model: 'aaa-second', priority: 0, supportedReasoningEfforts: ['ultra'] },
  ] });
  assert.equal(actual.model, 'zzz-first');
  assert.equal(actual.selection_evidence, 'provider_catalog_order');
  assert.match(actual.warning, /priority is unavailable/);
});

test('explicit provider upgrade links outrank a stale original rank', () => {
  const actual = selectModel('chatgpt', { models: [
    { slug: 'synthetic-old', priority: 1, upgrade: { model: 'synthetic-new' }, supportedReasoningEfforts: ['high'] },
    { slug: 'synthetic-new', priority: 20, supportedReasoningEfforts: ['max', 'ultra'] },
  ] });
  assert.equal(actual.model, 'synthetic-new');
  assert.equal(actual.effort, 'ultra');
  assert.match(actual.selection_evidence, /provider_upgrade/);
});

test('absent and cyclic upgrade targets fail instead of silently using the old model', () => {
  assert.throws(() => selectModel('chatgpt', { models: [{
    slug: 'synthetic-old', priority: 1, upgrade: 'not-in-catalog', supportedReasoningEfforts: ['high'],
  }] }), /upgrade target is absent/);
  assert.throws(() => selectModel('chatgpt', { models: [
    { slug: 'synthetic-one', priority: 1, upgrade: 'synthetic-two', supportedReasoningEfforts: ['high'] },
    { slug: 'synthetic-two', priority: 2, upgrade: { id: 'synthetic-one' }, supportedReasoningEfforts: ['high'] },
  ] }), /cycle/);
});

test('Grok capability normalization preserves order and discards secrets and extra metadata', () => {
  const normalized = normalizeCatalog('grok', { models: {
    'synthetic-first': { api_key: 'fixture-secret', headers: { authorization: 'fixture-secret' }, info: {
      model: 'synthetic-first', hidden: false, reasoning_efforts: [{ value: 'low' }, { value: 'xhigh' }], prompt: 'fixture-private-prompt',
    } },
    'synthetic-second': { info: { id: 'synthetic-second', reasoning_efforts: [{ id: 'ultra' }] } },
  } });
  const actual = selectModel('grok', normalized);
  assert.equal(actual.model, 'synthetic-first');
  assert.equal(actual.effort, 'xhigh');
  assert.match(actual.warning, /does not attest/);
  assert.equal(JSON.stringify(normalized).includes('fixture-secret'), false);
  assert.equal(JSON.stringify(normalized).includes('fixture-private-prompt'), false);
});

test('Claude uses its moving best alias and advertised maximum, never a release name', () => {
  const actual = selectModel('claude', normalizeCatalog('claude', '\n  --effort <level> Effort for this session (low, medium, high, xhigh, max) (default: high)\n  --model <model> Model\n'));
  assert.equal(actual.model, 'best');
  assert.equal(actual.effort, 'max');
  assert.equal(actual.selection_evidence, 'provider_moving_alias');
});

test('unknown efforts, missing effort metadata, and unavailable agy capability fail explicitly', () => {
  assert.throws(() => highestEffort(['high', 'future-effort']), /unknown reasoning effort/);
  assert.throws(() => selectModel('chatgpt', codex('synthetic-model', [])), /did not advertise/);
  assert.throws(() => normalizeCatalog('claude', '--effort <level> (low, future)\n'), /unknown reasoning effort/);
  // 2026-10-07: agy 1.3.x has a verified catalog (`agy models`); a missing one still fails explicitly.
  assert.throws(() => normalizeCatalog('gemini', {}), error => error.code === 'capability_probe_failed');
});

test('agy 1.3 catalog: gemini rows only, newest first, highest effort launched as the suffixed id', () => {
  const raw = 'Fetching available models...\ngemini-3.8-flash-high\tGemini 3.8 Flash (High)\n'
    + 'gemini-3.8-flash-low\tGemini 3.8 Flash (Low)\ngemini-3.1-pro-high\tGemini 3.1 Pro (High)\n'
    + 'claude-opus-5-5-high\tClaude Opus 5.5 (High)\n';
  const catalog = normalizeCatalog('gemini', raw);
  assert.deepEqual(catalog.models.map(row => row.model), ['gemini-3.8-flash', 'gemini-3.1-pro']);
  const chosen = selectModel('gemini', catalog);
  assert.deepEqual([chosen.model, chosen.effort], ['gemini-3.8-flash', 'high']);
  assert.deepEqual(modelLaunchArgs({ family: 'gemini', model: chosen.model, effort: chosen.effort }),
    ['--model', 'gemini-3.8-flash-high']);
});

test('model identifiers cannot inject args, TOML, or terminal control characters', () => {
  for (const invalid of ['--permission-bypass', 'model"\nextra=true', 'model\n', 'model\r', 'model name', 'a'.repeat(201), '']) {
    assert.throws(() => normalizeCatalog('chatgpt', codex(invalid)), /invalid model identifier/);
  }
});

test('provider environment strips stale pins and API keys but preserves permissions and subscription identity', () => {
  const env = {
    PATH: 'fixture-path', CODEX_HOME: 'fixture-codex-home', ANCHOR_DATA_DIR: 'fixture-anchor',
    CLAUDE_CODE_OAUTH_TOKEN: 'fixture-subscription-identity', ANTHROPIC_API_KEY: 'fixture-api-key',
    XAI_API_KEY: 'fixture-api-key', OPENAI_API_KEY: 'fixture-api-key', GEMINI_API_KEY: 'fixture-api-key',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'stale-model', TRIO_MODEL_REVIEW: 'stale-model', TRIO_DRIVER_CODING: 'claude',
    GROK_DEFAULT_MODEL: 'stale-model', CODEX_MODEL: 'stale-model', CLAUDE_CODE_EFFORT_LEVEL: 'low',
    CODEX_APPROVAL_POLICY: 'never', CODEX_SANDBOX_MODE: 'workspace-write', CUSTOM_PERMISSION_SETTING: 'keep',
  };
  const actual = policyEnvironment(env);
  assert.equal(actual.CLAUDE_CODE_OAUTH_TOKEN, 'fixture-subscription-identity');
  assert.equal(actual.CODEX_HOME, env.CODEX_HOME);
  assert.equal(actual.CODEX_APPROVAL_POLICY, 'never');
  assert.equal(actual.CODEX_SANDBOX_MODE, 'workspace-write');
  assert.equal(actual.CUSTOM_PERMISSION_SETTING, 'keep');
  assert.equal(actual.ANCHOR_DATA_DIR, env.ANCHOR_DATA_DIR);
  assert.equal(Object.keys(actual).some(key => key.endsWith('API_KEY')), false);
  for (const key of ['ANTHROPIC_DEFAULT_OPUS_MODEL', 'TRIO_MODEL_REVIEW', 'TRIO_DRIVER_CODING', 'GROK_DEFAULT_MODEL', 'CODEX_MODEL', 'CLAUDE_CODE_EFFORT_LEVEL']) {
    assert.equal(actual[key], undefined);
    assert.notEqual(env[key], undefined, 'input environment must not be mutated');
  }
});

test('frozen cached receipt stays stable while forced discovery follows changing model identities', t => {
  const { env } = fixture(t);
  let nextModel = 'synthetic-first';
  let calls = 0;
  const discoverer = () => { calls++; return codex(nextModel); };
  const first = resolveModelPolicy('chatgpt', { env, settings: prefs(), discoverer });
  nextModel = 'synthetic-successor';
  const cached = resolveModelPolicy('chatgpt', { env, settings: prefs({ settings_revision: 8 }), discoverer });
  assert.equal(cached.model, 'synthetic-first');
  assert.equal(cached.settings_revision, 8);
  assert.equal(calls, 1);
  const refreshed = resolveModelPolicy('chatgpt', { env, settings: prefs(), discoverer, force: true });
  assert.equal(refreshed.model, 'synthetic-successor');
  assert.equal(first.model, 'synthetic-first');
  assert.equal(calls, 2);
  assert.equal(first.model_attested, false);
  assert.equal(first.policy_version, 1);
  assert.deepEqual(first.requested_policy, DEFAULT_POLICY);
  assert.ok(Number.isFinite(Date.parse(first.discovered_at)));
});

test('config/auth file metadata changes invalidate capabilities without reading credential content', t => {
  const { env, write, directory } = fixture(t);
  let calls = 0;
  const discoverer = () => { calls++; return codex(`synthetic-capability-${calls}`); };
  const first = resolveModelPolicy('chatgpt', { env, settings: prefs(), discoverer });
  write(path.join(directory, '.codex', 'auth.json'), 'fixture-that-is-not-json-and-is-never-parsed');
  const second = resolveModelPolicy('chatgpt', { env, settings: prefs(), discoverer });
  assert.notEqual(first.model, second.model);
  assert.equal(calls, 2);
});

test('invalid settings block discovery itself and cannot launch using a cached receipt', t => {
  const { env } = fixture(t);
  let calls = 0;
  const discoverer = () => { calls++; return codex(); };
  resolveModelPolicy('chatgpt', { env, settings: prefs(), discoverer });
  assert.throws(() => resolveModelPolicy('chatgpt', { env, settings: prefs({ settings_error: 'invalid primary' }), discoverer }), /preferences are invalid/);
  assert.equal(calls, 1);
});

test('missing native subscription CLI is an explicit failure, not an API fallback', t => {
  const { env } = fixture(t);
  assert.throws(() => resolveModelPolicy('chatgpt', { env, settings: prefs() }), error => error.code === 'cli_unavailable');
});

test('Codex main and subagents use the same selected identity/effort with forced subscription login', () => {
  const args = modelLaunchArgs({ family: 'chatgpt', model: 'synthetic-current', effort: 'ultra' });
  assert.deepEqual(args, [
    '--model', 'synthetic-current', '-c', 'model_reasoning_effort="ultra"',
    '-c', 'agents.default_subagent_model="synthetic-current"',
    '-c', 'agents.default_subagent_reasoning_effort="ultra"',
    '-c', 'forced_login_method="chatgpt"',
  ]);
  assert.equal(args.some(value => /permission|sandbox|approval|dangerously/.test(value)), false);
  assert.deepEqual(modelLaunchArgs({ family: 'grok', model: 'synthetic-current', effort: 'xhigh' }), ['--model', 'synthetic-current', '--reasoning-effort', 'xhigh']);
  assert.deepEqual(modelLaunchArgs({ family: 'claude', model: 'best', effort: 'max' }), ['--model', 'best', '--effort', 'max']);
});
