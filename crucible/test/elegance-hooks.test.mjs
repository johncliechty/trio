// crucible/test/elegance-hooks.test.mjs — the Rabbit-Catcher at Crucible's two hooks (hermetic).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { elementsFromPlan, applyVerdictsToPlan, elementsFromWaves, applyVerdictsToWaves, runPlanElegancePass, elegancePassSection } from '../bin/elegance-hooks.mjs';

const PLAN = {
  northStar: 'NS', criteria: ['c1'],
  phases: [
    { name: 'Open the gate', nearTermSpecifics: ['delete the raise', 'widen VALID_DEFAULT_CLIS'], deferred: [] },
    { name: 'Launch', nearTermSpecifics: ['a per-backend ENGINE_LAUNCH_ARGS table', 'stub-PTY tests for start and switch'], deferred: ['x'] },
  ],
};
const WAVES = [
  { title: 'W1', deliverables: ['delete the raise', 'a per-backend table'], doneWhen: 'green' },
  { title: 'W2 sign-off wave', deliverables: ['an importorskip live Playwright test in the suite'], doneWhen: 'screenshot exists' },
];

test('elements enumerate every near-term specific / wave deliverable with stable ids and kinds', () => {
  const els = elementsFromPlan(PLAN);
  assert.deepEqual(els.map((e) => e.id), ['P1.1', 'P1.2', 'P2.1', 'P2.2']);
  assert.equal(els[3].kind, 'malleability');
  const w = elementsFromWaves(WAVES);
  assert.deepEqual(w.map((e) => e.id), ['W1.1', 'W1.2', 'W2.1']);
  assert.equal(w[2].kind, 'malleability');   // "test" in the text — the seat may re-classify
  assert.deepEqual(elementsFromWaves([{ title: 'bare', deliverables: [] }]).map((e) => e.text), ['bare']);
});

test('applyVerdictsToPlan: CUT moves the specific to the deferred list (on the record); HOLD annotates the trigger; KEEP untouched', () => {
  const out = applyVerdictsToPlan(PLAN, [
    { id: 'P2.1', verdict: 'CUT' },
    { id: 'P2.2', verdict: 'HOLD', trigger: 'names the next change' },
    { id: 'P1.1', verdict: 'KEEP' },
  ]);
  assert.deepEqual(out.phases[0].nearTermSpecifics, ['delete the raise', 'widen VALID_DEFAULT_CLIS']);
  assert.deepEqual(out.phases[1].nearTermSpecifics, ['stub-PTY tests for start and switch (HOLD — names the next change)']);
  assert.deepEqual(out.phases[1].deferred, ['x', 'a per-backend ENGINE_LAUNCH_ARGS table (CUT by the elegance pass)']);
  assert.deepEqual(PLAN.phases[1].nearTermSpecifics.length, 2, 'pure: the input is untouched');
});

test('applyVerdictsToWaves: CUT removes the deliverable; a wave with every deliverable cut is dropped', () => {
  const out = applyVerdictsToWaves(WAVES, [{ id: 'W1.2', verdict: 'CUT' }, { id: 'W2.1', verdict: 'CUT' }]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].deliverables, ['delete the raise']);
  const held = applyVerdictsToWaves(WAVES, [{ id: 'W2.1', verdict: 'HOLD', trigger: 'the on-screen proof' }]);
  assert.match(held[1].deliverables[0], /HOLD — the on-screen proof/);
});

test('runPlanElegancePass: catcher + adversary on the plan; confirmed cuts applied; the record written; the Shark section rendered', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crucible-elegance-'));
  const calls = [];
  const agent = async (prompt, opts) => {
    calls.push(opts.role);
    if (opts.role === 'synthesizer') return { verdicts: [
      { id: 'P1.1', verdict: 'KEEP', need: 'John asked for the seat', provenance: 'user-ratified', rc2: 'seat closed', needed_because: 'the request' },
      { id: 'P1.2', verdict: 'KEEP', need: 'same', provenance: 'user-ratified', rc2: 'saved default refused', needed_because: 'the request' },
      { id: 'P2.1', verdict: 'CUT', need: 'none', provenance: 'none', rc2: 'one branch suffices', needed_because: '' },
      { id: 'P2.2', verdict: 'CUT', need: 'none', provenance: 'none', rc2: 'unused', needed_because: '' },
    ] };
    return { disputes: [{ id: 'P2.2', disputed_verdict: 'CUT', proposed_verdict: 'KEEP', reason: 'malleability carve-out', severity: 'MAJOR', trigger: 'keep the tests' }] };
  };
  const res = await runPlanElegancePass({ plan: PLAN, northStar: 'NS', criteria: ['c1'], agent, artifactsDir: dir,
    provenance: { userRatified: ['John 2026-09-05: the request'] } });
  assert.deepEqual(calls, ['synthesizer', 'shark']);
  assert.deepEqual(res.cuts, ['P2.1']);
  assert.deepEqual(res.plan.phases[1].nearTermSpecifics, ['stub-PTY tests for start and switch (HOLD — keep the tests)']);
  assert.ok(fs.existsSync(path.join(dir, 'ELEGANCE-PASS.md')));
  const rec = JSON.parse(fs.readFileSync(path.join(dir, 'elegance-pass.json'), 'utf8'));
  assert.deepEqual(rec.cuts, ['P2.1']);
  const section = elegancePassSection(res);
  assert.match(section, /## Elegance pass \(Rabbit-Catcher\)/);
  assert.ok(section.includes('| P2.1 | CUT'), section.slice(0, 400));
  assert.equal(elegancePassSection(null), '');
});

test('runPlanElegancePass over waves: the wave with every deliverable cut is gone from the decomposition', async () => {
  const agent = async (prompt, opts) => opts.role === 'synthesizer'
    ? { verdicts: [
        { id: 'W1.1', verdict: 'KEEP', need: 'John', provenance: 'user-ratified', rc2: 'x', needed_because: 'y' },
        { id: 'W1.2', verdict: 'CUT', need: 'none', provenance: 'none', rc2: 'x', needed_because: '' },
        { id: 'W2.1', verdict: 'CUT', need: 'none', provenance: 'none', rc2: 'a live-spawning suite test', needed_because: '' },
      ] }
    : { disputes: [] };
  const res = await runPlanElegancePass({ waves: WAVES, northStar: 'NS', agent });
  assert.deepEqual(res.cuts, ['W1.2', 'W2.1']);
  assert.equal(res.waves.length, 1);
  assert.deepEqual(res.waves[0].deliverables, ['delete the raise']);
});
