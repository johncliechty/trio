// crucible/bin/judge-panel.mjs — Wave 3 (Front 3): the CROSS-FAMILY judge-panel seam at
// the rubric gate.
//
// NET-NEW seam. The convergence Judge (`judge.mjs` `selectJudgeModel`) returns ONE judge
// and `gemini-cli` is a worker transport, not a two-judge aggregator. This panel fires ≥2
// judges across DISTINCT model FAMILIES over ONE rubric gate (the Wave-2 lit-review gate on
// the DEFAULT Claude host) and AGGREGATES + records every stamp.
//
// REUSE, NOT FORK (SR-6): each member scores through `scoreAgainstRubric` — the SAME rubric
// machinery the gate uses — which itself reuses `selectJudgeModel` + `stampRole`. `judge.mjs`
// is IMPORTED, never modified, so the convergence single-selection path stays byte-identical
// (asserted in judge-panel.test.mjs and pack-layer3-rubric.test.mjs).
//
// INDEPENDENCE IS COUNTED FROM DISPATCHER-ATTESTED STAMPS, NEVER ARGV (the load-bearing
// rule). A member's role stamp records the REQUESTED family (argv-side, from `selectJudgeModel`);
// its SR-5 attestation records the SERVED model READ FROM THE RESULT ENVELOPE (`drivers/attest.mjs`).
// Only the SERVED family enters the origin count, and only when `model_attested:true`. So a run
// whose argv requests {claude, gemini} but is SERVED {claude, claude} counts ONE origin and FAILS
// the two-family assertion — a Gemini-only "enhanced" judge, or a degraded second family, cannot
// masquerade as cross-family. The count is delegated to the trio's SINGLE origin counter
// (`countIndependentOrigins`) gated by the committed closed lineage enum (crit-5), so the
// ≥2-distinct-attested-family rule cannot be re-implemented (and quietly weakened) here.

import { HaltError } from './crucible-lib.mjs';
import { defaultProbeCrossModel } from './judge.mjs';
import { scoreAgainstRubric } from './packs/layer3-rubric.mjs';
import { attestStamp } from '../../drivers/attest.mjs';
import {
  countIndependentOrigins,
  STATIC_QUORUM_FLOOR,
} from '../../researchPrime/bin/trio-core/independence-accounting.mjs';
import { committedLineages } from '../../researchPrime/bin/lineage-enum.mjs';

export const PANEL_ROLE = 'RubricJudgePanel';

// Map a SERVED model id (read from the envelope) to its attested lineage/family. Prefix-keyed
// so 'claude-opus-4-8' -> 'claude', 'gemini-3.1-pro-preview' -> 'gemini'. This is the DISPATCHER
// family — derived from what actually ran, never from the requested ('-m auto') id.
const FAMILY_PREFIXES = [
  ['claude', 'claude'],
  ['gemini', 'gemini'],
  ['gpt', 'gpt'], ['o1', 'gpt'], ['o3', 'gpt'], ['o4', 'gpt'], ['o-', 'gpt'],
  ['grok', 'grok'],
];

/**
 * The attested lineage of a SERVED model id, or null when it cannot be mapped. Falls back to
 * the leading alphabetic segment so a never-seen attested family still reads as its own lineage
 * (the closed enum then decides whether it counts as a distinct origin).
 * @param {?string} served  served-model id READ FROM THE ENVELOPE (never argv)
 * @returns {?string}
 */
export function familyOfServedModel(served) {
  if (typeof served !== 'string') return null;
  const s = served.trim().toLowerCase();
  if (!s) return null;
  for (const [pfx, fam] of FAMILY_PREFIXES) if (s.startsWith(pfx)) return fam;
  const seg = s.match(/^[a-z]+/);
  return seg ? seg[0] : null;
}

/**
 * Resolve a member's DISPATCHER attestation (the SR-5 served-model stamp). A member supplies
 * EITHER an explicit `attest` (a stamp object, or a thunk returning one — the live wiring passes
 * the dispatcher's recorded served-model stamp for that member's call) OR a `servedModel` string
 * we normalize through `attestStamp`. Absent both => degraded (never fabricate a served model).
 */
function resolveAttestation(member) {
  if (member.attest != null) {
    const a = typeof member.attest === 'function' ? member.attest() : member.attest;
    // Trust a well-formed stamp; otherwise normalize whatever served id it carries.
    if (a && typeof a === 'object' && 'model_attested' in a && 'model_served' in a && 'degraded' in a) return a;
    return attestStamp(a && typeof a === 'object' ? a.model_served : a);
  }
  return attestStamp(member.servedModel ?? null);
}

/** Build the per-member cross-family probe for `scoreAgainstRubric` from its REQUESTED family. */
function memberProbe(member) {
  if (member.probeCrossModel) return member.probeCrossModel;
  if (member.family && member.family !== 'claude') {
    return () => ({ model: member.servedModel || member.family, family: member.family });
  }
  return defaultProbeCrossModel;
}

/**
 * Fire a cross-family judge PANEL over one rubric gate and aggregate every stamp.
 *
 * @param {object} o
 * @param {string} o.doc                       the deliverable judged at the rubric gate
 * @param {object} o.pack                      the governing pack (its frozen rubric)
 * @param {Array<object>} o.members            ≥2 judge members. Each: {
 *     family,                                 the REQUESTED family (argv-side, drives the probe)
 *     servedModel?,                           OR an explicit served-model id (tests)
 *     attest?,                                OR the SR-5 dispatcher stamp / a thunk to it (live)
 *     score? | agent?,                        the rubric scorer (test) OR the live agent seam
 *     probeCrossModel?,                       OR an explicit cross-family probe
 *   }
 * @param {Iterable<string>} [o.attestedLineages]  the committed closed enum (defaults to
 *     `committedLineages()` — crit-5); off-enum served families collapse to one capped bucket
 * @param {Function} [o.log=()=>{}]
 * @returns {Promise<object>} the panel result (see fields below)
 */
