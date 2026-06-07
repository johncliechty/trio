// bin/round.mjs — Wave 7 ROUND ORCHESTRATION (Phase C-2).
//
// MASTER-PLAN Phase C-2 / IMPLEMENTATION-PLAN Wave 7: the multi-round adversarial loop that sits
// ON TOP of the Wave-6 evidenced core (C-1). It fills the engine's Wave-7 gate-slots' BEHAVIOR
// (bin/engine.mjs GATE_SLOTS, `fills:'Wave 7'`); the engine/governor WIRING of these behaviors is
// Wave 8 ("Governor wiring + inclusion-test enforcement"). Wave 7 builds + proves the behaviors as
// discrete, testable seams, each a concrete `node --test` assertion (the Stage-2 lock).
//
// The gates this wave lands (with the done-when item each serves):
//   G3  heterogeneous ≥2-agree reviewers — REUSE the trio roster (SHARK_ROLES/angleForShark) + the
//       trio tally (`tallyFindings`), which already does the ≥2-agree quorum.
//   G6  stable finding identity — REUSE the trio's `normalizeFindingId` (inside `tallyFindings`).
//   G5  convergence-until-dry — the dry predicate (a) + an HONEST convergence tracker where an
//       EMPTY round does NOT increment the dry counter (b, I7).
//   (c) suspiciously-dry probe-or-dissent — a high-stakes run reaching dry in < K rounds with > M
//       unresolved high-severity findings fires it; on single-family substrate it emits the
//       "shared-blind-spot un-mitigable" stamp, NOT a mitigation claim (I1).
//   G9  conditional debate — fires exactly once on a conflicting INDEPENDENT-ORIGIN pair, zero
//       otherwise (d).
//   GATE-1 / G8  independent origins + cross-lineage fusion — every origin number routes through
//       the Wave-2 SHARED module (the sole counter, I3/h); G8 is flagged-INERT by default behind
//       the lineage-enum gate (g) so (a)–(f) reach GREEN before the enum is committed.
//   G4  separate context-free Judge · active Synthesizer — REUSE the trio's `makeJudge` /
//       `makeSynthesizer`, exposed through a call-count spy seam (f); the Synthesizer's steering is
//       measured against a token/round-matched control (e).
//
// REUSE, NOT FORK: the trio surface is taken from bin/engine.mjs (`TRIO_SURFACE`, already imported
// there — one load), and every origin count goes through `#trio-core/independence-accounting.mjs`
// (the same canonical package-map route the engine + verify-core use). This module re-homes NO trio
// logic; it composes the trio makers behind researchPrime's verification-round seams.

import { TRIO_SURFACE } from './engine.mjs';
import {
  meetsQuorum,
  countIndependentOrigins,
  lineageOf,
  STATIC_QUORUM_FLOOR,
} from '#trio-core/independence-accounting.mjs';
import { committedLineages } from './lineage-enum.mjs';
import { loadPreregistration } from './preregistration.mjs';

// Reused trio symbols (the frozen contract surface, bin/contract.mjs). G3/G5/G6 ride on the trio
// tally + roster; G4 on the Judge; the active Synthesizer on makeSynthesizer.
const { tallyFindings, normalizeFindingId, SHARK_ROLES, angleForShark } = TRIO_SURFACE['shark-tank'];
const { makeJudge } = TRIO_SURFACE['judge'];
const { makeSynthesizer } = TRIO_SURFACE['synthesizer'];
const { HaltError } = TRIO_SURFACE['foreman-lib'];

// ── Severity taxonomy ────────────────────────────────────────────────────────────────────────────
/** The high-severity band (what the suspiciously-dry guard counts as "unresolved high-severity"). */
export const HIGH_SEVERITIES = Object.freeze(['BLOCKER', 'MAJOR']);

/** Is this finding high-severity (BLOCKER/MAJOR)? */
export function isHighSeverity(f) {
  return HIGH_SEVERITIES.includes(String(f?.severity || '').toUpperCase());
}

/**
 * Count the still-OPEN high-severity findings — the `unresolvedHighSeverity` input the
 * suspiciously-dry guard (c) reads. A finding is unresolved unless explicitly `resolved` (the Judge
 * or a G9 debate can resolve one); an unresolved BLOCKER/MAJOR surviving to a fast dry is exactly
 * the shared-blind-spot signature the guard fires on.
 */
export function countUnresolvedHighSeverity(findings = []) {
  if (!Array.isArray(findings)) {
    throw new TypeError('countUnresolvedHighSeverity(findings): findings must be an array');
  }
  return findings.filter((f) => isHighSeverity(f) && !f?.resolved).length;
}

