// trio-shared/brownfield-intake/index.mjs — Wave 8: the shared module's REAL
// end-to-end entry (replacing the Wave-1 stub): ingest -> grounded Gandalf summary ->
// ONE bounded derive call -> PlanArtifact.
//
// This is the ONE shared front-end BOTH literature-review and researchPrime consume
// from the pinned trio shared-code home (docs/DECISION-RECEIPT-shared-location.md):
// the end-to-end output is a finished, schema-valid, verbatim-anchored PlanArtifact
// both skills use UNMODIFIED — no adapter, no reshaping.
//
// The Wave-8 INPUT ROUTING decision lives here (decideIntakeRoute):
//
//   - brownfield CONTENT present   -> summary-grounded derive: ingest (Wave-6 trust
//     boundary + budget floor) -> the ONE Gandalf summarize call (Wave 7, quote-
//     grounded) -> the ONE bounded derive call (Wave 8, distinct from Gandalf);
//   - no content, INTENT present   -> intent derive: the ONE derive call reads the
//     fenced intent (plus seed context); Gandalf is invoked ZERO times;
//   - SEEDS only                   -> deterministic bootstrap of a trivial default
//     plan from seed metadata: ZERO Gandalf calls AND ZERO derive calls;
//   - no content, no intent, no seeds -> FAIL FAST at the door asking for content,
//     intent, or seeds. Nothing is called; nothing is derived.
//
// LLM boundaries: at most ONE Gandalf summarize call (content routes only) and at
// most ONE derive call per run — both injected by the skill host, both bounded, both
// budget-capped, never retried. Deterministic code does only schema validation,
// canonical ordering, and the verbatim-anchor check (never semantic span->slot
// matching). A failed derivation yields NO artifact — the stamped failures are
// surfaced in the advisory plan-readiness preview instead.

import { ingestContent, hasBrownfieldContent } from './ingest.mjs';
import { groundedSummaryStage } from './groundedSummary.mjs';
import { INTENT_CONTEXT_CAP, estimateTokensForText } from './intakeBudget.mjs';
import { derivePlan, bootstrapSeedPlan } from './derivePlan.mjs';
import { planReadinessPreview } from './planReadinessPreview.mjs';
import { buildIntakeManifest } from './intakeManifest.mjs';
import { validateSeed } from './seedIdentity.mjs';

export const BROWNFIELD_INTAKE_VERSION = 'brownfield-intake/entry/1';

/** The four Wave-8 input routes. */
export const INTAKE_ROUTES = Object.freeze({
  CONTENT: 'content',
  INTENT_ONLY: 'intent-only',
  SEEDS_ONLY: 'seeds-only-bootstrap',
  ZERO_INPUT: 'zero-input-fail-fast',
});

/**
 * The routing decision, pure and total: content wins, then intent, then seeds, else
 * fail fast. (Content is also the SOLE Gandalf trigger — Wave 7.)
 *
 * @param {object} options
 * @param {boolean} [options.contentPresent] Did ingest resolve brownfield content?
 * @param {string|null} [options.intent]
 * @param {ReadonlyArray<object>} [options.seeds] VALIDATED seeds.
 * @returns {'content'|'intent-only'|'seeds-only-bootstrap'|'zero-input-fail-fast'}
 */
export function decideIntakeRoute({ contentPresent = false, intent = null, seeds = [] } = {}) {
  if (contentPresent === true) return INTAKE_ROUTES.CONTENT;
  if (typeof intent === 'string' && intent.trim() !== '') return INTAKE_ROUTES.INTENT_ONLY;
  if (Array.isArray(seeds) && seeds.length > 0) return INTAKE_ROUTES.SEEDS_ONLY;
  return INTAKE_ROUTES.ZERO_INPUT;
}

/** Strictly validate seeds (Wave 6), preserving a caller-supplied abstract for the
 *  derive context. Malformed seeds are rejected with named reasons, never forwarded. */
function validateSeedsKeepingAbstracts(seeds) {
  if (!Array.isArray(seeds)) {
    throw new TypeError('brownfieldIntake: seeds must be an array');
  }
  const accepted = [];
  const rejected = [];
  for (const seed of seeds) {
    const res = validateSeed(seed);
    if (!res.ok) {
      rejected.push(res.rejection);
      continue;
    }
    const abstract =
      typeof seed === 'object' && seed !== null && typeof seed.abstract === 'string'
        ? seed.abstract
        : null;
    accepted.push(
      Object.freeze(abstract === null ? { ...res.seed } : { ...res.seed, abstract }),
    );
  }
  return { accepted: Object.freeze(accepted), rejected };
}

