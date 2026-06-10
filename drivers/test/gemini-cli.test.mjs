// drivers/test/gemini-cli.test.mjs — gate for the Gemini CLI HOST backend
// (`gemini-cli`): the login-based, sub-agent-capable `gemini -p` driver (contrast the
// raw-HTTP `gemini` WORKER driver gated in backends.test.mjs).
//
// Everything runs with NO subprocess: frame parsing is tested against the REAL
// stream-json dump captured live 2026-06-10, and the seam is driven by an injected
// `runGemini` stub. Proves: frame parsing, SERVED-model attestation read from the
// result envelope (never argv), the degraded path when the envelope is unattestable,
// model-resolution precedence, argv shaping, the env gate, the prompt-suffix
// schema/retry/ABSTAIN contract (identical to Claude), registry membership, and the
// capability-matrix row.
//
// Exercises REAL source in drivers/gemini-cli.mjs + drivers/index.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HaltError } from '../../foreman/bin/foreman-lib.mjs';
import {
  runAgent, getDriver, listDrivers, capabilityMatrix, geminiCliDriver,
  makeForemanDriver, registerDriver,
} from '../index.mjs';
import {
  parseGeminiCliFrames, resolveGeminiModel, buildGeminiCliArgs, defaultRunGeminiCli,
  resolveGeminiEntry, DEFAULT_GEMINI_CLI_MODEL,
} from '../gemini-cli.mjs';

// The actual frames `gemini --skip-trust -p --output-format stream-json` emitted on
// this host (2026-06-10). Note: init says `model:"auto"` (the REQUEST), while
// stats.models is keyed by the model that actually SERVED — the attestation source.
const REAL_STREAM = [
  '{"type":"init","timestamp":"2026-06-10T12:03:54.495Z","session_id":"404915ee-b125-46ad-95fc-aaf806642483","model":"auto"}',
  '{"type":"message","timestamp":"2026-06-10T12:03:54.495Z","role":"user","content":"Output exactly the single token: PONG"}',
  '{"type":"message","timestamp":"2026-06-10T12:03:57.715Z","role":"assistant","content":"PONG","delta":true}',
  '{"type":"result","timestamp":"2026-06-10T12:03:57.784Z","status":"success","stats":{"total_tokens":16645,"input_tokens":16525,"output_tokens":2,"cached":0,"input":16525,"duration_ms":3289,"tool_calls":0,"models":{"gemini-3.1-pro-preview":{"total_tokens":16645,"input_tokens":16525,"output_tokens":2,"cached":0,"input":16525}}}}',
].join('\n');

// --- frame parsing + attestation -----------------------------------------------

test('parse: real stream-json dump -> text + attested served model from the envelope', () => {
  const { text, rec } = parseGeminiCliFrames(REAL_STREAM, { label: 'smoke', cli_status: 0 });
  assert.equal(text, 'PONG');
  assert.equal(rec.ok, true);
  assert.equal(rec.status, 'success');
  // Attestation: served model is the stats.models KEY, NOT the argv `auto`.
  assert.equal(rec.model_served, 'gemini-3.1-pro-preview');
  assert.equal(rec.model_attested, true);
  assert.equal(rec.output_tokens, 2);
  assert.equal(rec.total_tokens, 16645);
  assert.equal(rec.tools, 0);
  assert.equal(rec.duration_ms, 3289);
  // Gemini's envelope carries no total cost -> honestly null (not a fabricated 0).
  assert.equal(rec.cost_usd, null);
});

test('parse: multiple assistant delta frames concatenate in order', () => {
  const stream = [
    '{"type":"message","role":"assistant","content":"Hello, ","delta":true}',
    '{"type":"message","role":"assistant","content":"world","delta":true}',
    '{"type":"result","status":"success","stats":{"models":{"gemini-3-flash-preview":{}}}}',
  ].join('\n');
  const { text, rec } = parseGeminiCliFrames(stream);
  assert.equal(text, 'Hello, world');
  assert.equal(rec.model_served, 'gemini-3-flash-preview');
  assert.equal(rec.model_attested, true);
});

test('parse: unattestable envelope (no stats.models) -> DEGRADED, never a claim', () => {
  const stream = [
    '{"type":"message","role":"assistant","content":"hi","delta":true}',
    '{"type":"result","status":"success","stats":{"output_tokens":1}}',
  ].join('\n');
  const { rec } = parseGeminiCliFrames(stream);
  assert.equal(rec.model_served, null);
  assert.equal(rec.model_attested, false, 'no stats.models => cannot attest the served model');
});

test('parse: stats.models as an ARRAY -> DEGRADED (no fabricated "0" stamp; SR-5)', () => {
  const stream = '{"type":"result","status":"success","stats":{"models":["gemini-3.1-pro-preview"]}}';
  const { rec } = parseGeminiCliFrames(stream);
  assert.equal(rec.model_served, null, 'an array is not a valid attestation source');
  assert.equal(rec.model_attested, false);
});