// ── Reading the FROZEN loop thresholds (N, K, M) committed in Wave 1 (I6) ──────────────────────────
/**
 * The pre-registered loop thresholds the convergence + suspicious-dry logic reads. They were
 * committed by a human in Wave 1 (preregistration.json); reading them HERE — never re-declaring
 * them — keeps the loop honest (I6: the gate cannot be gamed by a locally-chosen number).
 * @returns {{N:number, K:number, M:number}}
 */
export function loopThresholds(prereg = loadPreregistration()) {
  const out = {};
  for (const k of ['N', 'K', 'M']) {
    const v = prereg[k];
    if (!Number.isInteger(v)) {
      throw new HaltError(
        `round orchestration needs the committed loop threshold ${k} (Wave-1 preregistration). ` +
          `Got ${JSON.stringify(v)} — commit it before running the loop (I6).`,
      );
    }
    out[k] = v;
  }
  return out;
}

// ── (a) the dry-round predicate · (b) the EMPTY-round guard ────────────────────────────────────────
/** The per-round reviews, accepting either a raw reviews[] or a round object carrying `.reviews`. */
function reviewsOf(round) {
  if (Array.isArray(round)) return round;
  return Array.isArray(round?.reviews) ? round.reviews : [];
}

/**
 * A DRY round: the tally surfaced NO new blocker (the trio's `tallyFindings().dry`). This is the
 * convergence signal — but only a NON-EMPTY dry round counts toward convergence (see the tracker).
 */
export function isDryRound(round) {
  return !!round?.tally?.dry;
}

/**
 * An EMPTY round: the reviewers produced NO findings at all — nothing was actually examined. This
 * is DISTINCT from a dry round (where findings were raised but none was a NEW blocker). I7 honest
 * convergence: a run must not be able to "converge" by simply declining to look, so an empty round
 * is invisible to the dry counter.
 */
export function isEmptyRound(round) {
  const reviews = reviewsOf(round);
  const total = reviews.reduce((n, r) => n + (Array.isArray(r?.findings) ? r.findings.length : 0), 0);
  return total === 0;
}

// ── G5 — convergence-until-dry, with the I7 honest-convergence guard ───────────────────────────────
/**
 * Build a convergence tracker: the run is CONVERGED after N consecutive NON-EMPTY dry rounds.
 *
 * I7 (b): an EMPTY round does NOT increment the dry counter — it is simply not counted (neither
 * advances nor resets the streak), so a run cannot manufacture convergence with empty rounds.
 *
 * @param {{N:number}} o  N = the pre-registered dry-round convergence threshold (Wave 1)
 */
export function makeConvergenceTracker({ N } = {}) {
  if (!Number.isInteger(N) || N < 1) {
    throw new HaltError('makeConvergenceTracker: N must be an integer >= 1 (the committed threshold)');
  }
  let dryStreak = 0;
  let rounds = 0;
  let countedRounds = 0; // non-empty rounds — the only ones convergence sees
  return {
    /**
     * Observe one completed round. Returns the post-observation state, including whether this round
     * COUNTED (non-empty) and whether the run has now CONVERGED.
     */
    observe(round) {
      rounds += 1;
      if (isEmptyRound(round)) {
        // I7: not counted — the dry streak is untouched (NOT incremented, NOT reset).
        return { converged: dryStreak >= N, counted: false, empty: true, dryStreak, rounds, countedRounds };
      }
      countedRounds += 1;
      if (isDryRound(round)) dryStreak += 1;
      else dryStreak = 0;
      return { converged: dryStreak >= N, counted: true, empty: false, dryStreak, rounds, countedRounds };
    },
    state() {
      return { dryStreak, rounds, countedRounds, converged: dryStreak >= N };
    },
  };
}

// ── (c) suspiciously-dry → probe-or-dissent (I1) ───────────────────────────────────────────────────
/** The literal stamp a single-family substrate puts on an un-mitigable shared blind spot (I1). */
export const SHARED_BLIND_SPOT_STAMP =
  'shared blind spot — UN-MITIGABLE on single-family substrate (I1): a same-lineage probe reproduces ' +
  'the shared wrong consensus, so the unresolved high-severity finding is FLAGGED, not mitigated';

