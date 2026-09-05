// crucible/test/elegance-rc8.test.mjs — RC-8 in the Stage-2 hook: the pure merge and the pass record.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { applyWaveMerges, runWaveCountPass, waveCountSection } from '../bin/elegance-hooks.mjs';

const WAVES = [
  { title: 'W1 — The parser', intent: 'parse', deliverables: ['a.py'], doneWhen: 'parses', dependsOn: null, nonTrivial: true, gwt: [{ given: 'g1', when: 'w1', then: 't1' }] },
  { title: 'W2 — The renderer', intent: 'render', deliverables: ['b.js'], doneWhen: 'renders', dependsOn: 'W1 — The parser', nonTrivial: false, gwt: [{ given: 'g2', when: 'w2', then: 't2' }] },
  { title: 'W3 — The module', deliverables: ['c.py'], doneWhen: 'module', dependsOn: 'W2 — The renderer', nonTrivial: true, gwt: [] },
  { title: 'W4 — The hooks', deliverables: ['d.py'], doneWhen: 'hooks', dependsOn: 'W3 — The module', nonTrivial: true, gwt: [{ given: 'g4', when: 'w4', then: 't4' }] },
];

test('applyWaveMerges: adjacent groups merge with every member\'s deliverables and scenarios; numbering and the serial chain are rewritten', () => {
  const { waves, merged } = applyWaveMerges(WAVES, [{ waves: [1, 2] }, { waves: [3, 4] }]);
  assert.equal(waves.length, 2);
  assert.equal(waves[0].title, 'W1 — The parser + The renderer');
  assert.equal(waves[1].title, 'W2 — The module + The hooks');
  assert.deepEqual(waves[0].deliverables, ['a.py', 'b.js']);
  assert.equal(waves[0].doneWhen, 'parses; renders');
  assert.equal(waves[0].intent, 'parse render');
  assert.equal(waves[0].gwt.length, 2);
  assert.equal(waves[0].dependsOn, null);
  assert.equal(waves[1].dependsOn, 'W1 — The parser + The renderer');
  assert.equal(waves[1].nonTrivial, true);
  assert.deepEqual(merged.map((m) => m.from), [[1, 2], [3, 4]]);
  const none = applyWaveMerges(WAVES, []);
  assert.deepEqual(none.waves.map((w) => w.title), WAVES.map((w) => w.title));
  assert.equal(none.merged.length, 0);
});

test('runWaveCountPass: applies only the undisputed merge, writes the record, and the draft section names it', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crucible-rc8-'));
  try {
    const agent = async (prompt, opts) => (opts.role === 'synthesizer'
      ? { merges: [{ waves: [1, 2], reason: 'a parser without its renderer is invisible' }, { waves: [3, 4], reason: 'dead code without hooks' }] }
      : { disputes: [{ waves: [3, 4], severity: 'MAJOR', reason: 'the hooks touch three finish points' }] });
    const logs = [];
    const out = await runWaveCountPass({ waves: WAVES, northStar: 'ns', agent, artifactsDir: dir, log: (m) => logs.push(m) });
    assert.equal(out.before, 4);
    assert.equal(out.after, 3);
    assert.deepEqual(out.waves.map((w) => w.title), ['W1 — The parser + The renderer', 'W2 — The module', 'W3 — The hooks']);
    assert.equal(out.waves[2].dependsOn, 'W2 — The module');
    const md = fs.readFileSync(path.join(dir, 'ELEGANCE-RC8-stage2.md'), 'utf8');
    assert.match(md, /4 wave\(s\) → \*\*3\*\*/);
    assert.match(md, /\| waves 1\+2 \| a parser without its renderer is invisible \| no \| yes \|/);
    assert.match(md, /\| waves 3\+4 \| dead code without hooks \| MAJOR: the hooks touch three finish points \| no \|/);
    assert.ok(fs.existsSync(path.join(dir, 'elegance-rc8-stage2.json')));
    assert.ok(logs.some((l) => /RC-8 \(wave count\): 4 wave\(s\) → 3 — merged: 1\+2/.test(l)), logs.join(' | '));
    assert.match(waveCountSection(out), /## Wave count \(RC-8\)/);
    assert.equal(waveCountSection(null), '');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
