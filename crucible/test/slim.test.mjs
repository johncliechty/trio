// S6 of the slim plan (2026-10-10, John's Q3), corrected after the final review of 10-10 (findings 3, 7, 8 and the S5
// spec gap): Crucible's slim profile - one draft, ONE review with elegance folded in, at most one revision, at most
// three model calls, ONE human gate; provenance from the seats' receipts (never a role label); the hardening lint on
// the plan's real acceptance text, recomputed after revision; the WHOLE Foreman handoff, validated by Foreman's own
// contract. Stubbed seats only - no live call.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runSlim, SLIM_MAX_MODEL_CALLS, SLIM_LABELS, northStarOf, validateReview, provenanceOf, slimRunRecord, writeSlimRunRecord } from '../bin/slim.mjs';
import { checkPropertyGates } from '../bin/hardening-gate.mjs';
import { locateDocs, parseWaves } from '../../foreman/bin/foreman-lib.mjs';
import { resolveContract } from '../../foreman/bin/project-engine.mjs';

const PLAN = [
  '# North Star', 'Objective: a tiny calculator CLI.', 'Success: adds two numbers; prints usage on bad input.', 'Non-goals: no GUI.', '',
  '## Pillars', '- one module, one test file', '',
  'test-command: node --test test/*.test.mjs', '',
  '## Wave 1 — add', 'Done when:', '- `node calc.js 2 3` prints 5 (oracle: test/calc.test.mjs)', '',
  '## Wave 2 — usage', 'Done when:', '- bad input prints usage (oracle: test/usage.test.mjs)', '',
].join('\n');
const DOCS_ONLY_PLAN = [
  '# North Star', 'Objective: a usage guide.', 'Success: the guide explains every flag.', 'Non-goals: no code.', '',
  '## Pillars', '- one document', '',
  '## Wave 1 — Guide', 'kind: docs', 'outputs: docs/GUIDE.md', 'Done when:', '- every flag is explained (oracle: docs/GUIDE.md lists each flag)', '',
].join('\n');
const DURABLE_PLAN = PLAN
  .replace('Objective: a tiny calculator CLI.', 'Objective: a tiny calculator CLI whose history log is append-only.')
  .replace('- bad input prints usage (oracle: test/usage.test.mjs)', '- bad input prints usage (oracle: test/usage.test.mjs)\n- history entries survive a restart (oracle: test/history.test.mjs)');
const DURABLE_REVISED = DURABLE_PLAN.replace('- history entries survive a restart (oracle: test/history.test.mjs)',
  '- history writes are atomic via temp + fsync + rename, under a cross-process lock (oracle: test/history.test.mjs)\n- a concurrency test spawns two writers and no entry is lost (oracle: test/history-concurrency.test.mjs)');
const APPROVE = { verdict: 'APPROVE', findings: [] };

/** Foreman's real contract, in-process (the production CLI spawns locate-plan; the test injects the same resolver). */
const inProcessContract = ({ projectDir }) => {
  try {
    const c = resolveContract(projectDir);
    return { pass: true, status: 0, report: { total_waves: c.totalWaves, test_command: c.testCmd } };
  } catch (e) {
    return { pass: false, status: 3, stderr: `HALT: ${e.reason || e.message}${e.detail ? ' — ' + e.detail : ''}` };
  }
};

