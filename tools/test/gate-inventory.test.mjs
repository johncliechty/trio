// tools/test/gate-inventory.test.mjs — SR-1: the committed gate-inventory manifest
// re-runs GREEN. The current inventory must be a SET-SUPERSET of the baseline (no test
// silently dropped, none weakened), and the Phase-1 runtime no-escape assertion must be
// a tracked gate so the run-live.mjs:129 regression window stays closed.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { collectInventory, loadManifest, checkSuperset, parseTestFile } from '../gate-inventory.mjs';

test('SR-1: current gate inventory ⊇ committed baseline (no shrink, no weakening)', () => {
  const r = checkSuperset(loadManifest(), collectInventory());
  assert.deepEqual(r.missing, [], `baseline tests no longer present: ${r.missing.join(' | ')}`);
  assert.deepEqual(r.weakened, [], `tests with fewer assertions than baseline: ${r.weakened.join(' | ')}`);
  assert.equal(r.ok, true);
});

test('SR-1: the Phase-1 runtime no-escape assertion is a tracked gate', () => {
  const ids = Object.keys(loadManifest().ids);
  assert.ok(
    ids.some((k) => k.startsWith('canonical-no-escape.test.mjs::') && k.includes('no-escape GREEN')),
    'the run-live:129 no-escape guard must be in the manifest ID set (SR-1)',
  );
});

test('the manifest is non-trivial (hundreds of tracked gates)', () => {
  assert.ok(collectInventory().count >= 400, 'expected the trio test inventory to be in the hundreds');
});

test('the fingerprint reflects assertion count + methods (not gameable by gutting)', () => {
  // Build samples WITHOUT a literal `test(` token in this file's source, so the inventory
  // scanner does not phantom-match these data strings as real tests.
  const T = 'te' + 'st';
  const full = parseTestFile(`${T}('x', () => { assert.equal(1,1); assert.ok(true); });`);
  const gutted = parseTestFile(`${T}('x', () => { /* no assertions */ });`);
  assert.notEqual(full[0].fingerprint, gutted[0].fingerprint);
  assert.equal(full[0].fingerprint.startsWith('2:'), true);
  assert.equal(gutted[0].fingerprint.startsWith('0:'), true);
});