/**
 * Decide whether a converged high-stakes run is SUSPICIOUSLY dry and, if so, fire the
 * probe-or-dissent — honestly.
 *
 * Suspicious (MASTER-PLAN crit-7 / I1) ⇔ the run is HIGH-STAKES, reached dry in FEWER than K
 * rounds, AND still has MORE than M unresolved high-severity findings. Converging that fast with
 * open high-severity findings is the signature of a SHARED BLIND SPOT, not genuine agreement.
 *
 * On a SINGLE-FAMILY substrate the only probe available is same-lineage, which by I1 reproduces the
 * shared wrong consensus — so the fired probe CANNOT mitigate; it emits the un-mitigable stamp and
 * reports `mitigated:false` (never a mitigation claim). A multi-family substrate CAN genuinely
 * probe with an independent origin, so it may mitigate.
 *
 * @param {object} o
 * @param {string}   o.stakesTier             governor tier (bin/stakes.mjs TIERS) — 'high' is high-stakes
 * @param {number}   o.roundsToDry            non-empty rounds taken to reach dry
 * @param {number}   o.unresolvedHighSeverity count of still-open BLOCKER/MAJOR findings at dry
 * @param {string[]}[o.substrateFamilies=[]]  the model families actually reachable this run
 * @param {{K:number,M:number}} o.thresholds  the committed K (suspicious bound) + M (finding bound)
 * @returns {{ suspicious:boolean, fired:boolean, singleFamily:?boolean, mitigated:?boolean, stamp:?string }}
 */
export function assessConvergenceHonesty({
  stakesTier,
  roundsToDry,
  unresolvedHighSeverity,
  substrateFamilies = [],
  thresholds,
} = {}) {
  const { K, M } = thresholds ?? {};
  if (!Number.isInteger(K) || !Number.isInteger(M)) {
    throw new HaltError('assessConvergenceHonesty requires committed thresholds { K, M } (Wave 1)');
  }
  const highStakes = stakesTier === 'high';
  const tooFast = Number.isInteger(roundsToDry) && roundsToDry < K;
  const stillUnresolved = Number(unresolvedHighSeverity) > M;
  const suspicious = highStakes && tooFast && stillUnresolved;
  if (!suspicious) {
    return { suspicious: false, fired: false, singleFamily: null, mitigated: null, stamp: null };
  }
  // Probe-or-dissent fires. Honesty depends on the substrate.
  const distinctFamilies = new Set((substrateFamilies || []).map((f) => (typeof f === 'string' ? f.trim() : f)).filter(Boolean));
  const singleFamily = distinctFamilies.size <= 1;
  return {
    suspicious: true,
    fired: true,
    singleFamily,
    // I1: a same-lineage probe cannot recover a correlated blind spot — single-family NEVER mitigates.
    mitigated: singleFamily ? false : true,
    stamp: singleFamily ? SHARED_BLIND_SPOT_STAMP : null,
  };
}

// ── (d) G9 — conditional cross-origin debate ───────────────────────────────────────────────────────
/**
 * Detect CONFLICTING INDEPENDENT-ORIGIN pairs: the same finding (by stable id, G6) on which two
 * reviewers of DISTINCT attested lineages reach OPPOSITE verdicts (one `affirm`, one `deny`). A
 * same-lineage disagreement is NOT an independent-origin conflict (I3 — same lineage is one
 * origin); plain agreement is not a conflict. Each review carries `{ lineage|family, findings:
 * [{ topic|id, verdict:'affirm'|'deny' }] }`; a missing verdict defaults to `affirm` (a raised
 * finding is an affirmation).
 *
 * @param {Array<object>} reviews
 * @returns {Array<{ id:string, affirm:string[], deny:string[] }>} one entry per conflicting pair
 */
export function detectOriginConflicts(reviews) {
  if (!Array.isArray(reviews)) throw new TypeError('detectOriginConflicts(reviews): reviews must be an array');
  const byFinding = new Map(); // id -> { affirm:Set<lineage>, deny:Set<lineage> }
  for (const rv of reviews) {
    const lineage = lineageOf(rv); // null when unattested
    for (const f of Array.isArray(rv?.findings) ? rv.findings : []) {
      const id = normalizeFindingId(f);
      const rec = byFinding.get(id) ?? { affirm: new Set(), deny: new Set() };
      const verdict = String(f?.verdict || 'affirm').toLowerCase() === 'deny' ? 'deny' : 'affirm';
      rec[verdict].add(lineage);
      byFinding.set(id, rec);
    }
  }
  const conflicts = [];
  for (const [id, rec] of byFinding) {
    const affirm = [...rec.affirm].filter(Boolean);
    const deny = [...rec.deny].filter(Boolean);
    // A genuine conflict: an attested lineage affirms while a DIFFERENT attested lineage denies.
    const crossLineage = affirm.some((a) => deny.some((d) => d !== a));
    if (crossLineage) conflicts.push({ id, affirm, deny });
  }
  return conflicts;
}

