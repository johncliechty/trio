import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRoutesFromFamilies,
  isVerificationRole,
  listDrivers,
  makeRoleRoutedAgent,
  normalizeRole,
  resolveDriverFromFamilies,
  VERIFICATION_ROLES,
} from '../index.mjs';

test('normalizeRole applies exact precedence, delimiters, trimming, and casing', () => {
  assert.equal(normalizeRole({ role: '  ReView:later ', label: 'execute:x' }), 'review');
  assert.equal(normalizeRole({ role: 'fresh-eyes#2' }), 'fresh-eyes');
  assert.equal(normalizeRole({ label: 'SYNTHESIZER.phase' }), 'synthesizer');
  assert.equal(normalizeRole({ label: 'Judge\tphase' }), 'judge');
  assert.equal(normalizeRole({ label: 'attack_mode phase' }), 'attack_mode');
  assert.equal(normalizeRole({ role: '  ', label: 'Fix\nwave' }), 'fix');
  assert.equal(normalizeRole({}), null);
});

test('only the two exact legacy labels promote a missing or gate role to gate3', () => {
  for (const label of ['KillFilterGate3', ' killfiltergate3 ', 'Gate3LivenessPing']) {
    assert.equal(normalizeRole({ label }), 'gate3');
    assert.equal(normalizeRole({ role: 'gate', label }), 'gate3');
  }
  for (const label of [
    'KillFilterGate3:suffix', 'KillFilterGate30', 'Gate3LivenessPing.extra',
    'prefixKillFilterGate3', 'gate',
  ]) {
    assert.notEqual(normalizeRole({ role: 'gate', label }), 'gate3');
  }
  assert.equal(normalizeRole({ role: 'review', label: 'KillFilterGate3' }), 'review');
  assert.equal(normalizeRole({ role: 'gate', label: 'ordinary' }), 'gate');
});

test('the closed verification set is exact and drives family routing', () => {
  assert.equal(Object.isFrozen(VERIFICATION_ROLES), true);
  assert.equal(typeof VERIFICATION_ROLES.add, 'undefined');
  assert.deepEqual([...VERIFICATION_ROLES], [
    'review', 'shark', 'reviewer', 'debate', 'refuter', 'gate3', 'verify',
    'judge', 'attacker', 'analysis',
  ]);
  const env = {};
  for (const role of VERIFICATION_ROLES) {
    assert.equal(isVerificationRole({ role }), true, role);
    // (2026-09-04) no prefs ⇒ the review seat is Claude, honestly single-family
    assert.equal(resolveDriverFromFamilies(role, env), 'claude', role);
  }
  for (const role of [null, 'gate', 'synthesizer', 'execute', 'fix', 'fresh-eyes']) {
    assert.equal(isVerificationRole({ role }), false, String(role));
    assert.equal(resolveDriverFromFamilies(role, env), 'claude', String(role));
  }
});

test('default family routes include every verifier explicitly; a coding default cannot capture one', async () => {
  const built = buildRoutesFromFamilies({ env: {} });
  for (const role of VERIFICATION_ROLES) {
    // every verifier carries its OWN route row (never captured by `default`), and with no prefs
    // that row is Claude (2026-09-04) — stamped cross_model:false, never a Gemini nobody selected.
    assert.ok(built.routes[role], role);
    assert.equal(built.routes[role].driver, 'claude', role);
  }
  assert.equal(built.families.cross_model, false);
  assert.equal(listDrivers().includes('gemini-cli-native'), false);
  // An EXPLICIT verifier row is never captured by the coding default (the seam under test):

  let codingCalls = 0;
  let reviewCalls = 0;
  const agent = makeRoleRoutedAgent({
    env: {},
    routes: { default: { driver: 'claude' }, analysis: { driver: 'gemini-cli' } },
    runClaude: async () => {
      codingCalls += 1;
      return { text: 'coding', rec: {
        ok: true, status: 'success', requested_model: 'claude-test',
        model_family: 'claude', family_attested: true,
        model_served: 'claude-test', model_attested: true, degraded: false,
      } };
    },
    runGemini: async () => {
      reviewCalls += 1;
      return { text: 'review', rec: {
        ok: true, status: 'success', requested_model: 'Gemini test',
        model_family: 'gemini', family_attested: true,
        model_served: 'Gemini test', model_attested: true, degraded: false,
      } };
    },
  });
  assert.equal(await agent('code', { role: 'execute' }), 'coding');
  assert.equal(await agent('check', { role: 'analysis' }), 'review');
  assert.equal(codingCalls, 1);
  assert.equal(reviewCalls, 1);
});
