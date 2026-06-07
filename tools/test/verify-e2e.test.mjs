// Wave-7 tests: the end-to-end fresh-clone verifier (tools/verify-e2e.mjs).
//
// The marquee test runs the REAL verifier against the REAL repo root — it copies
// the working tree into a temp dir, onboards into a temp HOME, and runs each
// engine's import smoke through the junction. That is the project's done-when:
// "a fresh temp copy of the repo activates all three skills and each import
// smoke passes." The verifier already uses throwaway temp dirs, so this never
// touches the real ~/.claude. Cheaper unit tests cover copyRepo's exclusions and
// the CLI/JSON surface, and a re-scrub gate test mirrors the Wave-7 publish gate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REPO_ROOT,
  EXPECTED_SKILLS,
  copyRepo,
  verifyE2E,
} from '../verify-e2e.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERIFY_CLI = path.join(HERE, '..', 'verify-e2e.mjs');
const SCRUB_CLI = path.join(HERE, '..', 'scrub.mjs');

// Run the real end-to-end check ONCE; assert on the captured result below.
const result = verifyE2E({ srcRoot: REPO_ROOT });

test('verify-e2e: a fresh copy onboards and every step passes', () => {
  assert.equal(result.ok, true, `verify-e2e failed:\n${JSON.stringify(result.steps, null, 2)}`);
  assert.ok(result.steps.length >= 6, 'records copy + onboard + 3 links + 3 smokes');
  for (const s of result.steps) {
    assert.equal(s.ok, true, `step "${s.name}" should pass (detail: ${s.detail})`);
  }
});

test('verify-e2e: all three skills link into the fresh copy', () => {
  for (const skill of EXPECTED_SKILLS) {
    const step = result.steps.find((s) => s.name === `${skill} links into the fresh copy`);
    assert.ok(step, `a link step exists for ${skill}`);
    assert.equal(step.ok, true, `${skill} resolves into the fresh copy`);
  }
});

test('verify-e2e: the researchPrime import spike returns go:true in the copy', () => {
  const spike = result.steps.find((s) => s.name.startsWith('researchPrime import spike'));
  assert.ok(spike, 'the researchPrime spike step exists');
  assert.equal(spike.ok, true, 'spike passes (engine resolves trio internals, no C:\\dev dep)');
  assert.match(spike.detail, /"go":true/, 'spike verdict reports go:true');
});

test('verify-e2e: the crucible smoke proves ../../foreman resolves via the junction', () => {
  const crucible = result.steps.find((s) => s.name.startsWith('crucible engine loads'));
  assert.ok(crucible, 'crucible smoke step exists');
  assert.equal(crucible.ok, true, 'crucible-lib loads (its ../../foreman/bin imports resolved)');
});

test('verify-e2e: leaves no temp dirs behind (default cleanup)', () => {
  // The work dir is created under os.tmpdir() with the trio-e2e- prefix; after a
  // non-keep run the verifier removes it. tempRepo/tempHome are inside it.
  assert.ok(!fs.existsSync(result.tempRepo), 'temp clone removed');
  assert.ok(!fs.existsSync(result.tempHome), 'temp HOME removed');
});

test('copyRepo excludes node_modules/.git/.foreman and checkpoint/log/.env files', () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'trio-copy-src-'));
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'trio-copy-dest-'));
  try {
    // A shipping file, and a representative of every excluded shape.
    fs.mkdirSync(path.join(src, 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(src, 'pkg', 'keep.mjs'), 'export const x = 1;\n');
    fs.mkdirSync(path.join(src, 'node_modules', 'dep'), { recursive: true });
    fs.writeFileSync(path.join(src, 'node_modules', 'dep', 'index.js'), 'nope\n');
    fs.mkdirSync(path.join(src, '.git'), { recursive: true });
    fs.writeFileSync(path.join(src, '.git', 'HEAD'), 'ref\n');
    fs.mkdirSync(path.join(src, '.foreman'), { recursive: true });
    fs.writeFileSync(path.join(src, '.foreman', 'state.json'), '{}\n');
    fs.writeFileSync(path.join(src, 'foreman-checkpoint.json'), '{}\n');
    fs.writeFileSync(path.join(src, 'run.log'), 'logs\n');
    fs.writeFileSync(path.join(src, '.env'), 'SECRET=x\n');

    const n = copyRepo(src, dest);
    assert.equal(n, 1, 'only the one shipping file is copied');
    assert.ok(fs.existsSync(path.join(dest, 'pkg', 'keep.mjs')), 'shipping file copied');
    assert.ok(!fs.existsSync(path.join(dest, 'node_modules')), 'node_modules excluded');
    assert.ok(!fs.existsSync(path.join(dest, '.git')), '.git excluded');
    assert.ok(!fs.existsSync(path.join(dest, '.foreman')), '.foreman excluded');
    assert.ok(!fs.existsSync(path.join(dest, 'foreman-checkpoint.json')), 'checkpoint excluded');
    assert.ok(!fs.existsSync(path.join(dest, 'run.log')), 'log excluded');
    assert.ok(!fs.existsSync(path.join(dest, '.env')), '.env excluded');
  } finally {
    fs.rmSync(src, { recursive: true, force: true });
    fs.rmSync(dest, { recursive: true, force: true });
  }
});

test('CLI: verify-e2e.mjs --json exits 0 and reports ok:true over the real repo', () => {
  const r = spawnSync(process.execPath, [VERIFY_CLI, '--json'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `CLI exits 0\n${r.stdout}\n${r.stderr}`);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, true, 'JSON result is ok:true');
  assert.ok(Array.isArray(out.steps) && out.steps.length >= 6, 'reports the step list');
});

test('re-scrub gate: scrub.mjs --check exits 0 over the whole tree (Wave-7 publish gate)', () => {
  const r = spawnSync(process.execPath, [SCRUB_CLI, '--check', '--root', REPO_ROOT], {
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, `tree must be publish-clean\n${r.stdout}\n${r.stderr}`);
});