/** Should the G9 debate fire this round? Conditional on ≥1 conflicting independent-origin pair. */
export function shouldDebate(conflicts) {
  return Array.isArray(conflicts) && conflicts.length > 0;
}

function debatePrompt(pair) {
  return [
    `[researchPrime G9 — conditional cross-origin debate]`,
    `Two INDEPENDENT origins conflict on finding ${pair.id}:`,
    `  affirmed by lineage(s): ${pair.affirm.join(', ') || '(none)'}`,
    `  denied   by lineage(s): ${pair.deny.join(', ') || '(none)'}`,
    `Adjudicate which origin's verdict survives by EVIDENCE QUALITY (not by majority). Return the`,
    `surviving verdict and the decisive evidence.`,
  ].join('\n');
}

/**
 * Run the G9 debate gate. It is CONDITIONAL: it invokes the debate sub-agent EXACTLY ONCE per
 * conflicting origin pair, and ZERO times when there is no conflict (done-when d). The injected
 * `agent` is the call-count spy seam — every debate call goes through it.
 *
 * @param {{agent:Function, conflicts:Array, round?:number}} o
 * @returns {Promise<{ fired:boolean, count:number, resolutions:object[] }>}
 */
export async function runDebateGate({ agent, conflicts = [], round = 1 } = {}) {
  if (typeof agent !== 'function') {
    throw new HaltError('runDebateGate requires an agent() function', 'pass the injected seam: { agent }');
  }
  const resolutions = [];
  for (const pair of conflicts) {
    const out = await agent(debatePrompt(pair), { label: `debate:${pair.id}:r${round}`, role: 'debate' });
    resolutions.push({ id: pair.id, resolution: out ?? null });
  }
  return { fired: conflicts.length > 0, count: conflicts.length, resolutions };
}

// ── (g)/(h) G8 — cross-lineage origin fusion (flagged-inert; routes through the SHARED module) ─────
/** The stamp G8 wears when it is inert (flag off / lineage-enum not committed). */
export const G8_INERT_STAMP =
  'G8 cross-lineage fusion INERT (flag off or lineage-enum uncommitted) — no cross-lineage origin claimed';

/**
 * Is G8 enabled? Only when BOTH the explicit flag is on AND the closed attested-lineage enum has
 * been committed (crit-5). The enum being pending (the Wave-7 default) keeps G8 inert regardless of
 * the flag, because there is no attested set to fuse against.
 */
export function g8Enabled({ flag = false, lineages = committedLineages() } = {}) {
  return !!flag && Array.isArray(lineages) && lineages.length > 0;
}

/**
 * G8 cross-lineage origin fusion. Flagged-INERT by default (g): when disabled it claims ZERO
 * cross-lineage origins and wears the inert stamp. When ENABLED it counts origins ONLY by asking
 * the Wave-2 SHARED module `meetsQuorum` (h) — it NEVER tallies origins itself, so the I3 invariant
 * (same-lineage agreement adds 0; only an attested distinct lineage adds +1) is enforced in one
 * place. `attestedLineages` is passed straight through to the shared module (the committed enum).
 *
 * @param {Array<object>} reviewers  lineage-tagged reviewers ({ lineage } / stampRole { family })
 * @param {object} [o]
 * @param {boolean}        [o.enabled=false]
 * @param {?Iterable<string>} [o.attestedLineages=null]  the committed closed enum (Wave 7)
 * @param {?number}        [o.rhoHat=null]               learned correlation (Wave 9 supplies it)
 * @returns {{ enabled:boolean, inert:boolean, origins:number, required:number, met:boolean, stamp:?string }}
 */
export function g8FuseOrigins(reviewers = [], { enabled = false, attestedLineages = null, rhoHat = null } = {}) {
  if (!enabled) {
    return { enabled: false, inert: true, origins: 0, required: STATIC_QUORUM_FLOOR, met: false, stamp: G8_INERT_STAMP };
  }
  // THE SOLE COUNTER: route through the shared module. No origin number is computed here.
  const quorum = meetsQuorum(reviewers, { attestedLineages, rhoHat, staticFloor: STATIC_QUORUM_FLOOR });
  return { enabled: true, inert: false, ...quorum, stamp: null };
}

