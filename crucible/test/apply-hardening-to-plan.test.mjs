/**
 * apply-hardening-to-plan — inject + re-check journal 0080 obligations.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyHardeningToPlan,
  enforceHardeningGate,
  wavesFromPlanMarkdown,
  renderHardeningObligationsBlock,
} from '../bin/apply-hardening-to-plan.mjs';

test('prose durability plan stays FAIL without real wave gates (no fake synth wave bypass), and passes when real wave gates name mechanisms', () => {
  const bare = [
    '# Plan',
    '',
    'test-command: node scripts/run-all-tests.mjs',
    '',
    '## Wave 1 — Ledger',
    '',
    '**done-when:** the strip is append-only and receipts are never lost',
    '',
  ].join('\n');
  // Appending reference obligations does NOT fabricate a fake trailing synth wave to rubber-stamp missing real wave gates.
  const applied = applyHardeningToPlan({ plan: bare, addsSurface: true });
  assert.equal(applied.gate.pass, false, 'real waves lack concrete atomic/lock/concurrency & five-state gates');
  assert.match(applied.plan, /Property gates \(hardening law/);
  assert.match(applied.plan, /Hardening-gate obligations/);
  assert.match(applied.plan, /dependency-missing/);
  assert.match(applied.plan, /atomic write/);
  assert.ok(applied.injected);
  const enforcedBare = enforceHardeningGate({ plan: bare, addsSurface: true });
  assert.equal(enforcedBare.gate.pass, false, 'enforceHardeningGate refuses to rubber-stamp missing wave gates');

  // Once a real wave specifies concrete verification mechanisms + five failure states, the gate passes genuinely.
  const concrete = [
    '# Plan',
    '',
    'test-command: node scripts/run-all-tests.mjs',
    '',
    '## Wave 1 — Ledger',
    '',
    '**done-when:** append-only ledger uses atomic write + file lock, verified by a concurrency test and five-state harness (dependency-missing, dependency-slow-or-killed, dependency-returns-garbage, backing-store-unreadable, empty-but-valid) with status code + user-visible text.',
    '',
  ].join('\n');
  const verified = enforceHardeningGate({ plan: concrete, addsSurface: true });
  assert.equal(verified.gate.pass, true, verified.gate.detail);
});

test('enforceHardeningGate logs and returns pass for a trivial plan', () => {
  const logs = [];
  const r = enforceHardeningGate({
    plan: '# Plan\n\ntest-command: node --test\n\n## Wave 1 — Rename\n\n**done-when:** button renamed\n',
    addsSurface: false,
    log: (m) => logs.push(m),
  });
  assert.equal(r.gate.pass, true);
  assert.ok(logs.some((l) => /hardening/i.test(l)));
});

test('wavesFromPlanMarkdown splits on ## Wave headings', () => {
  const waves = wavesFromPlanMarkdown('## Wave 1 — A\nbody\n\n## Wave 2 — B\nmore\n');
  assert.equal(waves.length, 2);
  assert.match(waves[0].doneWhen, /Wave 1/);
});

test('renderHardeningObligationsBlock names all five failure states', () => {
  const md = renderHardeningObligationsBlock([{ id: 'durability', why: 'x', requires: ['a concurrency test'] }]);
  assert.match(md, /dependency-missing/);
  assert.match(md, /empty-but-valid/);
  assert.match(md, /concurrency test/);
});
