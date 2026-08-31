// drivers/test/claude-model-routing.test.mjs — 2026-07 per-role model routing.
// Proves the resolveClaudeModel ladder (opts.model → CLAUDE_MODEL_<ROLE> →
// CLAUDE_MODEL → null), role derivation from the Foreman label prefix, the
// makeAgentSeam per-call threading (model/role reach the transport), and the
// makeRoleRoutedAgent mixed-backend dispatch — the seams that pin frontier
// Claude to execute/fix/synthesizer while review fans out to another family.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveClaudeModel, makeAgentSeam } from '../claude.mjs';
import { makeRoleRoutedAgent, registerDriver, resolveDriverFromFamilies } from '../index.mjs';
import { PHYSICAL_RECEIPT_HOOK } from '../seat-contract.mjs';

function acceptedReceipt(family, model) {
  return {
    ok: true,
    status: 'success',
    requested_model: model,
    model_family: family,
    family_attested: true,
    model_served: model,
    model_attested: true,
    degraded: false,
  };
}

test('saved-family law ignores stale TRIO_DRIVER and family environment values', () => {
  const env = {
    TRIO_DRIVER_SHARK: 'stub-env-verify',
    CODING_FAMILY: 'grok',
    REVIEW_FAMILY: 'test-unresolvable-family',
  };
  assert.equal(
    resolveDriverFromFamilies('shark', env),
    'gemini-cli',
    'with no saved prefs, the historical review default wins; stale env is not a family source',
  );
});

test('resolveClaudeModel: explicit model wins over every env rung', () => {
  const env = { CLAUDE_MODEL_EXECUTE: 'env-role', CLAUDE_MODEL: 'env-global' };
  assert.equal(resolveClaudeModel({ model: 'explicit', role: 'execute', env }), 'explicit');
});

test('resolveClaudeModel: per-role env outranks the global; global is the fallback; else null', () => {
  const env = { CLAUDE_MODEL_EXECUTE: 'claude-fable-5', CLAUDE_MODEL: 'global-model' };
  assert.equal(resolveClaudeModel({ role: 'execute', env }), 'claude-fable-5');
  assert.equal(resolveClaudeModel({ role: 'review', env }), 'global-model', 'unrouted role falls to CLAUDE_MODEL');
  assert.equal(resolveClaudeModel({ role: 'review', env: {} }), null, 'no env ⇒ session default (null)');
});

test('TRIO_TIER (2026-07-04): heavy/standard flip every Claude seat; explicit model still wins; tier beats setx env; junk tier ignored', () => {
  // heavy => frontier; standard => one notch below (John's heavy/non-heavy skills)
  assert.equal(resolveClaudeModel({ role: 'execute', env: { TRIO_TIER: 'heavy' } }), 'claude-fable-5');
  assert.equal(resolveClaudeModel({ role: 'execute', env: { TRIO_TIER: 'standard' } }), 'claude-opus-5');
  // the whole point: standard tier flips a machine pinned always-heavy via setx
  assert.equal(
    resolveClaudeModel({ role: 'execute', env: { TRIO_TIER: 'standard', CLAUDE_MODEL_EXECUTE: 'claude-fable-5', CLAUDE_MODEL: 'claude-fable-5' } }),
    'claude-opus-5');
  // explicit model (per-project config) still outranks the tier
  assert.equal(resolveClaudeModel({ model: 'explicit', role: 'execute', env: { TRIO_TIER: 'standard' } }), 'explicit');
  // unknown tier value falls through to the old ladder unchanged
  assert.equal(resolveClaudeModel({ role: 'execute', env: { TRIO_TIER: 'mega', CLAUDE_MODEL: 'global-model' } }), 'global-model');
});

test('resolveClaudeModel: role derives from the Foreman label prefix (execute:/review:/fix:)', () => {
  const env = { CLAUDE_MODEL_EXECUTE: 'exec-m', CLAUDE_MODEL_REVIEW: 'rev-m', CLAUDE_MODEL_FIX: 'fix-m' };
  assert.equal(resolveClaudeModel({ label: 'execute:w3', env }), 'exec-m');
  assert.equal(resolveClaudeModel({ label: 'review:w3#2', env }), 'rev-m');
  assert.equal(resolveClaudeModel({ label: 'fix:w3.1', env }), 'fix-m');
  assert.equal(resolveClaudeModel({ role: 'fix', label: 'review:w3#2', env }), 'fix-m', 'explicit role beats the label');
});

test('resolveClaudeModel: role key is sanitized for env-var form', () => {
  const env = { 'CLAUDE_MODEL_FRESH_EYES': 'fe-m' };
  assert.equal(resolveClaudeModel({ role: 'fresh-eyes', env }), 'fe-m');
});

test('makeAgentSeam threads per-call model/role through to the transport (3rd arg)', async () => {
  const seen = [];
  const runClaude = (prompt, label, callOpts) => {
    seen.push({ label, callOpts });
    return Promise.resolve({ text: 'ok', rec: acceptedReceipt('claude', 'claude-test') });
  };
  const { agent } = makeAgentSeam({ runClaude });
  await agent('p', { label: 'execute:w1', role: 'execute', model: 'claude-fable-5' });
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].callOpts, {
    model: 'claude-fable-5', role: 'execute', timeoutMs: undefined, signal: undefined,
  });
  // 2-arg legacy stubs remain valid: callOpts is additive, never required.
  const legacy = (prompt, label) => Promise.resolve({
    text: 'ok', rec: acceptedReceipt('claude', 'claude-test'),
  });
  const { agent: agent2 } = makeAgentSeam({ runClaude: legacy });
  assert.equal(await agent2('p', { label: 'x' }), 'ok');
});

test('makeRoleRoutedAgent dispatches per role with the route model; default route catches the rest', async () => {
  const calls = [];
  registerDriver({
    name: 'stub-frontier',
    async runAgent(o) {
      calls.push(['frontier', o.role, o.model]);
      o[PHYSICAL_RECEIPT_HOOK]({
        kind: 'initial', outcome: 'accepted', label: o.label,
        receipt: acceptedReceipt('claude', o.model ?? 'claude-test'),
      });
      return 'f';
    },
  });
  registerDriver({
    name: 'stub-swarm',
    async runAgent(o) {
      calls.push(['swarm', o.role, o.model]);
      o[PHYSICAL_RECEIPT_HOOK]({
        kind: 'initial', outcome: 'accepted', label: o.label,
        receipt: acceptedReceipt('gemini', o.model ?? 'gemini-test'),
      });
      return 's';
    },
  });
  const agent = makeRoleRoutedAgent({
    routes: {
      synthesizer: { driver: 'stub-frontier', model: 'claude-fable-5' },
      review: { driver: 'stub-swarm', model: 'gemini-3.1-pro' },
      default: { driver: 'stub-frontier' },
    },
  });
  assert.equal(await agent('p', { role: 'synthesizer', label: 'synthesizer:r1' }), 'f');
  assert.equal(await agent('p', { label: 'review:w2#1' }), 's', 'role derived from the label prefix');
  assert.equal(await agent('p', { label: 'misc' }), 'f', 'unrouted role falls to default');
  assert.deepEqual(calls, [
    ['frontier', 'synthesizer', 'claude-fable-5'],
    ['swarm', 'review', 'gemini-3.1-pro'],
    ['frontier', 'misc', null],
  ]);
});
