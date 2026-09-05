// RC-6 at a round boundary: "does the North Star fail without this?" — merely-nice items are parked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCriticalPathCheck } from '../elegance-pass.mjs';

test('runCriticalPathCheck parks the merely-nice, keeps the critical, and never silently parks an unjudged item', async () => {
  const res = await runCriticalPathCheck({
    items: [{ id: 'B1', text: 'seed identity split' }, { id: 'B2', text: 'a 500-paper detour on a fluctuation' }, { id: 'B3', text: 'unjudged' }],
    northStar: 'an on-topic corpus',
    agent: async (prompt, opts) => {
      assert.equal(opts.role, 'synthesizer');
      assert.ok(prompt.includes('[B2]'));
      return { items: [{ id: 'B1', critical: true, reason: 'seeds must be in' }, { id: 'B2', critical: false, reason: 'off the critical path' }] };
    },
  });
  assert.deepEqual(res.critical, ['B1', 'B3']);
  assert.deepEqual(res.parked.map((p) => p.id), ['B2']);
  assert.match(res.lines[0], /possible rabbit hole: \[B2\] .* — pursue or drop\?/);
  const empty = await runCriticalPathCheck({ items: [], northStar: 'x', agent: async () => ({ items: [] }) });
  assert.deepEqual(empty, { critical: [], parked: [], lines: [] });
});
