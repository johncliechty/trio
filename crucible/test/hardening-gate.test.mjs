/**
 * Hardening gate (crucible journal 0080) — a plan that ASSERTS a property must
 * EMIT a mechanical gate for it.
 *
 * The regression: Crucible planned the Ecgberht steward. The plan asserted
 * "Strip is append-only; receipts are never lost" and "the steward never
 * invents; unknown is spoken as unknown". Both shipped as prose. Underneath,
 * the ledger was a bare writeFileSync read-modify-write (concurrent acts
 * silently dropped receipts), and a swallowed exception rendered a BROKEN
 * registry as "no projects" with an ambient queue badge of 0.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkPropertyGates,
  detectPropertyClaims,
  renderPropertyGateChecklist,
  REQUIRED_FAILURE_STATES,
} from '../bin/hardening-gate.mjs';

test('THE REGRESSION: "append-only, never lost" as prose is a FAIL', () => {
  const res = checkPropertyGates({
    plan: 'The Strip is append-only; receipts are never lost. Write authority rejects silent rewrite.',
    waves: [{ doneWhen: 'the chamber renders the view model and acts are closed' }],
  });
  assert.equal(res.pass, false);
  assert.match(res.detail, /durability/);
  const dur = res.missing.find((m) => m.id === 'durability');
  assert.ok(dur.unmet.some((u) => /atomic/i.test(u)), 'atomic write not demanded');
  assert.ok(dur.unmet.some((u) => /lock|serial/i.test(u)), 'serialization not demanded');
  assert.ok(dur.unmet.some((u) => /concurrency/i.test(u)), 'concurrency test not demanded');
});

test('the same claim PASSES when the plan names the mechanism', () => {
  const res = checkPropertyGates({
    plan: 'The Strip is append-only; receipts are never lost.',
    waves: [
      { doneWhen: 'writes are atomic via temp + fsync + rename' },
      { doneWhen: 'a cross-process lock serializes the read-modify-write' },
      { doneWhen: 'a concurrency test spawns two writers and asserts no receipt is dropped' },
    ],
  });
  assert.equal(res.pass, true, res.detail);
});

test('an honesty claim demands unknown and empty be SEPARATE states', () => {
  const res = checkPropertyGates({
    plan: 'The steward never invents; unknown is spoken as unknown.',
    waves: [{ doneWhen: 'the badge renders the queue length' }],
  });
  assert.equal(res.pass, false);
  const h = res.missing.find((m) => m.id === 'honesty');
  assert.ok(h, 'honesty claim not gated');
  assert.match(h.why, /confident wrong answer/);
});

test('a surface-bearing wave must answer for every failure state', () => {
  const res = checkPropertyGates({
    plan: 'Adds the seal chamber endpoints.',
    waves: [{ doneWhen: 'the endpoint returns the view model' }],
    addsSurface: true,
  });
  assert.equal(res.pass, false);
  const t = res.missing.find((m) => m.id === 'failure-state-table');
  assert.ok(t, 'no failure-state table demanded');
  assert.ok(t.unmet.length > 0);
  assert.match(t.why, /status code AND the user-visible text/);
});

test('explicit propertyGates satisfy the obligation', () => {
  const res = checkPropertyGates({
    plan: 'Receipts are never lost.',
    waves: [],
    propertyGates: {
      durability: [
        'atomic temp+fsync+rename in engine/durable-write.mjs',
        'O_EXCL cross-process lock around the read-modify-write',
        'two-process concurrency test asserting 40/40 receipts survive',
      ],
    },
  });
  assert.equal(res.pass, true, res.detail);
});

test('a plan asserting nothing is not blocked', () => {
  const res = checkPropertyGates({ plan: 'Rename a button and update the copy.', waves: [] });
  assert.equal(res.pass, true);
  assert.match(res.detail, /no property claims/);
});

test('all five property families are detected', () => {
  const claims = detectPropertyClaims(`
    receipts are append-only and never lost;
    the steward never invents an answer;
    the operation is idempotent;
    the read is bounded and backs off;
    paths are contained against traversal.
  `);
  const ids = claims.map((c) => c.id);
  for (const id of ['durability', 'honesty', 'idempotence', 'boundedness', 'containment']) {
    assert.ok(ids.includes(id), `undetected property family: ${id}`);
  }
});

test('the checklist is emittable text, so planners do not improvise wording', () => {
  const claims = detectPropertyClaims('receipts are never lost');
  const md = renderPropertyGateChecklist(claims);
  assert.match(md, /Property gates/);
  assert.match(md, /- \[ \] atomic write/);
  assert.match(md, /BLOCKER/);
  assert.equal(renderPropertyGateChecklist([]), '', 'no claims should render nothing');
});

test('the required failure states include the ones that actually bit us', () => {
  assert.ok(REQUIRED_FAILURE_STATES.includes('backing-store-unreadable'),
    'the registry-unreadable case is what rendered as "no projects"');
  assert.ok(REQUIRED_FAILURE_STATES.includes('empty-but-valid'),
    'empty must be distinguishable from unknown');
  assert.ok(REQUIRED_FAILURE_STATES.includes('dependency-slow-or-killed'),
    'the bridge child is killed on timeout — that is a real state');
});