// ── GATE-1 — independent-origins quorum for the round (the shared module, the sole counter) ────────
/**
 * The round's GATE-1 verdict: independent origins among the round's reviewers, via the shared
 * module. Identical routing to the engine's `gateOneQuorum` (bin/engine.mjs) — origins are counted
 * in exactly one place across the whole engine (I3/h).
 */
export function gateOneQuorum(reviewers = [], { rhoHat = null, attestedLineages = null } = {}) {
  return meetsQuorum(reviewers, { rhoHat, attestedLineages, staticFloor: STATIC_QUORUM_FLOOR });
}

// ── (e)/(f) the active Synthesizer + Judge, behind a call-count spy seam ───────────────────────────
/**
 * Orchestrate ONE round's adjudication layer (G4 Judge · G9 debate · active Synthesizer) over a set
 * of lineage-tagged reviews, exposing a CALL-COUNT SPY SEAM (f): every sub-agent call is routed
 * through a per-role counting wrapper, and the per-role counts are returned. G3/G5/G6 ride on the
 * trio tally; GATE-1/G8 route through the shared module.
 *
 * @param {object} o
 * @param {Function} o.agent                          the injected agent seam (the spy)
 * @param {number}   [o.round=1]
 * @param {?string}  [o.northStar=null]
 * @param {Array}    o.reviews                        lineage-tagged per-reviewer reviews
 * @param {string[]}[o.priorBlockerIds=[]]
 * @param {boolean} [o.debate=true]  [o.judge=true]  [o.synthesize=true]
 * @param {object}  [o.g8={enabled:false}]            G8 fusion options (default inert)
 * @returns {Promise<object>} the round result + `counts:{synthesizer,judge,debate}` (the spy seam)
 */
export async function orchestrateRound({
  agent,
  round = 1,
  northStar = null,
  reviews,
  priorBlockerIds = [],
  debate = true,
  judge = true,
  synthesize = true,
  g8 = { enabled: false },
} = {}) {
  if (typeof agent !== 'function') {
    throw new HaltError('orchestrateRound requires an agent() function', 'pass the injected seam: { agent }');
  }
  if (!Array.isArray(reviews)) {
    throw new HaltError('orchestrateRound requires a reviews[] array (the round\'s lineage-tagged reviews)');
  }

  // The call-count spy seam (f): one counting wrapper per adjudication role.
  const counts = { synthesizer: 0, judge: 0, debate: 0 };
  const spy = (role) => async (prompt, opts = {}) => {
    counts[role] += 1;
    return agent(prompt, { ...opts, role });
  };

  // G3 ≥2-agree + G6 identity + G5 dry: the trio tally (the load-bearing reuse).
  const tally = tallyFindings(reviews, { priorBlockerIds });

  // GATE-1: independent origins via the shared module (the sole counter).
  const quorum = gateOneQuorum(reviews, { attestedLineages: g8?.attestedLineages ?? null });

  // G9 conditional debate (d): fires exactly once per conflicting independent-origin pair.
  const conflicts = detectOriginConflicts(reviews);
  const debateResult = debate
    ? await runDebateGate({ agent: spy('debate'), conflicts, round })
    : { fired: false, count: 0, resolutions: [] };

  // G8 cross-lineage fusion (flagged-inert by default; routes through the shared module).
  const fusion = g8FuseOrigins(reviews, g8);

  // G4 separate context-free Judge (reuse the trio's makeJudge through the spy seam).
  let judgeVerdict = null;
  if (judge) {
    const j = makeJudge({ agent: spy('judge') });
    judgeVerdict = await j.decide({ northStar, findings: tally.findings, round });
  }

  // The active Deep-Think Synthesizer steers (reuse makeSynthesizer through the spy seam).
  let direction = null;
  if (synthesize) {
    const s = makeSynthesizer({ agent: spy('synthesizer'), northStar });
    direction = await s.direct({ round, verdict: tally, northStar });
  }

  return {
    round,
    reviews,
    tally,
    quorum,
    conflicts,
    debate: debateResult,
    g8: fusion,
    judgeVerdict,
    direction,
    counts,
    dry: !!tally.dry,
    empty: isEmptyRound(reviews),
  };
}

