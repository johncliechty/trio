// drivers/test/elegance-pass-rc8.test.mjs — RC-8, the wave-count question (John, 2026-09-05).
// Scripted seats: the catcher proposes merges, the adversary disputes one; only undisputed,
// well-formed (adjacent, non-overlapping) merges are confirmed. Hermetic.
import test from 'node:test';
import assert from 'node:assert/strict';

import { runWaveCountCheck, normalizeWaveMerges, RC_BATTERY } from '../elegance-pass.mjs';

const WAVES = [
  { title: 'W1 — parser', deliverables: ['a.py'], doneWhen: 'parses' },
  { title: 'W2 — renderer', deliverables: ['b.js'], doneWhen: 'renders', dependsOn: 'W1 — parser' },
  { title: 'W3 — module', deliverables: ['c.py'], doneWhen: 'module', dependsOn: 'W2 — renderer' },
  { title: 'W4 — hooks', deliverables: ['d.py'], doneWhen: 'hooks', dependsOn: 'W3 — module' },
  { title: 'W5 — release', deliverables: ['CHANGELOG.md'], doneWhen: 'tagged', dependsOn: 'W4 — hooks' },
];

test('RC-8: the catcher proposes, the adversary disputes, only undisputed adjacent merges are confirmed', async () => {
  const roles = [];
  const agent = async (prompt, opts) => {
    roles.push(opts.role);
    if (opts.role === 'synthesizer') {
      assert.ok(prompt.includes('[1] W1 — parser') && prompt.includes('[5] W5 — release'));
      return { merges: [
        { waves: [1, 2], reason: 'a parser without its renderer is invisible' },
        { waves: [3, 4], reason: 'a module without its hooks is dead code' },
        { waves: [2, 3], reason: 'overlaps — must be dropped' },
        { waves: [1, 5], reason: 'not adjacent — must be dropped' },
        { waves: [9, 10], reason: 'out of range — must be dropped' },
      ] };
    }
    assert.ok(prompt.includes('waves 1+2') && prompt.includes('waves 3+4'), 'the adversary sees only the well-formed merges');
    return { disputes: [{ waves: [3, 4], severity: 'MAJOR', reason: 'the hooks touch three finish points — a reviewer wants their GREEN alone' }] };
  };
  const out = await runWaveCountCheck({ waves: WAVES, northStar: 'ns', agent });
  assert.deepEqual(roles, ['synthesizer', 'shark']);
  assert.deepEqual(out.merges.map((m) => m.waves), [[1, 2], [3, 4]]);
  assert.deepEqual(out.confirmed.map((m) => m.waves), [[1, 2]]);
  assert.equal(out.disputes.length, 1);
  assert.match(out.lines[0], /RC-8: merge waves 1\+2 — a parser without its renderer/);
});

test('RC-8: a MINOR dispute moves nothing; fewer than two waves asks nothing', async () => {
  let calls = 0;
  const agent = async (prompt, opts) => {
    calls++;
    if (opts.role === 'synthesizer') return { merges: [{ waves: [1, 2], reason: 'one change' }] };
    return { disputes: [{ waves: [1, 2], severity: 'MINOR', reason: 'cosmetic' }] };
  };
  const out = await runWaveCountCheck({ waves: WAVES.slice(0, 2), northStar: 'ns', agent });
  assert.deepEqual(out.confirmed.map((m) => m.waves), [[1, 2]]);
  const one = await runWaveCountCheck({ waves: WAVES.slice(0, 1), northStar: 'ns', agent });
  assert.deepEqual(one, { merges: [], confirmed: [], disputes: [], lines: [] });
  assert.equal(calls, 2, 'a one-wave list never reaches a seat');
});

test('normalizeWaveMerges: adjacency, range, overlap', () => {
  const n = normalizeWaveMerges([{ waves: [2, 3, 4], reason: 'r' }, { waves: [4, 5], reason: 'overlap' }, { waves: [1] }, { waves: ['6', '7'], reason: 'strings' }], 7);
  assert.deepEqual(n.map((m) => m.waves), [[2, 3, 4], [6, 7]]);
  assert.match(RC_BATTERY, /RC-8 Wave count/);
});
