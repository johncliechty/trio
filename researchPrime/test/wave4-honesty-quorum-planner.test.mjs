// test/wave4-honesty-quorum-planner.test.mjs — Wave 4 researchPrime Hardening Verification
// Covers:
//   1. cleanN = 1 single clean quorum-verified round convergence (ELEGANCE.md Rule 5)
//   2. Quorum/Judge honesty: blocking converged=true & verified=true when quorum.met===false or judge CHALLENGE
//   3. Replay honesty: offline runRounds without --live/spawnPanel stamps mode:'replay', verified:false, models:[]
//   4. Regulated-domain safety auto-escalation (medical/clinical, legal liability, financial/fiduciary -> high)
//   5. Multi-family G3 panel routing (>=2 non-drafter families vs honest degraded_quorum:true on 1-family host)
//   6. "chatgpt" + legacy "gpt" lineage canonicalization in lineage-enum.json & independence-accounting.mjs
//   7. Binary 0x00 byte removal in rho-ledger.mjs & fs.realpathSync junction-safe CLI guards across bin/*.mjs
//   8. Non-TTY & shorthand y/yes/approve handling in intake.mjs and plan-gate.mjs
//   9. Question-decomposing matrix-planner.mjs + portfolio domain certifier hooks

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { makeConvergenceTracker, orchestrateRound } from '../bin/round.mjs';
import { assembleDeliverable, checkOutputConformance } from '../bin/deliverable.mjs';
import { calibrationVerdict } from '../bin/rho-ledger.mjs';
import { runRounds } from '../bin/run-rounds.mjs';
import { CURRENT_SCHEMA_VERSION } from '../bin/governance.mjs';
import { adjudicateStakes, detectRegulatedDomain } from '../bin/stakes.mjs';
import { deriveGovernorContract } from '../bin/formal-governor.mjs';
import { committedLineages } from '../bin/lineage-enum.mjs';
import { canonicalizeLineage, lineageOf, countIndependentOrigins } from '../bin/trio-core/independence-accounting.mjs';
import { familyFromDriver, resolveG3PanelRouting } from '../bin/live-round-agent.mjs';
import { parseHumanGateAnswer } from '../bin/intake.mjs';
import { buildResearchPlan, runPlanReviewGate } from '../bin/plan-gate.mjs';
import { planMatrix, detectDomainCertifiers, decomposeObjectiveClaims, PLAN_VERSION } from '../bin/matrix-planner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN_DIR = path.resolve(__dirname, '..', 'bin');

function makeGovRecord(tier = 'medium', { roundBudget = 3, N = 1 } = {}) {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    triageHash: 'w4-triage-hash',
    gate1Decision: 'APPROVE',
    planHash: 'w4-plan-hash',
    gate2Decision: 'APPROVE',
    lockedGovernorOutput: { hash: 'w4-gov-hash', roundBudget, thresholds: { N, K: 4, M: 2 }, tier },
    hostApprovalProvider: 'TTY',
    skill: 'researchPrime',
  };
}

function createRunDir(rootDir, name, { tier = 'medium', reviews = [], adjudications = null, northStar = 'Verify protocol safety' } = {}) {
  const runDir = path.join(rootDir, name);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'governance.json'), JSON.stringify(makeGovRecord(tier), null, 2));
  fs.writeFileSync(path.join(runDir, 'triage-extension-test.json'), JSON.stringify({
    locked: true,
    knobs: { includeAdjudication: true, maxRounds: 3 },
  }, null, 2));
  fs.writeFileSync(path.join(runDir, 'round-1-input.json'), JSON.stringify({
    round: 1,
    northStar,
    stakesTier: tier,
    reviews,
    adjudications: adjudications ?? {
      judge: { decision: 'CONVERGED', reasons: ['dry'] },
      synthesizer: { lean: 'lock', suggestions: [] },
      debate: { survivor: null },
    },
  }, null, 2));
  return runDir;
}