/** A trio.seat.v1 receipt as the drivers finalize it (the shape slim reads). */
function receipt(label, role, family, { model = null, attested = true, failoverTo = null } = {}) {
  const served = failoverTo || family;
  const requested = { driver: family, family, model: null };
  const servedBlock = { driver: served, family: attested ? served : null, model, family_attested: attested, model_attested: !!model };
  const attempts = [{ ordinal: 1, kind: 'primary', requested, ok: !failoverTo, status: failoverTo ? 'seat_unavailable' : 'success', served: failoverTo ? null : servedBlock }];
  if (failoverTo) attempts.push({ ordinal: 2, kind: 'fallback', requested: { driver: failoverTo, family: failoverTo, model: null }, ok: true, status: 'success', served: servedBlock });
  return {
    schema: 'trio.seat.v1', ok: true, status: failoverTo ? 'success_after_failover' : 'success', label, role,
    verification: role === 'shark', structured: role === 'shark', requested, served: servedBlock, attempts,
    failover: { allowed: role !== 'shark', used: !!failoverTo, blocked_reason: null }, error: null,
  };
}
const CROSS = {
  [SLIM_LABELS.draft]: receipt(SLIM_LABELS.draft, 'synthesizer', 'claude', { model: 'claude-fable-5-1' }),
  [SLIM_LABELS.review]: receipt(SLIM_LABELS.review, 'shark', 'grok', { model: 'grok-4.6-build' }),
};
const SAME = {
  [SLIM_LABELS.draft]: receipt(SLIM_LABELS.draft, 'synthesizer', 'grok'),
  [SLIM_LABELS.review]: receipt(SLIM_LABELS.review, 'shark', 'grok', { model: 'grok-4.6-build' }),
};

function stub(review, { plan = PLAN, revised = PLAN.replace('prints usage', 'prints usage and exits 2'), receipts = null } = {}) {
  const calls = [];
  const agent = async (prompt, opts) => {
    calls.push({ label: opts.label, role: opts.role, schema: !!opts.schema, prompt });
    if (receipts && receipts[opts.label] && typeof opts.onReceipt === 'function') await opts.onReceipt(receipts[opts.label]);
    if (opts.label === SLIM_LABELS.draft) return plan;
    if (opts.label === SLIM_LABELS.review) return review;
    if (opts.label === SLIM_LABELS.revise) return revised;
    throw new Error('unexpected call ' + opts.label);
  };
  return { agent, calls };
}
const outDirFor = (t) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'crucible-slim-'));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  return d;
};

