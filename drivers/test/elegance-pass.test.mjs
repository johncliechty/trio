// drivers/test/elegance-pass.test.mjs — the Elegance / Rabbit-Catcher pass (hermetic, injected agent).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeElements, runRabbitCatcher, runRabbitCatcherAdversary, runElegancePass, renderElegancePass, RC_BATTERY } from '../elegance-pass.mjs';

const NS = 'ChatGPT is a first-class Terminal engine in Anchor (John, 2026-09-05).';
const ELEMENTS = [
  { id: 'E1', text: 'delete the chatgpt raise in _check_engine_allowed' },
  { id: 'E2', text: 'a per-backend ENGINE_LAUNCH_ARGS table' },
  { id: 'E3', text: 'stub-PTY tests for start / switch / Doctor fence', kind: 'malleability' },
  { id: 'E4', text: 'a Playwright importorskip live sign-off test inside the suite', kind: 'guard' },
];

function catcherAgent(verdicts) {
  return async (prompt, opts) => {
    assert.equal(opts.role, 'synthesizer');
    assert.ok(prompt.includes('RC-1') && prompt.includes('[E2]'), 'the battery and the elements ride the prompt');
    return { verdicts };
  };
}

test('battery text names every question and the three verdicts', () => {
  for (const q of ['RC-1', 'RC-2', 'RC-3', 'RC-4', 'RC-5', 'RC-6', 'RC-7', 'RC-G']) assert.ok(RC_BATTERY.includes(q), q);
  assert.ok(/KEEP.*HOLD.*CUT/s.test(RC_BATTERY));
});

test('normalizeElements: strings and objects, kinds preserved, blanks dropped', () => {
  const out = normalizeElements(['a', '', { id: 'x', text: 'b', kind: 'guard' }, { title: 'c', kind: 'bogus' }, null]);
  assert.deepEqual(out.map((e) => [e.id, e.text, e.kind]), [['E1', 'a', 'element'], ['x', 'b', 'guard'], ['E4', 'c', 'element']]);
});

test('catcher: a KEEP with only a proposer-written need is downgraded to HOLD (RC-1); unjudged elements are HOLD, never silent KEEP', async () => {
  const res = await runRabbitCatcher({
    elements: ELEMENTS, northStar: NS,
    provenance: { userRatified: ['John 2026-09-05: "Is ChatGPT available for all of the roles in Anchor? Do that, integrate"'],
      proposerWritten: ['North Star criterion 1 (written by the planner this morning)'] },
    agent: catcherAgent([
      { id: 'E1', verdict: 'KEEP', need: 'John 2026-09-05 asked for the seat', provenance: 'user-ratified', rc2: 'the seat stays closed', needed_because: 'the request' },
      { id: 'E2', verdict: 'CUT', need: 'none', provenance: 'none', rc2: 'nothing breaks; one branch suffices', needed_because: '' },
      { id: 'E3', verdict: 'KEEP', need: 'criterion 1 says so', provenance: 'proposer-written', rc2: 'regression net', needed_because: 'malleability' },
    ]),
  });
  const byId = Object.fromEntries(res.verdicts.map((v) => [v.id, v]));
  assert.equal(byId.E1.verdict, 'KEEP');
  assert.equal(byId.E2.verdict, 'CUT');
  assert.equal(byId.E3.verdict, 'HOLD');
  assert.equal(byId.E3.downgraded_from_keep, true);
  assert.equal(byId.E4.verdict, 'HOLD');
  assert.deepEqual(byId.E4.failing, ['not judged']);
  assert.deepEqual(res.cut, ['E2']);
  assert.equal(res.nothingCut, false);
});