/**
 * @typedef {object} BrownfieldIntakeResult
 * @property {string} intakeVersion
 * @property {boolean} ok True iff a finished PlanArtifact was produced.
 * @property {'content'|'intent-only'|'seeds-only-bootstrap'|'zero-input-fail-fast'} route
 * @property {0|1} gandalfCalls
 * @property {0|1} deriveCalls
 * @property {import('./planArtifact.schema.mjs').PlanArtifact|null} artifact The
 *   module's end-to-end output — schema-valid, verbatim-anchored, canonically
 *   ordered — or null on any failure (no partial artifact ever escapes).
 * @property {Record<string,string>|null} groundedSources sourceId -> grounded text
 *   the artifact's anchors quote from (the gate round-trip consumes this).
 * @property {object|null} summary The grounded-summary stage result (content routes).
 * @property {object|null} ingest The ingest result (content routes).
 * @property {object} manifest The pre-Gandalf intake manifest (display + fail-fast).
 * @property {{ accepted: ReadonlyArray<object>, rejected: object[] }} seeds
 * @property {{ stamp: string, reason: string, failures: object[] }|null} failure
 *   Stamped derive/summary failure detail when ok is false.
 * @property {string} readinessPreview The advisory plan-readiness preview (display only).
 * @property {boolean} truncated True iff intake auto-truncated (posture threading).
 * @property {object|null} truncationStamp The TRUNCATED stamp when truncated.
 * @property {string|null} reason Why the run stopped, when ok is false.
 */

function composeResult(parts) {
  const {
    ok,
    route,
    gandalfCalls,
    deriveCalls,
    artifact = null,
    groundedSources = null,
    summary = null,
    ingest = null,
    manifest,
    seeds,
    failure = null,
    reason = null,
  } = parts;
  return Object.freeze({
    intakeVersion: BROWNFIELD_INTAKE_VERSION,
    ok,
    route,
    gandalfCalls,
    deriveCalls,
    artifact,
    groundedSources,
    summary,
    ingest,
    manifest,
    seeds,
    failure,
    readinessPreview: planReadinessPreview({
      artifact,
      groundedSources: groundedSources ?? {},
      failures: failure?.failures ?? [],
    }),
    truncated: ingest?.truncated === true,
    truncationStamp: ingest?.truncated === true ? ingest.stamp : null,
    reason,
  });
}

/**
 * The shared brownfield-intake front-end, end to end: ingest -> grounded summary ->
 * PlanArtifact, under the Wave-8 routing decision. Both skills call THIS and consume
 * the returned artifact unmodified.
 *
 * @param {object} [options]
 * @param {string[]} [options.roots] Declared brownfield ingest roots (opt-in trigger).
 * @param {string[]} [options.requests] Explicit root-relative path requests.
 * @param {string|null} [options.intent] The user's research intent string.
 * @param {object[]} [options.seeds] Seed papers ({ idType, id, title, abstract? });
 *   strictly validated here (Wave 6) before any use.
 * @param {number} [options.budgetTokens] Intake token budget override.
 * @param {boolean} [options.autoTruncate] EXPLICIT opt-in to deterministic truncation.
 * @param {Function} [options.summarize] The Gandalf summarize adapter (content routes).
 * @param {object} [options.grounding] literature-review's quote-grounding functions
 *   ({ buildNormalizedView, groundQuote, sanitizeText? }) — content routes.
 * @param {Function} [options.derive] The ONE bounded derive adapter (content/intent routes).
 * @param {number} [options.summaryMaxTokens] Retained-summary cap override (Wave 7).
 * @param {number} [options.maxOutputChars] Derive output cap override.
 * @returns {Promise<Readonly<BrownfieldIntakeResult>>}
 */
