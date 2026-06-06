// test/enhanced.test.mjs — Wave 9 gate for cross-model ENHANCED mode.
// Drives capability-binding + role selection through STUBBED probes (no subprocess)
// and proves the §10 contract: family-diverse Judge selection, reasoning-strength
// Synthesizer selection, per-role stamping present-vs-absent, and graceful
// degrade-and-stamp when nothing extra is reachable. Exercises REAL source in
// bin/enhanced.mjs (and its real composition with bin/judge.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HaltError } from '../bin/crucible-lib.mjs';
import { JUDGE_ROLE, makeJudge } from '../bin/judge.mjs';
import { SYNTHESIZER_ROLE } from '../bin/synthesizer.mjs';
import {
  MODEL_REGISTRY,
  CLAUDE_SUBSTRATE,
  detectReachableModels,
  makeCrossModelProbe,
  selectSynthesizerModel,
  provisionRoles,
  detectAndProvision,
} from '../bin/enhanced.mjs';

/** A CLI probe stub: reachable only for the named commands. */
function probeFor(...cmds) {
  const set = new Set(cmds);
  return (cmd) => set.has(cmd);
}
const probeNone = () => false;

// --- capability binding (try-and-observe) ----------------------------------

test('detectReachableModels: Claude is always the substrate; nothing else without signals', () => {
  const reachable = detectReachableModels({ env: {}, probeCli: probeNone });
  assert.equal(reachable.length, 1);
  assert.equal(reachable[0].family, 'claude');
  assert.equal(reachable[0].via, 'substrate');
  assert.equal(reachable[0].model, CLAUDE_SUBSTRATE.model);
});

test('detectReachableModels: a reachable CLI binds that family via cli', () => {
  const reachable = detectReachableModels({ env: {}, probeCli: probeFor('gemini') });
  const gemini = reachable.find((m) => m.family === 'gemini');
  assert.ok(gemini, 'gemini bound');
  assert.equal(gemini.via, 'cli');
  assert.ok(!reachable.some((m) => m.family === 'gpt'), 'gpt not bound');
});

test('detectReachableModels: an API key binds that family via api-key (no CLI needed)', () => {
  const reachable = detectReachableModels({ env: { OPENAI_API_KEY: 'sk-x' }, probeCli: probeNone });
  const gpt = reachable.find((m) => m.family === 'gpt');
  assert.ok(gpt, 'gpt bound by key');
  assert.equal(gpt.via, 'api-key');
});

test('the registry never includes claude (it is the separate substrate)', () => {
  assert.ok(!MODEL_REGISTRY.some((m) => m.family === 'claude'));
});

// --- family-diverse Judge probe --------------------------------------------

test('makeCrossModelProbe: Claude-authored picks the strongest DIFFERENT family (Gemini→GPT→Grok)', () => {
  const reachable = detectReachableModels({ env: {}, probeCli: probeFor('gemini', 'grok') });
  const probe = makeCrossModelProbe(reachable, 'claude');
  const pick = probe();
  assert.equal(pick.family, 'gemini', 'gemini outranks grok for the Judge');
});

test('makeCrossModelProbe: nothing different-family reachable ⇒ null (Default persona)', () => {
  const reachable = detectReachableModels({ env: {}, probeCli: probeNone }); // claude only
  assert.equal(makeCrossModelProbe(reachable, 'claude')(), null);
});

test('makeCrossModelProbe: a non-Claude author can be judged by Claude (still cross-family)', () => {
  const reachable = detectReachableModels({ env: {}, probeCli: probeNone }); // claude only
  const pick = makeCrossModelProbe(reachable, 'gemini')();
  assert.equal(pick.family, 'claude', 'Claude is a different family than the Gemini author');
});

// --- reasoning-strength Synthesizer selection ------------------------------