test('adversary: a refuted CUT is restored to HOLD with the trigger; an attacked KEEP is demoted; MINOR disputes move nothing', async () => {
  const catcher = await runRabbitCatcher({ elements: ELEMENTS, northStar: NS, agent: catcherAgent([
    { id: 'E1', verdict: 'KEEP', need: 'John asked', provenance: 'user-ratified', rc2: 'seat closed', needed_because: 'x' },
    { id: 'E2', verdict: 'CUT', need: 'none', provenance: 'none', rc2: 'nothing', needed_because: '' },
    { id: 'E3', verdict: 'CUT', need: 'none', provenance: 'none', rc2: 'tests are unused capability', needed_because: '' },
    { id: 'E4', verdict: 'KEEP', need: 'the plan wants a sign-off wave', provenance: 'record', rc2: 'no proof', needed_because: 'y' },
  ]) });
  const adv = await runRabbitCatcherAdversary({ catcher, northStar: NS, agent: async (prompt, opts) => {
    assert.equal(opts.role, 'shark');
    assert.ok(prompt.includes('[E3] CUT'));
    return { disputes: [
      { id: 'E3', disputed_verdict: 'CUT', proposed_verdict: 'KEEP', reason: 'malleability carve-out: tests name the next change', severity: 'MAJOR', trigger: 'keep the tests' },
      { id: 'E4', disputed_verdict: 'KEEP', proposed_verdict: 'CUT', reason: 'a live-spawning suite test is the class that leaked 8,816 sessions', severity: 'BLOCKER' },
      { id: 'E1', disputed_verdict: 'KEEP', proposed_verdict: 'HOLD', reason: 'nit', severity: 'MINOR' },
    ] };
  } });
  const byId = Object.fromEntries(adv.verdicts.map((v) => [v.id, v]));
  assert.equal(byId.E3.verdict, 'HOLD');
  assert.equal(byId.E3.restored_by_adversary, true);
  assert.equal(byId.E4.verdict, 'HOLD');
  assert.equal(byId.E4.demoted_by_adversary, true);
  assert.equal(byId.E1.verdict, 'KEEP');
  assert.deepEqual(adv.confirmedCuts, ['E2']);
  assert.deepEqual(adv.restored, ['E3']);
});

test('the whole pass: confirmed cuts only; the markdown record says what was cut, or "nothing cut" aloud', async () => {
  let calls = 0;
  const agent = async (prompt, opts) => {
    calls += 1;
    if (opts.role === 'synthesizer') return { verdicts: ELEMENTS.map((e) => ({ id: e.id, verdict: e.id === 'E2' ? 'CUT' : 'KEEP', need: 'John asked', provenance: 'user-ratified', rc2: 'x', needed_because: 'y' })) };
    return { disputes: [] };
  };
  const res = await runElegancePass({ elements: ELEMENTS, northStar: NS, agent, context: 'the master plan' });
  assert.equal(calls, 2, 'one catcher call + one adversary call, never more');
  assert.deepEqual(res.cuts, ['E2']);
  assert.match(res.markdown, /\*\*Cut:\*\* \[E2\]/);
  assert.match(res.markdown, /Judged:\*\* the master plan/);
  const none = renderElegancePass({ verdicts: [{ id: 'E1', verdict: 'KEEP', text: 't', need: 'n', provenance: 'record', rc2: '', trigger: '' }] });
  assert.match(none, /Nothing cut/);
  const empty = await runElegancePass({ elements: [], northStar: NS, agent });
  assert.deepEqual(empty.cuts, []);
});

test('a seat reply that is text with a JSON object inside still parses; no JSON is a HALT', async () => {
  const res = await runRabbitCatcher({ elements: ['one thing'], northStar: NS,
    agent: async () => 'Sure — here you go:\n{"verdicts":[{"id":"E1","verdict":"KEEP","need":"the user asked","provenance":"user-ratified","rc2":"","needed_because":""}]}' });
  assert.equal(res.verdicts[0].verdict, 'KEEP');
  await assert.rejects(() => runRabbitCatcher({ elements: ['x'], northStar: NS, agent: async () => 'no json here' }), /no JSON object/);
});

test('the adversary never demotes a KEEP whose need is user-ratified (crucible journal 0099); a record-backed KEEP still can be', async () => {
  const catcher = { verdicts: [
    { id: 'A', verdict: 'KEEP', text: 'the per-project lab manager', need: 'John 2026-09-07: "the jupyter notebooks need to come up"', provenance: 'user-ratified', rc2: 'no lab' },
    { id: 'B', verdict: 'KEEP', text: 'a CLI mirror', need: 'the repo convention', provenance: 'record', rc2: 'nothing user-facing breaks' },
  ] };
  const agent = async () => ({ disputes: [
    { id: 'A', disputed_verdict: 'KEEP', proposed_verdict: 'HOLD', reason: 'ask John to pick (A) or (B)', severity: 'MAJOR', trigger: 'John picks' },
    { id: 'B', disputed_verdict: 'KEEP', proposed_verdict: 'HOLD', reason: 'the convention is the R&D CLI, not this', severity: 'MAJOR', trigger: 'a user asks for it' },
  ] });
  const out = await runRabbitCatcherAdversary({ catcher, elements: [], northStar: 'ns', agent });
  assert.equal(out.disputes.length, 2, 'both disputes are recorded');
  assert.equal(out.verdicts.find((v) => v.id === 'A').verdict, 'KEEP', 'the user-locked KEEP stands');
  assert.equal(out.verdicts.find((v) => v.id === 'B').verdict, 'HOLD', 'the record-backed KEEP is demoted');
  assert.deepEqual(out.demoted, ['B']);
});
