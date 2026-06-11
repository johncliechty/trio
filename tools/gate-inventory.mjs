// tools/gate-inventory.mjs — the committed gate-inventory MANIFEST (Phase 0.4 / SR-1).
//
// The falsifiable surface SR-1/SR-6 stand on: a set of gate/test IDs keyed by STABLE,
// path/import-route-INDEPENDENT identity — `<test-file-basename>::<test-name>` — plus an
// assertion-semantics fingerprint (`<assertion-count>:<sorted-method-names>`). "Never
// shrink" = the current inventory is a SET-SUPERSET of the committed baseline, AND no
// retained test has FEWER assertions than its baseline (so the gate is not gameable by
// keeping a name while gutting its assertions, nor by re-homing a file to a new path).
//
//   node tools/gate-inventory.mjs --emit   > rewrite the baseline manifest
//   node tools/gate-inventory.mjs --check   > exit 0 iff current ⊇ baseline (no weakening)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MANIFEST_PATH = path.join(ROOT, 'tools', 'gate-inventory.manifest.json');
export const TEST_DIRS = ['crucible/test', 'foreman/test', 'tools/test', 'drivers/test', 'researchPrime/test'];

// `assert(` or `assert.method(`, plus node:test `t.assert.*` — the assertion surface.
const ASSERT_RE = /\b(?:assert|t\.assert)\s*(?:\.\s*([A-Za-z]+))?\s*\(/g;
// a test( "name" | 'name' declaration (template-literal names are not used in the suite)
const NAME_RE = /\btest\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;

/** Parse one test file's source into [{name, fingerprint}]. Per-test slice = this
 *  test( to the next test( (deterministic), assertions counted within. */
export function parseTestFile(src) {
  const hits = [];
  let m;
  NAME_RE.lastIndex = 0;
  while ((m = NAME_RE.exec(src))) hits.push({ name: m[2], index: m.index });
  const out = [];
  for (let i = 0; i < hits.length; i++) {
    const body = src.slice(hits[i].index, i + 1 < hits.length ? hits[i + 1].index : src.length);
    const methods = new Set();
    let cnt = 0, a;
    ASSERT_RE.lastIndex = 0;
    while ((a = ASSERT_RE.exec(body))) { cnt++; methods.add(a[1] || 'call'); }
    out.push({ name: hits[i].name, fingerprint: `${cnt}:${[...methods].sort().join(',')}` });
  }
  return out;
}

/** Collect the whole inventory: { ids: {id: fingerprint}, count }. */
export function collectInventory(root = ROOT, dirs = TEST_DIRS) {
  const ids = {};
  for (const d of dirs) {
    const dir = path.join(root, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.test.mjs')) continue;
      for (const t of parseTestFile(fs.readFileSync(path.join(dir, f), 'utf8'))) {
        ids[`${f}::${t.name}`] = t.fingerprint; // basename only => path/import-route independent
      }
    }
  }
  return { ids, count: Object.keys(ids).length };
}

const assertionCount = (fp) => Number(String(fp).split(':')[0]) || 0;

/** Superset/non-weakening check of `current` against `baseline`. */
export function checkSuperset(baseline, current) {
  const missing = [], weakened = [];
  for (const [id, fp] of Object.entries(baseline.ids)) {
    if (!(id in current.ids)) { missing.push(id); continue; }
    if (assertionCount(current.ids[id]) < assertionCount(fp)) weakened.push(id);
  }
  const added = Object.keys(current.ids).filter((k) => !(k in baseline.ids));
  return { ok: missing.length === 0 && weakened.length === 0, missing, weakened, added };
}

export function loadManifest(p = MANIFEST_PATH) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function emit() {
  const inv = collectInventory();
  const manifest = {
    _README: 'COMMITTED gate-inventory manifest (Phase 0.4 / SR-1). IDs = <file-basename>::<test-name> '
      + '(path-independent) -> "<assertion-count>:<methods>". "Never shrink" = current ⊇ this baseline AND no '
      + 'retained test weakened. Re-emit ONLY as a logged human re-baseline, never to force a gate green.',
    baseline: 'tools/gate-inventory.manifest.json',
    count: inv.count,
    ids: Object.fromEntries(Object.entries(inv.ids).sort(([a], [b]) => a.localeCompare(b))),
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  return manifest.count;
}

function check() {
  const r = checkSuperset(loadManifest(), collectInventory());
  if (r.ok) { console.error(`gate-inventory OK: superset holds (+${r.added.length} new test(s))`); return 0; }
  console.error(`gate-inventory FAIL: missing=${JSON.stringify(r.missing)} weakened=${JSON.stringify(r.weakened)}`);
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode === '--emit') { const n = emit(); console.error(`wrote ${MANIFEST_PATH} (${n} ids)`); process.exit(0); }
  else if (mode === '--check') { process.exit(check()); }
  else { console.error('usage: gate-inventory.mjs --emit | --check'); process.exit(2); }
}
