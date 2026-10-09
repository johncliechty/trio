// S1 of the slim plan (2026-10-10): every exit leaves ONE honest run record, and every phase - elegance and land
// included - has its own wall clock. No model is called: the run stops at the pre-flight before any agent.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { phaseWalls, aggregate } from '../bin/phase-report.mjs';
import { recordPhase, withAgentHeartbeat } from '../bin/wave-engine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const runLive = path.join(here, '..', 'bin', 'run-live.mjs');

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
}

test('a dirty-sibling HALT before start writes the run record with its reason, taxonomy and RUN_JSON', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'foreman-s1-'));
  const proj = path.join(tmp, 'proj');
  fs.cpSync(path.join(here, '..', 'fixtures', 'canonical-project'), proj, { recursive: true });
  const sib = path.join(tmp, 'sibling');
  fs.mkdirSync(sib);
  git(sib, 'init', '-q');
  fs.writeFileSync(path.join(sib, 'dirty.txt'), 'uncommitted\n');
  const plan = path.join(proj, 'IMPLEMENTATION-PLAN.md');
  fs.appendFileSync(plan, `\nNormative input: "${path.join(sib, 'dirty.txt')}"\n`);
  const runs = path.join(tmp, 'runs');
  const r = spawnSync(process.execPath, [runLive, proj], {
    encoding: 'utf8', timeout: 120000,
    env: { ...process.env, FOREMAN_RUNS_DIR: runs, FOREMAN_ALLOW_DIRTY_SIBLINGS: '' },
  });
  assert.equal(r.status, 3, r.stdout + r.stderr);
  const rec = JSON.parse(fs.readFileSync(path.join(proj, '.foreman', 'run-record.json'), 'utf8'));
  assert.equal(rec.schema, 'foreman-run-record/v1');
  assert.equal(rec.stage, 'pre-flight');
  assert.equal(rec.status, 'HALT');
  assert.equal(rec.exit_code, 3);
  assert.equal(rec.taxonomy, 'dirty-sibling');
  assert.match(rec.halt_reason, /plan-named repo\(s\) not clean/);
  assert.equal(rec.agent_calls, 0);
  assert.ok(rec.phases && 'elegance' in rec.phases.ms && 'land' in rec.phases.ms);
  const json = r.stdout.split('RUN_JSON_START')[1].split('RUN_JSON_END')[0];
  const out = JSON.parse(json);
  assert.equal(out.taxonomy, 'dirty-sibling');
  assert.equal(out.stage, 'pre-flight');
  assert.equal(fs.readdirSync(runs).length, 1, 'one journal capture, in the redirected folder');
});

test('a doctor check is not a run and leaves no run record', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'foreman-s1d-'));
  const proj = path.join(tmp, 'proj');
  fs.cpSync(path.join(here, '..', 'fixtures', 'canonical-project'), proj, { recursive: true });
  spawnSync(process.execPath, [runLive, proj, '--doctor'], {
    encoding: 'utf8', timeout: 120000, env: { ...process.env, FOREMAN_RUNS_DIR: path.join(tmp, 'runs') },
  });
  assert.equal(fs.existsSync(path.join(proj, '.foreman', 'run-record.json')), false);
  assert.equal(fs.existsSync(path.join(tmp, 'runs')), false);
});

test('phase walls sum each phase once, elegance and land included, and only this run', () => {
  const recs = [
    { kind: 'call', label: 'execute:w1', duration_ms: 1000, ts: 5 },          // a call: not a wall record
    { kind: 'phase', phase: 'execute', wave: 1, duration_ms: 1200, ts: 10 },
    { kind: 'gate', label: 'gate:w1.0', phase: 'gate', duration_ms: 300, ts: 11 },
    { kind: 'phase', phase: 'review', wave: 1, duration_ms: 500, ts: 12 },
    { kind: 'phase', phase: 'elegance', wave: 1, duration_ms: 400, ts: 13 },
    { kind: 'phase', phase: 'land', wave: 1, duration_ms: 100, ts: 14 },
    { kind: 'phase', phase: 'execute', wave: 1, duration_ms: 9999, ts: 1 },   // an earlier run
  ];
  const w = phaseWalls(recs, 5);
  assert.deepEqual(w.ms, { execute: 1200, gate: 300, review: 500, fix: 0, elegance: 400, land: 100 });
  assert.equal(w.total_ms, 2500);
  const agg = aggregate(recs);
  assert.equal(agg.byPhase.execute.ms, 1000, 'the call aggregate never counts wall records');
});

test('the engine records a phase per agent wait (fix-N folds into fix) and never throws on timing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foreman-s1p-'));
  await withAgentHeartbeat(() => {}, 'fix-2', async () => 'ok', 60000, { timingsDir: dir, wave: 3 });
  recordPhase(dir, 'land', 3, 12.4);
  recordPhase(path.join(dir, 'missing', '\0bad'), 'land', 3, 1);       // an unwritable place: silently skipped
  const lines = fs.readFileSync(path.join(dir, 'phase-timings.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => [l.kind, l.phase, l.wave]), [['phase', 'fix', 3], ['phase', 'land', 3]]);
  assert.equal(lines[1].duration_ms, 12);
});
