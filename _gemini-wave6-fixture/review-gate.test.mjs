// Wave-6 gate: the Gemini-produced deliverable must pass the literature-review pack's
// Layer-1 doc-contract. This makes the Foreman-on-Gemini hop produce a GATED PACK
// DELIVERABLE (not just code), reusing the real pack built in Wave 1 on the default host.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { loadPack } from '../crucible/bin/packs/registry.mjs';
import { validateDocContract } from '../crucible/bin/packs/layer1-contract.mjs';

test('the Gemini-produced lit-review doc passes the literature-review pack Layer-1 contract', () => {
  const pack = loadPack('literature-review');
  const doc = fs.readFileSync(new URL('./review.md', import.meta.url), 'utf8');
  const r = validateDocContract({ doc, pack });
  assert.equal(r.pass, true, `missing required sections: ${JSON.stringify(r.missing)}`);
  assert.ok(r.checked >= 5, 'all five required sections are checked');
});