test('selectSynthesizerModel: strongest reasoning model wins; else Claude extended-thinking', () => {
  const both = detectReachableModels({ env: {}, probeCli: probeFor('gemini', 'codex') });
  assert.deepEqual(selectSynthesizerModel({ reachable: both }), { model: 'gemini-deep-think', family: 'gemini', mode: 'enhanced', reachable: true });

  const none = detectReachableModels({ env: {}, probeCli: probeNone });
  const sel = selectSynthesizerModel({ reachable: none });
  assert.equal(sel.family, 'claude');
  assert.equal(sel.mode, 'default');
  assert.equal(sel.reachable, false);
});

// --- provisioning: present-vs-absent, stamped ------------------------------

test('provisionRoles (Enhanced): Gemini reachable ⇒ family-diverse Judge + reasoning Synthesizer, both stamped cross-model', () => {
  const reachable = detectReachableModels({ env: {}, probeCli: probeFor('gemini') });
  const p = provisionRoles({ reachable, authorFamily: 'claude' });

  assert.equal(p.mode, 'enhanced');
  // Judge — the §10 G/W/T: Gemini (different family) is selected and stamped.
  assert.equal(p.judge.selection.family, 'gemini');
  assert.equal(p.judge.stamp.role, JUDGE_ROLE);
  assert.equal(p.judge.stamp.cross_model, true);
  assert.equal(p.judge.stamp.model, 'gemini-deep-think');
  // Synthesizer — strongest reasoning model, stamped.
  assert.equal(p.synthesizer.selection.family, 'gemini');
  assert.equal(p.synthesizer.stamp.role, SYNTHESIZER_ROLE);
  assert.equal(p.synthesizer.stamp.cross_model, true);
});

test('provisionRoles (Default degrade): none reachable ⇒ same-model persona + Claude Synthesizer, stamped not-cross-model', () => {
  const reachable = detectReachableModels({ env: {}, probeCli: probeNone });
  const p = provisionRoles({ reachable, authorFamily: 'claude' });

  assert.equal(p.mode, 'default');
  assert.equal(p.judge.selection.mode, 'default');
  assert.equal(p.judge.stamp.cross_model, false, 'degraded Judge is stamped honestly');
  assert.equal(p.judge.stamp.family, 'claude');
  assert.equal(p.synthesizer.stamp.cross_model, false, 'degraded Synthesizer is stamped honestly');
  assert.equal(p.synthesizer.stamp.family, 'claude');
});

test('provisionRoles requires a reachable[] scan', () => {
  assert.throws(() => provisionRoles({}), (e) => e instanceof HaltError);
});

test('detectAndProvision wires detection→provisioning in one call (stubbed probe)', () => {
  const p = detectAndProvision({ authorFamily: 'claude', env: {}, probeCli: probeFor('grok') });
  assert.equal(p.mode, 'enhanced');
  assert.equal(p.judge.stamp.family, 'grok'); // only Grok reachable ⇒ it is the family-diverse Judge
  assert.equal(p.judge.stamp.cross_model, true);
});

// --- real composition with the Wave-3 Judge --------------------------------

test('the Wave-9 probe binds straight into makeJudge: Gemini reachable ⇒ a cross-model Judge stamp', async () => {
  const reachable = detectReachableModels({ env: {}, probeCli: probeFor('gemini') });
  const agent = async () => ({ decision: 'CONVERGED' });
  const judge = makeJudge({ agent, authorFamily: 'claude', probeCrossModel: makeCrossModelProbe(reachable, 'claude') });
  assert.equal(judge.stamp.cross_model, true);
  assert.equal(judge.stamp.family, 'gemini');
  const v = await judge.decide({ northStar: 'NS' });
  assert.equal(v.stamp.model, 'gemini-deep-think');
});

test('and degrades cleanly: nothing reachable ⇒ makeJudge uses the same-model persona stamp', () => {
  const reachable = detectReachableModels({ env: {}, probeCli: probeNone });
  const judge = makeJudge({ agent: async () => ({ decision: 'CONVERGED' }), authorFamily: 'claude', probeCrossModel: makeCrossModelProbe(reachable, 'claude') });
  assert.equal(judge.stamp.cross_model, false);
  assert.equal(judge.stamp.family, 'claude');
});
