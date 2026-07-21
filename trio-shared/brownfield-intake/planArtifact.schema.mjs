// trio-shared/brownfield-intake/planArtifact.schema.mjs — Wave 2: the MODULE-OWNED
// PlanArtifact schema definition.
//
// This contract is owned by the shared brownfield-intake module. The frozen gate never
// reads it (Wave-1 empirical finding: plan-gate.mjs/two-gate.mjs serialize the plan
// opaquely and inspect no field) — the gate sees only the rendered PROSE body. Every
// later wave targets THIS one documented artifact shape:
//
//   scope/AXIS, candidate branches/questions, sources-to-beat, foresight receipt,
//   seeds[], and per-element model-emitted verbatim span anchors.
//
// Coverage/provenance is explicitly NOT a schema field (required OR optional): it is an
// ADVISORY SIDECAR derived from the anchors at render time (Wave-1 subtractive decision,
// docs/DECISION-RECEIPT-shared-location.md §3) — never a human-maintained body field,
// never a schema gate on edits. The validator rejects `coverage`/`provenance` keys so the
// sidecar can never leak into the editable/serialized artifact surface.
//
// The runtime validator and canonical-ordering functions live in
// ./validatePlanArtifact.mjs and consume the declarative tables exported here.

/** Schema identity stamp emitters should carry in `artifactVersion`. */
export const PLAN_ARTIFACT_SCHEMA_VERSION = 'plan-artifact/1';

/**
 * Admitted seed identifier types, listed in the pinned identity precedence order
 * DOI -> PMID -> arXiv-id -> normalized-title-hash (IMPLEMENTATION-PLAN success
 * criterion 4; strict per-type FORMAT validation is Wave 6 seedIdentity.mjs — this
 * schema gates only that `idType` is one of these admitted tokens).
 * @type {ReadonlyArray<string>}
 */
export const SEED_ID_TYPES = Object.freeze(['doi', 'pmid', 'arxiv', 'title-hash']);

/**
 * Keys that must NEVER appear on a PlanArtifact at any level: coverage/provenance is an
 * advisory display-only sidecar derived from anchors, never an artifact field.
 * @type {ReadonlyArray<string>}
 */
export const ADVISORY_ONLY_KEYS = Object.freeze(['coverage', 'provenance']);

/**
 * Canonical key order per node kind — the SINGLE source of truth for deterministic,
 * byte-stable serialization (validatePlanArtifact.mjs canonicalization walks these).
 * Top-level order matches the Wave-1 stub surface asserted by both import-parity tests.
 */
export const CANONICAL_KEY_ORDER = Object.freeze({
  artifact: Object.freeze(['artifactVersion', 'scope', 'branches', 'sourcesToBeat', 'foresight', 'seeds']),
  scope: Object.freeze(['statement', 'axis', 'anchors']),
  branch: Object.freeze(['question', 'rationale', 'anchors']),
  sourceToBeat: Object.freeze(['title', 'why', 'anchors']),
  foresight: Object.freeze(['dropped', 'counterfactualCost', 'stamp', 'anchors']),
  seed: Object.freeze(['idType', 'id', 'title']),
  anchor: Object.freeze(['sourceId', 'quote']),
});

/**
 * A model-emitted verbatim span anchor. Every plan element carries at least one.
 * The model AUTHORS its own anchors at derive/re-derive time (Waves 4 + 8); deterministic
 * code never does semantic span->slot matching — it only checks, word-for-word, that
 * `quote` appears verbatim in the named source (Wave 4 verbatimAnchorCheck.mjs). This
 * schema gates structure only (non-empty strings), not verbatim-ness.
 *
 * @typedef {object} Anchor
 * @property {string} sourceId Stable id of the anchored source: a grounded-summary
 *   source-file id threaded by ingest provenance (Wave 7) or a seed identity (Wave 6).
 *   Non-empty.
 * @property {string} quote The verbatim span, quoted word-for-word from the grounded
 *   summary or seed text. Non-empty.
 */

/**
 * The plan's scope and AXIS — what the research is FOR and the load-bearing win
 * condition that falsifies candidates.
 *
 * @typedef {object} Scope
 * @property {string} statement Prose scope statement. Non-empty.
 * @property {string} axis The load-bearing evaluation axis / win condition. Non-empty.
 * @property {Anchor[]} anchors Per-element verbatim span anchors. At least one.
 */

/**
 * One candidate research branch/question.
 *
 * @typedef {object} Branch
 * @property {string} question The candidate branch/question. Non-empty.
 * @property {string} rationale Why this branch is worth pursuing. Non-empty.
 * @property {Anchor[]} anchors Per-element verbatim span anchors. At least one.
 */

/**
 * One best-in-class source the research must beat.
 *
 * @typedef {object} SourceToBeat
 * @property {string} title The source's title/identifier. Non-empty.
 * @property {string} why Why it is the current baseline. Non-empty.
 * @property {Anchor[]} anchors Per-element verbatim span anchors. At least one.
 */

/**
 * The foresight receipt — what was dropped or reordered and at what counterfactual
 * cost, stamped honestly (may stamp "no foresight value added").
 *
 * @typedef {object} ForesightReceipt
 * @property {string} dropped The dropped-or-reordered branch. Non-empty.
 * @property {string} counterfactualCost The counterfactual cost of the drop/reorder. Non-empty.
 * @property {string} stamp Honesty stamp for the receipt. Non-empty.
 * @property {Anchor[]} anchors Per-element verbatim span anchors. At least one.
 */

/**
 * One seed paper. Seeds are user-supplied identity (CLI -> PlanArtifact.seeds, Wave 10),
 * not model-derived content, so seeds carry NO anchors. `seeds` MAY be empty — the
 * intent-only route (Wave 8) derives a plan with zero seeds.
 *
 * @typedef {object} Seed
 * @property {('doi'|'pmid'|'arxiv'|'title-hash')} idType Identifier type, one of
 *   SEED_ID_TYPES (precedence DOI -> PMID -> arXiv-id -> normalized-title-hash).
 * @property {string} id The identifier value under that type. Non-empty. (Strict
 *   per-type format validation is Wave 6 seedIdentity.mjs, before any child-process
 *   handoff.)
 * @property {string} title Human-readable title (rendered one line per seed as
 *   identifier + title, Wave 3). Non-empty.
 */

/**
 * The PlanArtifact — the shared module's end-to-end output (Wave 8) and the single
 * artifact shape every later wave targets. Strict surface: exactly these six fields,
 * no extras (and never coverage/provenance — see ADVISORY_ONLY_KEYS).
 *
 * `branches` and `sourcesToBeat` may be EMPTY arrays at schema level: the seeds-only
 * bootstrap route (Wave 8) produces a trivial default plan, and content minimums are a
 * derive-quality concern, not a schema gate. `seeds` may likewise be empty.
 *
 * @typedef {object} PlanArtifact
 * @property {string} artifactVersion Emitter's version stamp (emitters should carry
 *   PLAN_ARTIFACT_SCHEMA_VERSION). Non-empty.
 * @property {Scope} scope
 * @property {Branch[]} branches
 * @property {SourceToBeat[]} sourcesToBeat
 * @property {ForesightReceipt} foresight
 * @property {Seed[]} seeds
 */

export {};