describe('Wave 4 — Quorum, Judge, Replay Honesty & Multi-Family G3 Routing', () => {
  let tmpRoot;
  before(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-wave4-'));
  });
  after(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('cleanN = 1 converges on a single genuinely clean quorum-verified round (Rule 5)', () => {
    const tracker = makeConvergenceTracker({ N: 1 });
    const cleanQuorumRound = {
      tally: { findings: [], newBlockers: [], blockers: [] },
      quorum: { origins: 2, required: 2, met: true },
      judgeVerdict: { verdict: 'CONVERGED', lockable: true },
    };
    const obs = tracker.observe(cleanQuorumRound);
    assert.equal(obs.converged, true);
    assert.equal(obs.mode, 'clean');
  });

  test('quorum.met === false and Judge CHALLENGE (lockable === false) strictly block converged & verified', async () => {
    // 1. Single-lineage reviewers -> quorum.met === false -> cannot converge
    const singleOriginAgent = async (_p, opts = {}) => {
      if (opts.role === 'judge') return { decision: 'CONVERGED', reasons: ['looks fine'] };
      if (opts.role === 'synthesizer') return { lean: 'lock', suggestions: [] };
      return null;
    };
    const rUnmet = await orchestrateRound({
      agent: singleOriginAgent,
      round: 1,
      northStar: 'Verify claim',
      reviews: [
        { reviewer: 'Skeptic', lineage: 'claude', findings: [{ topic: 'nit', severity: 'minor', traces_to_north_star: 'yes' }] },
        { reviewer: 'Analyst', lineage: 'claude', findings: [{ topic: 'nit2', severity: 'minor', traces_to_north_star: 'yes' }] },
      ],
    });
    assert.equal(rUnmet.quorum.met, false);
    const t1 = makeConvergenceTracker({ N: 1 });
    const o1 = t1.observe(rUnmet);
    assert.equal(o1.converged, false, 'quorum.met === false must block converged=true');
    assert.equal(o1.blockedByQuorum, true);

    const dUnmet = assembleDeliverable({
      mode: 'engine',
      rounds: [rUnmet],
      convergence: { converged: false, mode: null },
      calibration: calibrationVerdict({ reviewers: [{ lineage: 'claude' }], useLedger: false }),
      substrateFamilies: ['claude', 'gemini'],
      northStar: 'Verify claim',
    });
    assert.equal(dUnmet.verified, false, 'quorum.met === false must block verified=true');
    assert.equal(dUnmet.degraded_quorum, true);
    assert.equal(checkOutputConformance(dUnmet).ok, true);

    // 2. Judge CHALLENGE (NOT_CONVERGED -> lockable: false) with 2 distinct origins -> cannot converge
    const challengingJudgeAgent = async (_p, opts = {}) => {
      if (opts.role === 'judge') return { decision: 'NOT_CONVERGED', reasons: ['unresolved methodological flaw'] };
      if (opts.role === 'synthesizer') return { lean: 'continue', suggestions: [] };
      return null;
    };
    const rChallenged = await orchestrateRound({
      agent: challengingJudgeAgent,
      round: 1,
      northStar: 'Verify claim',
      reviews: [
        { reviewer: 'Skeptic', lineage: 'claude', findings: [{ topic: 'nit', severity: 'minor', traces_to_north_star: 'yes' }] },
        { reviewer: 'Contrarian', lineage: 'gemini', findings: [{ topic: 'nit2', severity: 'minor', traces_to_north_star: 'yes' }] },
      ],
    });
    assert.equal(rChallenged.quorum.met, true);
    assert.equal(rChallenged.judgeVerdict.lockable, false);
    const t2 = makeConvergenceTracker({ N: 1 });
    const o2 = t2.observe(rChallenged);
    assert.equal(o2.converged, false, 'Judge CHALLENGE (lockable===false) must block converged=true');
    assert.equal(o2.blockedByJudge, true);

    const dChallenged = assembleDeliverable({
      mode: 'engine',
      rounds: [rChallenged],
      convergence: { converged: false, mode: null },
      calibration: calibrationVerdict({ reviewers: [{ lineage: 'claude' }, { lineage: 'gemini' }], useLedger: false }),
      substrateFamilies: ['claude', 'gemini'],
      northStar: 'Verify claim',
    });
    assert.equal(dChallenged.verified, false, 'Judge CHALLENGE must block verified=true');
    assert.equal(checkOutputConformance(dChallenged).ok, true);
  });

  test('offline runRounds (live=false, spawnPanel=false) stamps mode="replay", verified=false, and never fabricates models:["claude"]', async () => {
    const reviews = [
      { reviewer: 'r1', angle: 'a1', lineage: 'claude', findings: [{ claim_id: 'c1', topic: 'nit', severity: 'minor', traces_to_north_star: 'yes', message: 'm1' }] },
      { reviewer: 'r2', angle: 'a2', lineage: 'gemini', findings: [{ claim_id: 'c2', topic: 'nit2', severity: 'minor', traces_to_north_star: 'yes', message: 'm2' }] },
    ];
    const runDir = createRunDir(tmpRoot, 'offline-replay', { tier: 'medium', reviews });
    const res = await runRounds(runDir, { log: () => {} });

    assert.equal(res.mode, 'replay');
    assert.equal(res.verified, false);
    assert.equal(res.deliverable.mode, 'replay');
    assert.equal(res.deliverable.verified, false);
    assert.equal(res.deliverable.cross_model, false);
    assert.deepEqual(res.runState.substrateFamilies, [], 'offline replay must never fabricate ["claude"]');
    assert.equal(checkOutputConformance(res.deliverable).ok, true);
  });

  test('G3 panel routes across >=2 distinct non-drafter families when available, and stamps degraded_quorum:true, verified:false on 1-family host', async () => {
    // Case A: >= 2 non-drafter families available (gemini + chatgpt, drafter = claude)
    const routingMulti = await resolveG3PanelRouting({
      tier: 'high',
      env: { CODING_FAMILY: 'claude', REVIEW_FAMILY: 'gemini' },
      probeAvailableFamilies: async () => ['claude', 'gemini', 'chatgpt'],
    });
    assert.equal(routingMulti.degradedQuorum, false);
    assert.equal(new Set(routingMulti.seatLineages).size, 2);
    assert.deepEqual(routingMulti.seatLineages, ['gemini', 'chatgpt', 'gemini']);

    const runDirMulti = createRunDir(tmpRoot, 'g3-multi-family', { tier: 'high', reviews: [] });
    const artMulti = path.join(runDirMulti, 'ARTIFACT.md');
    fs.writeFileSync(artMulti, '# Claims\n- c1: empirical claim\n');
    const inpMultiPath = path.join(runDirMulti, 'round-1-input.json');
    const inpMulti = JSON.parse(fs.readFileSync(inpMultiPath, 'utf8'));
    inpMulti.artifact = artMulti;
    fs.writeFileSync(inpMultiPath, JSON.stringify(inpMulti, null, 2));

    const stubAgent = async (_p, opts = {}) => {
      if (opts.role === 'reviewer') {
        return {
          findings: [{
            claim_id: `c-${opts.angle}`,
            topic: `check ${opts.angle}`,
            severity: 'minor',
            traces_to_north_star: 'yes',
            message: 'ok',
          }],
        };
      }
      if (opts.role === 'judge') return { decision: 'CONVERGED', reasons: ['verified across families'] };
      if (opts.role === 'synthesizer') return { lean: 'lock', suggestions: [] };
      return null;
    };

    const resMulti = await runRounds(runDirMulti, {
      log: () => {},
      spawnPanel: true,
      agent: stubAgent,
      env: { ...process.env, CODING_FAMILY: 'claude', REVIEW_FAMILY: 'gemini' },
      probeAvailableFamilies: async () => ['claude', 'gemini', 'chatgpt'],
    });
    assert.equal(resMulti.degraded_quorum, false);
    assert.equal(resMulti.convergence.converged, true);
    assert.equal(resMulti.verified, true);
    assert.equal(resMulti.deliverable.mode, 'engine');
    assert.equal(resMulti.deliverable.verified, true);

    // Case B: Only 1 family logged in on the host -> degraded_quorum: true, verified: false
    const runDirSingle = createRunDir(tmpRoot, 'g3-single-family-degraded', { tier: 'high', reviews: [] });
    const artSingle = path.join(runDirSingle, 'ARTIFACT.md');
    fs.writeFileSync(artSingle, '# Claims\n- c1: single-host claim\n');
    const inpSinglePath = path.join(runDirSingle, 'round-1-input.json');
    const inpSingle = JSON.parse(fs.readFileSync(inpSinglePath, 'utf8'));
    inpSingle.artifact = artSingle;
    fs.writeFileSync(inpSinglePath, JSON.stringify(inpSingle, null, 2));

    const resSingle = await runRounds(runDirSingle, {
      log: () => {},
      spawnPanel: true,
      agent: stubAgent,
      env: { ...process.env, CODING_FAMILY: 'claude', REVIEW_FAMILY: 'gemini' },
      probeAvailableFamilies: async () => ['gemini'],
    });
    assert.equal(resSingle.degraded_quorum, true, 'single-family host must stamp degraded_quorum: true');
    assert.equal(resSingle.verified, false, 'single-family host must stamp verified: false');
    assert.equal(resSingle.convergence.converged, false, 'unmet quorum must block convergence');
    assert.equal(resSingle.runState.degraded_quorum, true);
    assert.equal(resSingle.runState.verified, false);
  });
});