export async function brownfieldIntake({
  roots = [],
  requests = [],
  intent = null,
  seeds = [],
  budgetTokens,
  autoTruncate = false,
  summarize,
  grounding,
  derive,
  summaryMaxTokens,
  maxOutputChars,
} = {}) {
  if (!Array.isArray(roots) || roots.some((r) => typeof r !== 'string')) {
    throw new TypeError('brownfieldIntake: roots must be an array of strings');
  }
  if (intent !== null && typeof intent !== 'string') {
    throw new TypeError('brownfieldIntake: intent must be a string or null');
  }

  // Strict seed validation FIRST (Wave 6): malformed seeds are rejected with named
  // reasons and contribute nothing downstream — never forwarded, only surfaced.
  const seedSet = validateSeedsKeepingAbstracts(seeds);

  // Opt-in ingest through the Wave-6 trust boundary + budget floor (content only).
  const ingest =
    roots.length > 0 || (Array.isArray(requests) && requests.length > 0)
      ? ingestContent({ roots, requests, budgetTokens, autoTruncate })
      : null;

  // The pre-Gandalf manifest: display + fail-fast, explicitly NOT a second gate.
  const manifest = buildIntakeManifest({
    roots,
    fileSet: { files: ingest?.items ?? [], rejected: ingest?.rejected ?? [] },
    budget: ingest
      ? {
          estimatedTokens: ingest.estimatedTokens,
          budgetTokens: ingest.budgetTokens,
          decision: ingest.decision,
          truncated: ingest.truncated,
          stamp: ingest.stamp,
          reason: ingest.reason,
          files: [...ingest.items],
        }
      : null,
    seeds: { seeds: seedSet.accepted, rejected: seedSet.rejected },
  });

  // A fail-fast budget decision stops at the door: no Gandalf, no derive, no artifact.
  if (ingest !== null && ingest.decision === 'fail-fast') {
    return composeResult({
      ok: false,
      route: INTAKE_ROUTES.CONTENT,
      gandalfCalls: 0,
      deriveCalls: 0,
      ingest,
      manifest,
      seeds: seedSet,
      reason: ingest.reason,
    });
  }

  const route = decideIntakeRoute({
    contentPresent: hasBrownfieldContent(ingest),
    intent,
    seeds: seedSet.accepted,
  });

  if (route === INTAKE_ROUTES.ZERO_INPUT) {
    const rejectedNote =
      seedSet.rejected.length > 0
        ? ` (${seedSet.rejected.length} supplied seed(s) were rejected by strict validation — see the manifest)`
        : '';
    return composeResult({
      ok: false,
      route,
      gandalfCalls: 0,
      deriveCalls: 0,
      ingest,
      manifest,
      seeds: seedSet,
      reason:
        'nothing to plan from — provide brownfield content, a research intent, or seeds ' +
        '(at least one of: content roots, an intent string, or one valid seed paper)' +
        rejectedNote,
    });
  }

  if (route === INTAKE_ROUTES.SEEDS_ONLY) {
    // Deterministic trivial default plan: ZERO Gandalf calls, ZERO derive calls.
    // The MAX_FENCED_BLOCKS hard source-count cap gates this route too — an over-cap
    // seed set is a structured failure, not a plan.
    const bootstrap = bootstrapSeedPlan(seedSet.accepted);
    if (!bootstrap.ok) {
      return composeResult({
        ok: false,
        route,
        gandalfCalls: 0,
        deriveCalls: 0,
        ingest,
        manifest,
        seeds: seedSet,
        failure: {
          stamp: bootstrap.stamp,
          reason: bootstrap.reason,
          failures: [...bootstrap.failures],
        },
        reason: bootstrap.reason,
      });
    }
    return composeResult({
      ok: true,
      route,
      gandalfCalls: 0,
      deriveCalls: 0,
      artifact: bootstrap.artifact,
      groundedSources: bootstrap.groundedSources,
      ingest,
      manifest,
      seeds: seedSet,
    });
  }

  // Content route: the ONE Gandalf summarize call, quote-grounded (Wave 7).
  let summary = null;
  if (route === INTAKE_ROUTES.CONTENT) {
    // The budget identity reserves INTENT_CONTEXT_CAP for the fenced intent block this
    // route carries alongside the summary — so a summary+intent that would overflow is
    // caught HERE, BEFORE the Gandalf call is spent, not at the derive door after it.
    // (A Wave-7-legal summary at SUMMARY_MAX plus an in-cap intent always fits by
    // construction, so this is the only overflow the content route can still hit.)
    if (typeof intent === 'string' && estimateTokensForText(intent) > INTENT_CONTEXT_CAP) {
      return composeResult({
        ok: false,
        route,
        gandalfCalls: 0,
        deriveCalls: 0,
        ingest,
        manifest,
        seeds: seedSet,
        reason:
          `the intent string estimates ${estimateTokensForText(intent)} tokens — over the ` +
          `INTENT_CONTEXT_CAP of ${INTENT_CONTEXT_CAP} the derive budget identity reserves for ` +
          'the fenced intent block; the summary+intent cannot fit the single bounded derive ' +
          'call, so the run stops BEFORE the Gandalf summarize call (shorten the intent)',
      });
    }
    summary = await groundedSummaryStage({
      items: ingest.items,
      seeds: seedSet.accepted,
      intent,
      summarize,
      grounding,
      ...(summaryMaxTokens === undefined ? {} : { summaryMaxTokens }),
    });
    if (!summary.ok) {
      return composeResult({
        ok: false,
        route,
        gandalfCalls: summary.summarizeCalls,
        deriveCalls: 0,
        summary,
        ingest,
        manifest,
        seeds: seedSet,
        reason: summary.reason,
      });
    }
  }

  // The ONE bounded derive call (distinct from Gandalf): summary-grounded on the
  // content route, intent-grounded otherwise; seed context rides along in both.
  const derived = await derivePlan({
    summary: route === INTAKE_ROUTES.CONTENT ? summary.summary : null,
    intent,
    seeds: seedSet.accepted,
    derive,
    ...(maxOutputChars === undefined ? {} : { maxOutputChars }),
  });

  const gandalfCalls = route === INTAKE_ROUTES.CONTENT ? summary.summarizeCalls : 0;
  if (!derived.ok) {
    return composeResult({
      ok: false,
      route,
      gandalfCalls,
      deriveCalls: derived.deriveCalls,
      summary,
      ingest,
      manifest,
      seeds: seedSet,
      failure: { stamp: derived.stamp, reason: derived.reason, failures: [...derived.failures] },
      reason: derived.reason,
    });
  }

  return composeResult({
    ok: true,
    route,
    gandalfCalls,
    deriveCalls: derived.deriveCalls,
    artifact: derived.artifact,
    groundedSources: derived.groundedSources,
    summary,
    ingest,
    manifest,
    seeds: seedSet,
  });
}