test('parse: multiple served models -> attests first but flags multi_model', () => {
  const stream = '{"type":"result","status":"success","stats":{"models":{"gemini-3.1-pro-preview":{},"gemini-3-flash-preview":{}}}}';
  const { rec } = parseGeminiCliFrames(stream);
  assert.equal(rec.model_served, 'gemini-3.1-pro-preview');
  assert.equal(rec.model_attested, true);
  assert.equal(rec.multi_model, true, 'a multi-model envelope is flagged, not silently single-stamped');
});

test('parse: no result frame at all -> ok:false, unattested', () => {
  const { text, rec } = parseGeminiCliFrames('{"type":"message","role":"assistant","content":"partial"}');
  assert.equal(text, 'partial');
  assert.equal(rec.ok, false);
  assert.equal(rec.model_attested, false);
});

test('parse: blank/garbage lines are skipped, not fatal', () => {
  const stream = ['', 'not json', REAL_STREAM, '   '].join('\n');
  const { text, rec } = parseGeminiCliFrames(stream);
  assert.equal(text, 'PONG');
  assert.equal(rec.ok, true);
});

// --- model resolution + argv shaping -------------------------------------------

test('resolveGeminiModel: precedence opts > TRIO_MODEL_<ROLE> > TRIO_MODEL > GEMINI_MODEL > default', () => {
  assert.equal(resolveGeminiModel({ model: 'm-explicit', role: 'judge', env: { TRIO_MODEL: 'x' } }), 'm-explicit');
  assert.equal(resolveGeminiModel({ role: 'judge', env: { TRIO_MODEL_JUDGE: 'm-role', TRIO_MODEL: 'x' } }), 'm-role');
  assert.equal(resolveGeminiModel({ env: { TRIO_MODEL: 'm-trio', GEMINI_MODEL: 'g' } }), 'm-trio');
  assert.equal(resolveGeminiModel({ env: { GEMINI_MODEL: 'm-gem' } }), 'm-gem');
  assert.equal(resolveGeminiModel({ env: {} }), DEFAULT_GEMINI_CLI_MODEL);
});

test('buildGeminiCliArgs: mandatory --skip-trust + stream-json + approval mode + -m (NO -p; prompt is appended separately)', () => {
  const args = buildGeminiCliArgs({ model: 'gemini-3.1-pro-preview', approvalMode: 'plan' });
  assert.ok(args.includes('--skip-trust'), 'headless requires --skip-trust');
  assert.ok(!args.includes('-p'), '-p is appended with the prompt at spawn time, not part of the flag set');
  assert.deepEqual(args.slice(args.indexOf('--output-format'), args.indexOf('--output-format') + 2), ['--output-format', 'stream-json']);
  assert.deepEqual(args.slice(args.indexOf('--approval-mode'), args.indexOf('--approval-mode') + 2), ['--approval-mode', 'plan']);
  assert.deepEqual(args.slice(args.indexOf('-m'), args.indexOf('-m') + 2), ['-m', 'gemini-3.1-pro-preview']);
});

test('resolveGeminiEntry: GEMINI_CLI_JS override is honored when the file exists', () => {
  // This very test file always exists — use it as a stand-in entry path.
  const here = new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const r = resolveGeminiEntry({ GEMINI_CLI_JS: here });
  assert.equal(r.mode, 'node');
  assert.equal(r.entry, here);
  // No override + nothing discoverable in a bare env -> shell fallback.
  assert.equal(resolveGeminiEntry({}).mode, 'shell');
});

// --- env gate ------------------------------------------------------------------

test('env gate: live spawn HALTs unless CRUCIBLE_AGENT_LIVE=1 (no accidental billing)', () => {
  assert.throws(
    () => defaultRunGeminiCli('hi', 'l', { env: {} }),
    (e) => e instanceof HaltError && /live agent seam is disabled/.test(e.reason),
  );
});

// --- seam behavior through runAgent (injected stub, no subprocess) -------------

test('runAgent(gemini-cli, no schema): returns plain text via injected runGemini', async () => {
  const out = await runAgent({
    driver: 'gemini-cli', prompt: 'say hi',
    runGemini: async () => ({ text: 'hello from gemini', rec: { ok: true } }),
  });
  assert.equal(out, 'hello from gemini');
});

test('runAgent(gemini-cli) + schema: fenced JSON reply is parsed', async () => {
  const out = await runAgent({
    driver: 'gemini-cli', prompt: 'review', schema: { type: 'object' },
    runGemini: async () => ({ text: '```json\n{"answerable":"yes","findings":[]}\n```', rec: {} }),
  });
  assert.equal(out.answerable, 'yes');
  assert.deepEqual(out.findings, []);
});