describe('Wave 4 — Regulated Stakes Escalation, Lineage Canonicalization, Non-TTY Gate & Matrix Planner', () => {
  let tmpRoot;
  before(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-wave4-meta-'));
  });
  after(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('auto-escalates medical/clinical, legal liability, and financial/fiduciary queries to stakesTier: high', () => {
    const clinical = {
      declared_stakes: 'low',
      reversibility: 'reversible',
      objective: 'Evaluate warfarin and amiodarone drug interaction clinical dosing safety',
    };
    const legal = {
      declared_stakes: 'low',
      reversibility: 'reversible',
      objective: 'Assess contractual indemnification liability and HIPAA compliance exposure',
    };
    const financial = {
      declared_stakes: 'low',
      reversibility: 'reversible',
      objective: 'Audit fiduciary duty and pension trust solvency waterfall valuation',
    };

    for (const sample of [clinical, legal, financial]) {
      assert.equal(detectRegulatedDomain(sample).matched, true);
      const adj = adjudicateStakes(sample);
      assert.equal(adj.tier, 'high', `expected high stakes for: ${sample.objective}`);
      assert.ok(adj.overrides.some((o) => o.axis === 'regulated_domain'));

      const gov = deriveGovernorContract(sample);
      assert.equal(gov.tier, 'high');

      const plan = buildResearchPlan({ inputs: { objective: sample.objective, stakes: sample } });
      assert.equal(plan.tier, 'high');
    }
  });

  test('"chatgpt" and legacy "gpt" canonicalize to "chatgpt" across enum, independence-accounting, and drivers', () => {
    const enumLineages = committedLineages();
    assert.ok(enumLineages.includes('chatgpt'), 'lineage-enum.json must include "chatgpt"');
    assert.ok(!enumLineages.includes('gpt'), 'legacy "gpt" replaced by canonical "chatgpt" in enum');

    assert.equal(canonicalizeLineage('gpt'), 'chatgpt');
    assert.equal(canonicalizeLineage('chatgpt'), 'chatgpt');
    assert.equal(canonicalizeLineage('openai'), 'chatgpt');
    assert.equal(canonicalizeLineage('codex'), 'chatgpt');
    assert.equal(familyFromDriver('chatgpt-cli'), 'chatgpt');
    assert.equal(familyFromDriver('gpt-5'), 'chatgpt');

    assert.equal(lineageOf({ lineage: 'gpt' }), 'chatgpt');
    assert.equal(lineageOf({ lineage: 'chatgpt' }), 'chatgpt');
    assert.equal(
      countIndependentOrigins([{ lineage: 'gpt' }, { lineage: 'chatgpt' }], { attestedLineages: enumLineages }),
      1,
      'gpt and chatgpt are the same lineage and must count as 1 origin',
    );
    assert.equal(
      countIndependentOrigins([{ lineage: 'chatgpt' }, { lineage: 'gemini' }], { attestedLineages: enumLineages }),
      2,
      'chatgpt + gemini must count as 2 attested independent origins (no off-enum bucket collapse)',
    );
  });

  test('rho-ledger.mjs contains zero raw 0x00 bytes and all CLI bin/*.mjs files use fs.realpathSync in direct-invocation guards', () => {
    const rhoBytes = fs.readFileSync(path.join(BIN_DIR, 'rho-ledger.mjs'));
    assert.equal(rhoBytes.includes(0x00), false, 'rho-ledger.mjs must not contain raw binary 0x00 bytes');

    const cliFiles = [
      'approval-provider.mjs',
      'baseline.mjs',
      'contract.mjs',
      'dogfood.mjs',
      'intake.mjs',
      'lineage-enum.mjs',
      'plan-gate.mjs',
      'power-calc.mjs',
      'preregistration.mjs',
      'rho-ledger.mjs',
      'run-rounds.mjs',
    ];
    for (const f of cliFiles) {
      const src = fs.readFileSync(path.join(BIN_DIR, f), 'utf8');
      assert.match(src, /realpathSync/, `${f} CLI guard must use fs.realpathSync for Windows junction safety`);
    }
  });

  test('intake.mjs & plan-gate.mjs accept y/yes/approve case-insensitively and handle non-TTY stdin cleanly without hanging', async () => {
    for (const yesToken of ['y', 'Y', 'yes', 'YES', 'approve', 'APPROVE', '  Yes  ']) {
      assert.equal(parseHumanGateAnswer(yesToken), 'APPROVE');
    }
    assert.equal(parseHumanGateAnswer('edit'), 'EDIT');
    assert.equal(parseHumanGateAnswer('n'), 'ABORT');

    // Programmatic callback returning shorthand 'y' approves both gates cleanly
    const runDirProg = path.join(tmpRoot, 'gate-prog-y');
    const progRes = await runPlanReviewGate(
      { objective: 'Compare SQLite WAL vs LMDB read latency', stakes: { declared_stakes: 'low', reversibility: 'reversible' } },
      {
        runDir: runDirProg,
        promptGate1: async () => 'y',
        promptGate2: async () => 'yes',
      },
    );
    assert.equal(progRes.governanceRecord.gate1Decision, 'APPROVE');
    assert.equal(progRes.governanceRecord.gate2Decision, 'APPROVE');

    // Subprocess CLI on non-TTY closed stdin (input: '') exits cleanly with structured AWAITING_APPROVAL_NON_TTY (no hang/crash)
    const inputsPath = path.join(tmpRoot, 'plan-inputs.json');
    fs.writeFileSync(inputsPath, JSON.stringify({
      objective: 'Test non-TTY gate safety',
      stakes: { declared_stakes: 'low', reversibility: 'reversible' },
    }, null, 2));

    const runDirEof = path.join(tmpRoot, 'gate-eof');
    const eofRun = spawnSync(process.execPath, [path.join(BIN_DIR, 'plan-gate.mjs'), inputsPath, runDirEof], {
      input: '',
      encoding: 'utf8',
      windowsHide: true,
      shell: false,
      timeout: 10_000,
    });
    assert.equal(eofRun.status, 2, `expected structured non-TTY status 2, got ${eofRun.status}: ${eofRun.stderr}`);
    const parsedStatus = JSON.parse(eofRun.stdout.trim());
    assert.equal(parsedStatus.status, 'AWAITING_APPROVAL_NON_TTY');

    // Subprocess CLI with --auto-approve writes governance.json cleanly in non-TTY mode
    const runDirAuto = path.join(tmpRoot, 'gate-auto');
    const autoRun = spawnSync(process.execPath, [path.join(BIN_DIR, 'plan-gate.mjs'), inputsPath, runDirAuto, '--auto-approve'], {
      input: '',
      encoding: 'utf8',
      windowsHide: true,
      shell: false,
      timeout: 10_000,
    });
    assert.equal(autoRun.status, 0, `expected --auto-approve exit 0, got ${autoRun.status}: ${autoRun.stderr}`);
    assert.equal(fs.existsSync(path.join(runDirAuto, 'governance.json')), true);
  });

  test('matrix-planner.mjs decomposes compound questions into sub-claims with falsifiers, rungs, and domain certifier hooks', () => {
    const objective =
      'Prove the asymptotic eigenvalue convergence bound of the stochastic Hessian estimator; ' +
      'meta-analysis of randomized clinical trial citation evidence; ' +
      'DCF equity waterfall valuation tie-out; ' +
      'and whether Delaware fiduciary duty precedent and HIPAA compliance clauses apply';

    const certifiers = detectDomainCertifiers({ objective });
    const skills = certifiers.map((c) => c.skill);
    assert.ok(skills.includes('Ramanujan'), 'math proof/bound triggers Ramanujan');
    assert.ok(skills.includes('Literature-Review'), 'RCT meta-analysis triggers Literature-Review');
    assert.ok(skills.includes('Financial-Analyst'), 'DCF waterfall valuation triggers Financial-Analyst');
    assert.ok(skills.includes('Legal-Beagle'), 'fiduciary precedent / HIPAA clause triggers Legal-Beagle');

    const subClaims = decomposeObjectiveClaims(objective, certifiers);
    assert.ok(subClaims.length >= 4, `expected >= 4 decomposed sub-claims, got ${subClaims.length}`);
    for (const sc of subClaims) {
      assert.ok(sc.id && sc.claim.length > 0 && sc.falsifier.length > 10);
      assert.ok(sc.requiredRung === 'OBSERVED' || sc.requiredRung === 'CORROBORATED');
    }

    const planned = planMatrix({ objective });
    assert.equal(planned.planVersion, PLAN_VERSION);
    assert.deepEqual(planned.subClaims, subClaims);
    assert.equal(planned.domainCertifiers.length, 4);
    assert.ok(planned.matrix.some((row) => row.stage === 'certifier'));
    assert.ok(planned.matrix.some((row) => row.stage === 'evidence' && row.subClaimId === 'sc-1'));

    // Determinism check: identical inputs -> byte-identical output
    assert.deepEqual(planMatrix({ objective }), planned);

    // 7+ clauses are never silently truncated
    const sevenClause = 'clause alpha one; clause beta two; clause gamma three; clause delta four; clause epsilon five; clause zeta six; clause eta seven';
    assert.equal(decomposeObjectiveClaims(sevenClause).length, 7);

    // Blocked rounds reset streaks so N=2 never converges on [quorum.met=false, quorum.met=true]
    const tracker = makeConvergenceTracker({ N: 2, cleanN: 2 });
    const dryReviews = [{ findings: [{ severity: 'minor', traces_to_north_star: 'yes', topic: 't' }] }];
    const r1 = tracker.observe({ reviews: dryReviews, tally: { dry: true }, quorum: { met: false }, judgeVerdict: { lockable: true } });
    assert.equal(r1.dryStreak, 0);
    assert.equal(r1.converged, false);
    const r2 = tracker.observe({ reviews: dryReviews, tally: { dry: true }, quorum: { met: true }, judgeVerdict: { lockable: true } });
    assert.equal(r2.dryStreak, 1);
    assert.equal(r2.converged, false);
    const r3 = tracker.observe({ reviews: dryReviews, tally: { dry: true }, quorum: { met: true }, judgeVerdict: { lockable: true } });
    assert.equal(r3.dryStreak, 2);
    assert.equal(r3.converged, true);
  });
});