// ---------------------------------------------------------------------------
// Wave-1 parity fence (RETAINED): the two shared-import parity tests (lit-review
// side + researchPrime side) pin the shared home by asserting both skills import
// THIS module and observe a byte-identical plan-artifact-shaped object. The stub
// stays exported so that topology proof keeps running; it is NOT the module's
// output — brownfieldIntake above is.
// ---------------------------------------------------------------------------

/**
 * Return the fixed plan-artifact-shaped placeholder object (Wave-1 topology fence).
 * Deterministic and pure: every call returns a fresh object with identical content,
 * so `JSON.stringify(makePlanArtifactStub(), null, 2)` is byte-stable across calls,
 * processes, and consumers.
 *
 * @returns {{
 *   artifactVersion: string,
 *   scope: { statement: string, axis: string },
 *   branches: Array<{ question: string, rationale: string }>,
 *   sourcesToBeat: Array<{ title: string, why: string }>,
 *   foresight: { dropped: string, counterfactualCost: string, stamp: string },
 *   seeds: Array<object>,
 * }}
 */
export function makePlanArtifactStub() {
  return {
    artifactVersion: BROWNFIELD_INTAKE_VERSION,
    scope: {
      statement:
        'PARITY-FENCE placeholder scope statement — the real end-to-end output is ' +
        'brownfieldIntake(); this stub exists to pin the shared-home topology (Wave 1).',
      axis:
        'PARITY-FENCE placeholder AXIS — the load-bearing win condition and what FALSIFIES a candidate.',
    },
    branches: [
      {
        question: 'PARITY-FENCE placeholder candidate branch/question #1',
        rationale: 'PARITY-FENCE placeholder rationale for why this branch is worth pursuing.',
      },
    ],
    sourcesToBeat: [
      {
        title: 'PARITY-FENCE placeholder best-in-class source to beat',
        why: 'PARITY-FENCE placeholder why this source is the current baseline.',
      },
    ],
    foresight: {
      dropped: 'PARITY-FENCE placeholder dropped-or-reordered branch',
      counterfactualCost: 'PARITY-FENCE placeholder counterfactual cost of the drop/reorder',
      stamp: 'no foresight value added (parity-fence stub)',
    },
    seeds: [],
  };
}