test('an approved plan costs two model calls, writes the WHOLE Foreman contract, and ends in ONE gate', async (t) => {
  const out = outDirFor(t);
  const { agent, calls } = stub(APPROVE, { receipts: CROSS });
  const r = await runSlim({ agent, task: 'a tiny calculator CLI', outDir: out, wellFormedness: inProcessContract, families: { coding: 'claude', review: 'grok' } });
  assert.equal(r.calls, 2);
  assert.deepEqual(calls.map((c) => [c.label, c.role, c.schema]), [[SLIM_LABELS.draft, 'synthesizer', false], [SLIM_LABELS.review, 'shark', true]]);
  assert.match(calls[1].prompt, /ELEGANCE \(three questions/);
  assert.match(calls[0].prompt, /\(oracle: <what proves it>\)/);
  assert.equal(r.gate.halt_for_human, true);
  assert.match(r.gate.pending_action, /the one gate/);
  // the handoff Foreman consumes: description, plan, execution log (+ config naming them), the North Star beside them
  const docs = locateDocs(out);
  assert.equal(docs.source, 'config');
  const c = resolveContract(out);
  assert.equal(c.totalWaves, 2);
  assert.equal(c.testCmd.command, 'node --test test/*.test.mjs');
  assert.equal(r.handoff.pass, true);
  assert.ok(fs.existsSync(path.join(out, 'NORTH-STAR.md')));
  assert.match(northStarOf(r.plan), /^# North Star/);
  // no generated file invents an approval; the review record is honest about who reviewed
  assert.match(fs.readFileSync(docs.description, 'utf8'), /Not yet approved/);
  assert.match(fs.readFileSync(docs.execution_log, 'utf8'), /no waves built yet/);
  const review = fs.readFileSync(path.join(out, 'REVIEW.md'), 'utf8');
  assert.match(review, /model calls: 2 of at most 3/);
  assert.match(review, /independent review: yes/);
  assert.match(r.gate.message, /one review by grok \(grok-4\.6-build\), independent of the drafting family claude/);
  const cfg = JSON.parse(fs.readFileSync(path.join(out, 'foreman.config.json'), 'utf8'));
  assert.equal(cfg.profile, 'slim');
  assert.equal(cfg.triage.depth, 'LITE');
  assert.deepEqual(cfg.docs, { description: 'DESCRIPTION.md', plan: 'IMPLEMENTATION-PLAN.md', execution_log: 'EXECUTION-LOG.md' });
});

test('the hardening lint reads the plan\'s REAL acceptance text and is recomputed after the one revision', async (t) => {
  // the carried representation: parseWaves' `acceptance` is what checkPropertyGates reads
  const before = checkPropertyGates({ plan: DURABLE_PLAN, waves: parseWaves(DURABLE_PLAN) });
  assert.equal(before.pass, false);
  assert.match(before.detail, /durability/);
  const after = checkPropertyGates({ plan: DURABLE_REVISED, waves: parseWaves(DURABLE_REVISED) });
  assert.equal(after.pass, true, after.detail);
  const out = outDirFor(t);
  const { agent, calls } = stub(
    { verdict: 'REVISE', findings: [{ severity: 'MAJOR', issue: 'append-only is claimed with no mechanism', fix: 'name atomic write, lock, concurrency test' }] },
    { plan: DURABLE_PLAN, revised: DURABLE_REVISED, receipts: CROSS },
  );
  const r = await runSlim({ agent, task: 'a tiny calculator CLI', outDir: out, wellFormedness: inProcessContract });
  assert.equal(r.calls, 3);
  assert.equal(SLIM_MAX_MODEL_CALLS, 3);
  assert.equal(r.revised, true);
  assert.match(calls[1].prompt, /durability: missing/, 'the reviewer was told what the lint found');
  assert.match(calls[2].prompt, /append-only is claimed/);
  assert.equal(r.lintBefore.pass, false);
  assert.equal(r.lint.pass, true, r.lint.detail);
  const review = fs.readFileSync(path.join(out, 'REVIEW.md'), 'utf8');
  assert.match(review, /before review: durability/);
  assert.match(review, /after revision: clean/);
  assert.match(r.gate.message, /Hardening lint: clean/);
  assert.match(r.gate.message, /revised once/);
});

test('provenance is what the receipts say: another attested family is independent; the same family, a failed-over draft, an unattested family or no receipt is not', async () => {
  const task = 'x';
  const r1 = await runSlim({ agent: stub(APPROVE, { receipts: SAME }).agent, task, families: { coding: 'grok', review: 'grok' } });
  assert.equal(r1.independent, false);
  assert.equal(r1.cross_model, false);
  assert.match(r1.gate.message, /SAME family that drafted/);
  assert.doesNotMatch(r1.gate.message, /independent of/);
  const failedOver = { [SLIM_LABELS.draft]: receipt(SLIM_LABELS.draft, 'synthesizer', 'claude', { failoverTo: 'grok' }), [SLIM_LABELS.review]: receipt(SLIM_LABELS.review, 'shark', 'grok') };
  const r2 = await runSlim({ agent: stub(APPROVE, { receipts: failedOver }).agent, task, families: { coding: 'claude', review: 'grok' } });
  assert.equal(r2.independent, false, 'the draft actually ran on the review family');
  assert.equal(r2.provenance.draft.failover_used, true);
  assert.match(r2.gate.message, /the draft failed over/);
  const r3 = await runSlim({ agent: stub(APPROVE).agent, task });
  assert.equal(r3.independent, null);
  assert.equal(r3.cross_model, false);
  assert.match(r3.gate.message, /no receipt named its family/);
  const r4 = await runSlim({ agent: stub(APPROVE, { receipts: CROSS }).agent, task });
  assert.equal(r4.independent, true);
  assert.equal(r4.provenance.review.model, 'grok-4.6-build');
  const unattested = { ...CROSS, [SLIM_LABELS.review]: receipt(SLIM_LABELS.review, 'shark', 'grok', { attested: false }) };
  const r5 = await runSlim({ agent: stub(APPROVE, { receipts: unattested }).agent, task });
  assert.equal(r5.independent, false, 'an unattested review family is never claimed independent');
  assert.match(r5.gate.message, /independence not proven/);
});

test('a caller that REQUIRES independence is refused: before any call under same-family prefs, and after the review when the receipts show one family', async () => {
  const { agent, calls } = stub(APPROVE, { receipts: CROSS });
  await assert.rejects(runSlim({ agent, task: 'x', requireIndependentReview: true, families: { coding: 'grok', review: 'grok' } }), /both "grok"/);
  assert.equal(calls.length, 0, 'refused before spending a call');
  const s2 = stub({ verdict: 'REVISE', findings: [{ severity: 'MAJOR', issue: 'x' }] }, { receipts: SAME });
  await assert.rejects(runSlim({ agent: s2.agent, task: 'x', requireIndependentReview: true, families: { coding: 'claude', review: 'grok' } }), /not independent/);
  assert.equal(s2.calls.length, 2, 'no revision is spent on a review that was not independent');
  const ok = await runSlim({ agent: stub(APPROVE, { receipts: CROSS }).agent, task: 'x', requireIndependentReview: true, families: { coding: 'claude', review: 'grok' } });
  assert.equal(ok.independent, true);
  await assert.rejects(runSlim({ agent: stub(APPROVE).agent, task: 'x', requireIndependentReview: true }), /no receipt names the review family/);
});

test('an empty, malformed, verdict-less or failed review never approves and never spends a revision', async () => {
  const cases = [
    ['', /empty/], [null, /empty/], ['not json', /malformed/],
    [{ verdict: 'OK', findings: [] }, /no verdict/], [{ verdict: 'APPROVE' }, /no findings list/],
    [{ verdict: 'APPROVE', findings: [{ severity: 'HUGE', issue: 'x' }] }, /malformed finding/],
    [{ transport_failed: true, note: 'seat unreachable', findings: [] }, /review failed: seat unreachable/],
  ];
  for (const [bad, re] of cases) {
    const { agent, calls } = stub(bad);
    await assert.rejects(runSlim({ agent, task: 'x' }), re);
    assert.equal(calls.length, 2, `two calls, then stop (${JSON.stringify(bad)})`);
  }
  assert.deepEqual(validateReview({ verdict: 'revise', findings: [{ severity: 'major', issue: ' x ', fix: 'y' }] }),
    { verdict: 'REVISE', findings: [{ severity: 'MAJOR', issue: 'x', fix: 'y' }] });
  assert.deepEqual(validateReview(JSON.stringify(APPROVE)), { verdict: 'APPROVE', findings: [] }, 'a JSON string is accepted');
});

test('a plan Foreman could not build stops before any review is spent; a broken or empty revision or draft is refused', async () => {
  const s1 = stub(APPROVE, { plan: '# North Star\nsomething\n\nno waves here' });
  await assert.rejects(runSlim({ agent: s1.agent, task: 'x' }), /wave/i);
  assert.equal(s1.calls.length, 1);
  const revise = { verdict: 'REVISE', findings: [{ severity: 'BLOCKER', issue: 'x' }] };
  await assert.rejects(runSlim({ agent: stub(revise, { revised: 'just prose, no waves' }).agent, task: 'x' }), /wave/i);
  await assert.rejects(runSlim({ agent: stub(revise, { revised: '' }).agent, task: 'x' }), /revision came back empty/);
  await assert.rejects(runSlim({ agent: stub(APPROVE, { plan: '' }).agent, task: 'x' }), /plan came back empty/);
  await assert.rejects(runSlim({ agent: stub(APPROVE, { plan: { agent_failed: true, detail: 'died at launch' } }).agent, task: 'x' }), /drafting seat failed \(died at launch\)/);
});

test('the handoff is validated by Foreman\'s contract, not by headings: a code plan without test-command halts; an artifact-only plan passes with no command', async (t) => {
  const noCmd = PLAN.replace('test-command: node --test test/*.test.mjs\n', '');
  const out1 = outDirFor(t);
  await assert.rejects(runSlim({ agent: stub(APPROVE, { plan: noCmd }).agent, task: 'x', outDir: out1, wellFormedness: inProcessContract }), /not buildable/);
  assert.ok(fs.existsSync(path.join(out1, 'REVIEW.md')), 'what was written stays readable for the human');
  const out2 = outDirFor(t);
  const r = await runSlim({ agent: stub(APPROVE, { plan: DOCS_ONLY_PLAN }).agent, task: 'a usage guide', outDir: out2, wellFormedness: inProcessContract });
  assert.equal(r.handoff.pass, true);
  const c = resolveContract(out2);
  assert.equal(c.testCmd.command, null);
  assert.equal(c.waves[0].waveKind, 'docs');
  assert.match(fs.readFileSync(path.join(out2, 'DESCRIPTION.md'), 'utf8'), /docs wave, outputs docs\/GUIDE\.md/);
});

test('a seat that fails leaves its receipt on the error, so the record says which family failed', async () => {
  const bad = Object.assign(new Error('trio seat seat_unavailable: slim:plan'), { receipt: { ...CROSS[SLIM_LABELS.draft], ok: false, status: 'seat_unavailable', served: null } });
  const agent = async () => { throw bad; };
  await assert.rejects(runSlim({ agent, task: 'x' }), (e) => {
    assert.equal(e.slim.calls, 1);
    assert.equal(e.slim.provenance.draft.family, 'claude');
    assert.equal(e.slim.provenance.draft.ok, false);
    return true;
  });
});

test('the run record (Skill Foundry run capture) carries what the seats said and never claims cross_model without receipts', async (t) => {
  const r = await runSlim({ agent: stub(APPROVE, { receipts: CROSS }).agent, task: 'a tiny calculator CLI' });
  const rec = slimRunRecord({ started: new Date().toISOString(), t0: Date.now(), task: 'a tiny calculator CLI', depth: 'LITE', tier: 'standard', result: r, journalRef: '0106-cockpit-slim-formal-improvement.md' });
  for (const k of ['skill', 'tier', 'started', 'ended', 'input', 'params', 'output', 'result', 'cross_model', 'models', 'duration_s', 'journal_ref']) assert.ok(k in rec, k);
  assert.equal(rec.skill, 'crucible');
  assert.equal(rec.tier, 'slim');
  assert.equal(rec.cross_model, true);
  assert.deepEqual(rec.models.map((m) => [m.role, m.family, m.model_served, m.model_attested]), [['draft', 'claude', 'claude-fable-5-1', true], ['review', 'grok', 'grok-4.6-build', true]]);
  assert.match(rec.result, /review APPROVE/);
  assert.equal(rec.journal_ref, '0106-cockpit-slim-formal-improvement.md');
  assert.equal(rec.params.calls, 2);
  const plain = slimRunRecord({ started: new Date().toISOString(), t0: Date.now(), task: 'x', depth: 'LITE', tier: 'standard', result: await runSlim({ agent: stub(APPROVE).agent, task: 'x' }) });
  assert.equal(plain.cross_model, false);
  assert.deepEqual(plain.models, []);
  const err = Object.assign(new Error('seat down'), { slim: { calls: 1, provenance: provenanceOf({ [SLIM_LABELS.draft]: CROSS[SLIM_LABELS.draft] }) } });
  const halted = slimRunRecord({ started: new Date().toISOString(), t0: Date.now(), task: 'x', depth: 'LITE', tier: 'standard', failure: err });
  assert.match(halted.result, /^HALT: seat down/);
  assert.equal(halted.models.length, 1);
  assert.equal(halted.params.calls, 1);
  assert.equal(halted.cross_model, false);
  const runs = outDirFor(t);
  const file = writeSlimRunRecord(rec, { runsDir: runs });
  assert.ok(file && fs.existsSync(file));
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).skill, 'crucible');
});
