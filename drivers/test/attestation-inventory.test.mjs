// drivers/test/attestation-inventory.test.mjs — Phase 1.2 done-when (c): the spawn-site
// attestation inventory. Two guarantees:
//   1. Every model-spawning driver PARSER yields a well-formed SR-5 stamp from a known
//      envelope (claude + gemini-cli), so the stamp is real, not aspirational.
//   2. Every SOURCE FILE that spawns a model sub-agent (`spawn('claude'…)` /
//      `spawn('gemini'…)`) also produces the SR-5 stamp — so no spawn site can be added
//      that bypasses attestation. This is the "every agent() call routes through an
//      attesting wrapper" guard.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hasAttestation } from '../attest.mjs';
import { parseClaudeFrames } from '../claude.mjs';
import { parseGeminiCliFrames } from '../gemini-cli.mjs';

const TRIO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.foreman', 'test']);
// A model sub-agent spawn, in either form: the direct `spawn('claude'…)` driver
// transports, OR the Wave-7 guarded form `spawnGuarded({ command: 'claude' })` that
// run-live.mjs uses (per-call timeout + kill-on-exit wrapper) — both launch a model
// child and so must attest.
const SPAWN_RE = /spawn\(\s*['"](claude|gemini)['"]|command:\s*['"](claude|gemini)['"]/;
// The file produces an SR-5 stamp — directly (attestStamp/model_attested) or via the
// Wave-7 telemetry builder (makeTelemetryRecord folds the SR-5 stamp in).
const ATTEST_MARKER = /model_attested|attestStamp|makeTelemetryRecord/;

function walk(dir, hit) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) { if (!SKIP_DIRS.has(ent.name)) walk(path.join(dir, ent.name), hit); }
    else if (ent.name.endsWith('.mjs') || ent.name.endsWith('.js')) hit(path.join(dir, ent.name));
  }
}

test('parser inventory: claude + gemini-cli parsers both emit a well-formed SR-5 stamp', () => {
  const claude = parseClaudeFrames(
    [JSON.stringify({ type: 'result', is_error: false, result: 'ok', model: 'claude-opus-4-8' })].join('\n'),
    { label: 'x' },
  ).rec;
  assert.equal(hasAttestation(claude), true);
  assert.equal(claude.model_attested, true);

  const gemini = parseGeminiCliFrames(
    [JSON.stringify({ type: 'result', status: 'success', stats: { models: { 'gemini-3.1-pro-preview': {} } } })].join('\n'),
    { label: 'x' },
  ).rec;
  assert.equal(hasAttestation(gemini), true);
  assert.equal(gemini.model_attested, true);
});

test('spawn-site inventory: every model-spawn source file also produces an SR-5 stamp', () => {
  const spawnSites = [];
  const uncovered = [];
  walk(TRIO_ROOT, (file) => {
    const src = fs.readFileSync(file, 'utf8');
    if (SPAWN_RE.test(src)) {
      spawnSites.push(file);
      if (!ATTEST_MARKER.test(src)) uncovered.push(file);
    }
  });
  // Sanity: the known live spawn sites are present (so the scan isn't vacuously empty).
  assert.ok(spawnSites.length >= 3, `expected >=3 model-spawn sites, found ${spawnSites.length}`);
  assert.deepEqual(uncovered, [], `spawn sites missing SR-5 attestation: ${JSON.stringify(uncovered, null, 2)}`);
});