test('runAgent(gemini-cli) + schema: unparseable first reply retries once then succeeds', async () => {
  let calls = 0;
  const out = await runAgent({
    driver: 'gemini-cli', prompt: 'review', schema: { type: 'object' },
    runGemini: async () => { calls += 1; return { text: calls === 1 ? 'not json' : '{"answerable":"yes"}', rec: {} }; },
  });
  assert.equal(calls, 2, 'one initial call + exactly one retry');
  assert.equal(out.answerable, 'yes');
});

test('runAgent(gemini-cli) + schema: unparseable twice -> ABSTAIN (answerable:no)', async () => {
  let calls = 0;
  const out = await runAgent({
    driver: 'gemini-cli', prompt: 'review', schema: { type: 'object' }, label: 'rev:gem',
    runGemini: async () => { calls += 1; return { text: 'never json', rec: {} }; },
  });
  assert.equal(calls, 2, 'initial + one retry, then abstain (no infinite retry)');
  assert.equal(out.answerable, 'no');
  assert.deepEqual(out.findings, []);
  assert.match(out.note, /not parseable/i);
});

// --- registry + capability matrix ----------------------------------------------

test('registry: gemini-cli is registered and selectable via TRIO_DRIVER', () => {
  assert.ok(listDrivers().includes('gemini-cli'));
  assert.equal(getDriver(null, { TRIO_DRIVER: 'gemini-cli' }), geminiCliDriver);
  // explicit arg still overrides; the default with no env stays claude.
  assert.equal(getDriver('claude', { TRIO_DRIVER: 'gemini-cli' }).name, 'claude');
  assert.equal(getDriver(null, {}).name, 'claude');
});

test('capability matrix: gemini-cli is sub-agent-capable (a real HOST), gemini (HTTP) is not', () => {
  const by = Object.fromEntries(capabilityMatrix().map((r) => [r.name, r]));
  assert.equal(by['gemini-cli'].subAgentCapable, true, 'the CLI host spawns real fresh sub-agents');
  assert.equal(by.gemini.subAgentCapable, false, 'the raw-HTTP worker does not');
  assert.match(by['gemini-cli'].structuredOutput, /cli-subagent/i);
});

test('makeForemanDriver forwards role + model to the backend (per-role tier reachable)', async () => {
  const captured = [];
  registerDriver({ name: 'capture-role-backend', async runAgent(opts) { captured.push(opts); return 'ok'; } });
  const drv = await makeForemanDriver({ driver: 'capture-role-backend', model: 'm-designated', role: 'judge' });
  const ctx = { wave: { n: 1, title: 't' }, reviewerIndex: 0, projectDir: '/p', iteration: 1 };
  await drv.execute(ctx);
  assert.equal(captured.length, 1);
  assert.equal(captured[0].model, 'm-designated', 'designated model reaches the backend (was dropped before)');
  assert.equal(captured[0].role, 'judge', 'role reaches the backend so TRIO_MODEL_<ROLE> is resolvable');
  assert.match(captured[0].label, /execute:w1/);
});

// --- live smoke: SKIP (never fail) unless explicitly opted in ------------------

test('gemini-cli live smoke', { skip: process.env.GEMINI_CLI_LIVE ? false : 'set GEMINI_CLI_LIVE=1 for the live smoke' }, async () => {
  const prev = process.env.CRUCIBLE_AGENT_LIVE;
  process.env.CRUCIBLE_AGENT_LIVE = '1';
  try {
    const out = await runAgent({ driver: 'gemini-cli', prompt: 'Reply with the single word: pong', approvalMode: 'plan' });
    assert.match(String(out), /pong/i);
  } finally {
    if (prev === undefined) delete process.env.CRUCIBLE_AGENT_LIVE; else process.env.CRUCIBLE_AGENT_LIVE = prev;
  }
});

test('gemini-cli live timeout: a tiny timeoutMs kills the child -> typed status:timeout', { skip: process.env.GEMINI_CLI_LIVE ? false : 'set GEMINI_CLI_LIVE=1' }, async () => {
  const prev = process.env.CRUCIBLE_AGENT_LIVE;
  process.env.CRUCIBLE_AGENT_LIVE = '1';
  try {
    const { rec } = await defaultRunGeminiCli('Take as long as you like.', 'timeout-probe', { approvalMode: 'plan', timeoutMs: 1 });
    assert.equal(rec.status, 'timeout');
    assert.equal(rec.ok, false);
    assert.equal(rec.model_attested, false, 'a killed run cannot attest a served model');
  } finally {
    if (prev === undefined) delete process.env.CRUCIBLE_AGENT_LIVE; else process.env.CRUCIBLE_AGENT_LIVE = prev;
  }
});
