/**
 * Delta-coverage gate (foreman journal 0091).
 *
 * The regression this exists to prevent: Foreman built the Ecgberht steward
 * GREEN while it shipped 8 routes, 13 functions and ~670 lines with zero tests.
 * The suite stayed green PRECISELY BECAUSE the new code was untested, so
 * "0 tests for 670 lines" and "full coverage" produced the same verdict.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkDeltaCoverage,
  classifyDelta,
  isTestPath,
  renderDeltaCoverageRequirement,
  DEFAULT_WIREUP_ASSERTIONS,
} from '../bin/delta-coverage-gate.mjs';

test('THE REGRESSION: the steward wave would now be a BLOCKER', () => {
  // Exactly what that wave changed — routes, handlers, frontend, no tests.
  const res = checkDeltaCoverage({
    changedFiles: [
      'route_table.py',
      'anchor_gui.py',
      'static/high-seat.js',
      'static/project-window.js',
    ],
  });
  assert.equal(res.pass, false);
  assert.equal(res.severity, 'BLOCKER');
  assert.match(res.detail, /no test naming them/);
});

test('the same wave PASSES once it carries a stub gate', () => {
  const res = checkDeltaCoverage({
    changedFiles: [
      'route_table.py',
      'anchor_gui.py',
      'static/high-seat.js',
      'tests/test_ecgberht_steward_v12.py',
    ],
    testMentions: `
      test every route reaches a defined handler in route_table
      test the high-seat badge never reports a fake zero queue
      anchor_gui handlers are all routed
    `,
  });
  assert.equal(res.pass, true, res.detail);
});

test('a wave with no surface change is not blocked', () => {
  const res = checkDeltaCoverage({ changedFiles: ['README.md', 'docs/NOTES.md'] });
  assert.equal(res.pass, true);
  assert.match(res.detail, /adds no surface/);
});

test('a green suite is not evidence — the message says so', () => {
  const res = checkDeltaCoverage({ changedFiles: ['bin/newverb.mjs'] });
  assert.equal(res.pass, false);
  assert.match(res.detail, /stays green because the new code is UNTESTED/);
});

test('surface kinds are recognised across languages and layouts', () => {
  const { surfaces } = classifyDelta([
    'route_table.py',
    'src/handlers.ts',
    'bin/ecgberht.mjs',
    'engine/ledger-store.mjs',
    'static/app.jsx',
    'README.md',
  ]);
  const kinds = surfaces.map((s) => s.kind);
  for (const k of ['http-route', 'handler', 'cli', 'persistence', 'frontend']) {
    assert.ok(kinds.includes(k), `missed surface kind ${k}`);
  }
  assert.equal(surfaces.length, 5, 'README must not count as a surface');
});

test('test paths are recognised in both python and node conventions', () => {
  for (const p of [
    'tests/test_thing.py',
    'test/w16-durable-write.test.mjs',
    'src/__tests__/x.spec.ts',
  ]) {
    assert.ok(isTestPath(p), `not recognised as a test: ${p}`);
  }
  assert.ok(!isTestPath('src/latest.py'), 'false positive on a non-test path');
});

test('the emitted requirement names the wire-up assertions and the honesty rule', () => {
  const { surfaces } = classifyDelta(['route_table.py']);
  const md = renderDeltaCoverageRequirement(surfaces);
  for (const a of DEFAULT_WIREUP_ASSERTIONS) assert.ok(md.includes(a), `missing: ${a}`);
  assert.match(md, /USER-VISIBLE TEXT/);
  assert.match(md, /confident wrong answer/);
});

test('it is a DELTA check, not a global percentage', () => {
  // A percentage stays comfortably green while a whole subsystem is bare —
  // which is exactly how the steward shipped untested.
  const res = checkDeltaCoverage({
    changedFiles: ['route_table.py', 'tests/test_unrelated_module.py'],
    testMentions: 'this test is about something else entirely',
  });
  assert.equal(res.pass, false,
    'an unrelated test in the same wave must not satisfy the gate');
});