// ── (e) Synthesizer steering, measured vs a token/round-matched control ────────────────────────────
// A heterogeneous reviewer panel that REUSES the trio roster (SHARK_ROLES) + angle rotation
// (angleForShark) for G3 heterogeneity, calling the injected agent once per reviewer. The verifier
// prompt is researchPrime's own (the contract surface anticipates this: makeSharkDriver emits a
// plan-level Shark prompt; verification reviewers need a different one) — but the ROSTER and the
// angle rotation are the trio's, reused not forked. A `focus` hint (the Synthesizer's steer) is
// surfaced to the panel so steered and control runs differ ONLY by whether steering is carried.
function reviewerPrompt(role, { round, angle, focus }) {
  return [
    `[researchPrime G3 verification reviewer — ${role.role} (${role.persona}); angle ${angle}]`,
    `round ${round}: independently verify the claims and report any defect you can substantiate.`,
    focus ? `STEER (Synthesizer): press hardest on — ${focus}` : `(no steering hint this round)`,
  ].join('\n');
}

async function runPanelRound({ agent, round, focus, onCall }) {
  const reviews = [];
  for (let i = 0; i < SHARK_ROLES.length; i++) {
    const role = SHARK_ROLES[i];
    const angle = angleForShark(round, i);
    if (onCall) onCall();
    const out = await agent(reviewerPrompt(role, { round, angle, focus }), {
      label: `reviewer:${role.role}:r${round}`,
      role: 'reviewer',
      round,
      angle,
      focus: focus ?? null,
    });
    reviews.push({ reviewer: role.role, angle, findings: Array.isArray(out?.findings) ? out.findings : [] });
  }
  return reviews;
}

/**
 * Measure the active Synthesizer's STEERING against a token/round-MATCHED control (done-when e).
 *
 * Both arms run the SAME number of rounds and make the SAME number of agent calls (the same panel +
 * one Synthesizer direction per round) — so neither arm gets extra budget. The ONLY difference: the
 * STEERED arm carries the Synthesizer's top suggestion forward as the next round's `focus`, while
 * the CONTROL arm runs the Synthesizer identically (matched calls) but DISCARDS its suggestion
 * (focus stays null). Any gap in findings caught is therefore attributable to STEERING, not budget.
 *
 * @param {object} o
 * @param {Function} o.agent                  the injected agent seam (scripted in tests)
 * @param {number}   [o.rounds=2]
 * @param {?string}  [o.northStar=null]
 * @returns {Promise<{ rounds:number, matched:boolean, steeringEffect:number,
 *   steered:{caught:string[], agentCalls:number}, control:{caught:string[], agentCalls:number} }>}
 */
export async function measureSteering({ agent, rounds = 2, northStar = null } = {}) {
  if (typeof agent !== 'function') {
    throw new HaltError('measureSteering requires an agent() function', 'pass the injected seam: { agent }');
  }
  if (!Number.isInteger(rounds) || rounds < 1) {
    throw new HaltError('measureSteering: rounds must be an integer >= 1');
  }

  const arm = async (steer) => {
    let agentCalls = 0;
    const counted = async (prompt, opts) => {
      agentCalls += 1;
      return agent(prompt, opts);
    };
    const synth = makeSynthesizer({ agent: counted, northStar });
    const caught = new Set();
    let focus = null;
    for (let r = 1; r <= rounds; r++) {
      const reviews = await runPanelRound({ agent: counted, round: r, focus });
      for (const rv of reviews) for (const f of rv.findings) caught.add(normalizeFindingId(f));
      // The Synthesizer runs IDENTICALLY in both arms (matched calls); only the steered arm USES
      // its suggestion as the next round's focus.
      const dir = await synth.direct({ round: r, verdict: { findings: [...caught].map((id) => ({ id })) }, northStar });
      const suggestion = Array.isArray(dir?.suggestions) && dir.suggestions.length ? dir.suggestions[0] : null;
      focus = steer ? suggestion : null;
    }
    return { caught: [...caught].sort(), agentCalls };
  };

  const steered = await arm(true);
  const control = await arm(false);
  return {
    rounds,
    matched: steered.agentCalls === control.agentCalls,
    steeringEffect: steered.caught.length - control.caught.length,
    steered,
    control,
  };
}

// Re-export the shared-module primitives the round layer routes through, so a consumer/test reads
// the SAME counter the engine + verify-core use (one canonical origin counter, I3/h).
export { meetsQuorum, countIndependentOrigins, STATIC_QUORUM_FLOOR };

// Re-export the REUSED trio tally + identity (G3 ≥2-agree quorum, G6 stable id) so a consumer/test
// reads the round layer's exact G3/G6 surface — these are the trio's, reused not forked.
export { tallyFindings, normalizeFindingId };