export async function runRubricPanel({ doc, pack, members, attestedLineages, log = () => {} }) {
  if (!Array.isArray(members) || members.length < STATIC_QUORUM_FLOOR) {
    throw new HaltError(
      `a cross-family judge panel needs at least ${STATIC_QUORUM_FLOOR} members`,
      'provision judges from DISTINCT model families (e.g. one claude + one gemini)',
    );
  }
  const enum_ = attestedLineages ?? committedLineages();

  const results = [];
  for (const member of members) {
    const rubric = await scoreAgainstRubric({
      doc, pack, score: member.score, agent: member.agent,
      probeCrossModel: memberProbe(member), log,
    });
    const attestation = resolveAttestation(member);
    const familyServed = attestation.model_attested ? familyOfServedModel(attestation.model_served) : null;
    results.push({
      requested_family: member.family ?? rubric.stamp.family,
      requested_model: member.servedModel ?? rubric.stamp.model,
      role_stamp: rubric.stamp,        // reused Judge attestation machinery (REQUESTED family)
      attestation,                     // SR-5 dispatcher stamp (SERVED model, never argv)
      family_served: familyServed,
      rubric: { verdict: rubric.verdict, aggregate_score: rubric.aggregate_score, criteria: rubric.criteria },
    });
  }

  // INDEPENDENCE FROM DISPATCHER-ATTESTED STAMPS ONLY. An unattested/degraded member is not a
  // dispatcher-attested origin, so it is excluded outright — it can neither be its own origin nor
  // borrow the capped "off-enum" bucket to manufacture a second family. This is what makes the
  // RED single-family probe FAIL honestly (a degraded or same-family second judge cannot pass).
  const attestedReviewers = results
    .filter((r) => r.attestation.model_attested === true)
    .map((r) => ({ lineage: r.family_served }));
  const independentOrigins = countIndependentOrigins(attestedReviewers, { attestedLineages: enum_ });
  const attestedFamilies = [...new Set(attestedReviewers.map((r) => r.lineage).filter(Boolean))].sort();

  // The two-family verdict: ≥ the static quorum floor of DISTINCT ATTESTED origins.
  const crossFamily = independentOrigins >= STATIC_QUORUM_FLOOR;
  const memberVerdicts = results.map((r) => r.rubric.verdict);
  const unanimousPass = memberVerdicts.every((v) => v === 'PASS');

  log(`rubric-panel: ${members.length} judge(s), ${attestedFamilies.length} attested famil${attestedFamilies.length === 1 ? 'y' : 'ies'} ` +
    `[${attestedFamilies.join(', ')}], origins=${independentOrigins}, cross-family=${crossFamily}`);

  return {
    role: PANEL_ROLE,
    contract: 'rubric-panel',
    members: results,
    stamps: results.map((r) => r.role_stamp),       // every role stamp recorded (SR-5)
    attestations: results.map((r) => r.attestation), // every dispatcher stamp recorded
    attestedFamilies,
    independentOrigins,
    crossFamily,
    member_verdicts: memberVerdicts,
    verdict: unanimousPass ? 'PASS' : 'FAIL',
  };
}

/**
 * The two-family ASSERTION (the gate Front 3 closes on). A SINGLE-family run — including a
 * Gemini-only enhanced run, an argv-claims-two-but-served-one run, or a degraded second family —
 * does NOT reach ≥2 distinct attested origins and therefore FAILS here (no false close).
 * @param {object} panel  a `runRubricPanel` result
 * @returns {{ok:true, independentOrigins:number, attestedFamilies:string[]}}
 * @throws {HaltError} when fewer than two distinct attested families judged the gate
 */
export function requireTwoFamilies(panel) {
  if (!panel || panel.crossFamily !== true) {
    throw new HaltError(
      `cross-family rubric panel did not reach two attested families ` +
        `(origins=${panel?.independentOrigins ?? 0}, attested=${JSON.stringify(panel?.attestedFamilies ?? [])})`,
      'provision a SECOND judge from a DISTINCT, ATTESTED family; a single-family / degraded / ' +
        'served-same run cannot close Front 3',
    );
  }
  return { ok: true, independentOrigins: panel.independentOrigins, attestedFamilies: panel.attestedFamilies };
}

/**
 * The recordable LIVE ARTIFACT: a compact, honest summary of which attested families judged the
 * one rubric gate (each member's REQUESTED vs SERVED family, its SR-5 stamp, and its rubric
 * verdict), plus the cross-family verdict. This is what the attended live run commits to show
 * "TWO attested families judging one rubric gate."
 * @param {object} panel  a `runRubricPanel` result
 */
export function summarizePanelArtifact(panel) {
  return {
    role: panel.role,
    contract: panel.contract,
    cross_family: panel.crossFamily,
    independent_origins: panel.independentOrigins,
    attested_families: panel.attestedFamilies,
    verdict: panel.verdict,
    members: panel.members.map((m) => ({
      requested_family: m.requested_family,
      family_served: m.family_served,
      model_served: m.attestation.model_served,
      model_attested: m.attestation.model_attested,
      degraded: m.attestation.degraded,
      role_stamp: { family: m.role_stamp.family, mode: m.role_stamp.mode, cross_model: m.role_stamp.cross_model },
      rubric_verdict: m.rubric.verdict,
      aggregate_score: m.rubric.aggregate_score,
    })),
  };
}
