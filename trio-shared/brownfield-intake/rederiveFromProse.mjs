// trio-shared/brownfield-intake/rederiveFromProse.mjs — Wave 4: the asymmetric second
// half of the gate round-trip — bounded LLM re-derive on APPROVE-with-EDITs.
//
// Contract (IMPLEMENTATION-PLAN Wave 4; docs/DECISION-RECEIPT-shared-location.md §3):
//
//   - APPROVE-verbatim: the approved prose is byte-identical to the rendered prose of
//     the already-derived artifact, so THAT artifact executes byte-for-byte, unmodified,
//     with ZERO LLM parse calls (resolveApprovedPlan short-circuits before any parse).
//   - APPROVE-with-EDITs: exactly ONE bounded, budget-capped LLM parse reads the edited
//     prose and emits a fresh PlanArtifact WITH its own model-authored verbatim span
//     anchors. Deterministic code does NO semantic span->slot matching — it only
//     (a) validates the parse output against the module-owned schema EXACTLY ONCE,
//     (b) runs the deterministic word-for-word check (./verbatimAnchorCheck.mjs)
//     EXACTLY ONCE, and (c) runs the deterministic, BIJECTIVE approved-prose binding
//     check (./approvedProseBinding.mjs) EXACTLY ONCE BEFORE RUN — every emitted plan
//     element value must appear verbatim (whitespace-collapsed substring) in the
//     APPROVEd prose (soundness), the approved prose's branch/source-to-beat/seed
//     line counts must equal the emission's (completeness: a dropped approved slot
//     ABORTs, named), and each value must sit in the approved line for its OWN slot —
//     indexed values in their own index's line/block, single-slot values in their own
//     LABELED renderer line (slot alignment: cross-wired values ABORT) — so a schema-valid,
//     fully-anchored emission describing a DIFFERENT, TRUNCATED, or RE-PAIRED plan
//     than the human approved still fail-to-ABORTs.
//   - parse-OK -> RUN: the re-derived artifact (canonically ordered) is what executes.
//   - parse-FAIL (over budget, parse threw, schema-invalid, anchor-invalid) -> ABORT
//     with a stamped reason. NEVER a retry, NEVER a second parse, and NEVER a
//     re-present: this module holds no reference to the frozen one-shot gate at all, so
//     the gate cannot be self-violated from here — the caller receives the stamped
//     ABORT decision and halts. No partial artifact escapes: an ABORT decision carries
//     no artifact.
//
// The `parse` function is INJECTED by the caller (the skill host owns its LLM adapter;
// Wave 8's derive is a DISTINCT call with its own prompt). This module guarantees the
// call is made at most once per decision and is never retried. The optional
// `instrument` callbacks exist for observability only (the exactly-once tests count
// them); validation itself always runs through the module-owned validator and the
// deterministic anchor check — neither is injectable or bypassable.

import { validatePlanArtifact, canonicalizePlanArtifact } from './validatePlanArtifact.mjs';
import { verbatimAnchorCheck } from './verbatimAnchorCheck.mjs';
import { approvedProseBinding } from './approvedProseBinding.mjs';
import { renderPlanProse } from './renderPlanProse.mjs';

/** Stamp carried by every fail-to-ABORT decision this module emits. */
export const REDERIVE_ABORT_STAMP = 'brownfield-intake/rederive-abort/1';

/** Default budget caps for the ONE bounded parse (characters; overridable per call). */
export const REDERIVE_MAX_INPUT_CHARS = 200_000;
export const REDERIVE_MAX_OUTPUT_CHARS = 400_000;

/**
 * @typedef {object} RederiveRunDecision
 * @property {'RUN'} outcome
 * @property {'approve-verbatim'|'approve-with-edits'} path
 * @property {0|1} parseCalls
 * @property {import('./planArtifact.schema.mjs').PlanArtifact} artifact The artifact to
 *   execute: on 'approve-verbatim' the SAME already-derived object, unmodified; on
 *   'approve-with-edits' the canonically-ordered re-derived artifact.
 */

/**
 * @typedef {object} RederiveAbortDecision
 * @property {'ABORT'} outcome
 * @property {'approve-with-edits'} path
 * @property {0|1} parseCalls 0 iff the budget gate refused before any parse.
 * @property {{ stamp: string, reason: string, failures: object[] }} abort The stamped
 *   failure: schema reasons or anchor failures when validation failed, empty otherwise.
 */

function abortDecision(parseCalls, reason, failures = []) {
  return Object.freeze({
    outcome: 'ABORT',
    path: 'approve-with-edits',
    parseCalls,
    abort: Object.freeze({ stamp: REDERIVE_ABORT_STAMP, reason, failures: Object.freeze(failures) }),
  });
}

/**
 * Run the ONE bounded, budget-capped LLM parse over edited prose and validate its
 * emitted PlanArtifact exactly once (schema, then the deterministic verbatim-anchor
 * check). Resolves to a RUN or a stamped ABORT decision; it never throws for any parse
 * outcome (only for caller programming errors) and never re-presents anything.
 *
 * @param {object} options
 * @param {string} options.editedProse The edited plan prose the user APPROVEd.
 * @param {Map<string,string>|Record<string,string>} options.groundedSources
 *   sourceId -> grounded summary / seed text the model's anchors must quote from.
 * @param {(input: { editedProse: string, groundedSources: object, budget: object })
 *   => Promise<unknown>|unknown} options.parse The bounded LLM parse. Called AT MOST
 *   once; a throw is a fail-to-ABORT, never a retry.
 * @param {number} [options.maxInputChars] Input budget cap (default REDERIVE_MAX_INPUT_CHARS).
 * @param {number} [options.maxOutputChars] Output budget cap (default REDERIVE_MAX_OUTPUT_CHARS).
 * @param {{ onSchemaValidated?: Function, onAnchorChecked?: Function, onBindingChecked?: Function }}
 *   [options.instrument] Observability-only callbacks, invoked once per (single)
 *   validation pass.
 * @returns {Promise<RederiveRunDecision|RederiveAbortDecision>}
 */
export async function rederiveFromProse({
  editedProse,
  groundedSources,
  parse,
  maxInputChars = REDERIVE_MAX_INPUT_CHARS,
  maxOutputChars = REDERIVE_MAX_OUTPUT_CHARS,
  instrument = {},
} = {}) {
  if (typeof editedProse !== 'string') {
    throw new TypeError('rederiveFromProse: editedProse must be a string');
  }
  if (typeof parse !== 'function') {
    throw new TypeError('rederiveFromProse: parse must be a function (the ONE bounded LLM parse)');
  }
  if (groundedSources === null || typeof groundedSources !== 'object') {
    throw new TypeError('rederiveFromProse: groundedSources must be a map of sourceId -> grounded text');
  }

  // Budget gate BEFORE the parse: over-budget input never spends an LLM call.
  if (editedProse.length > maxInputChars) {
    return abortDecision(
      0,
      `edited prose exceeds the re-derive input budget (${editedProse.length} > ${maxInputChars} chars); ` +
        'the bounded parse was not invoked',
    );
  }

  // The ONE bounded parse. A throw is a fail-to-ABORT — never a retry, never a second call.
  let raw;
  try {
    raw = await parse({ editedProse, groundedSources, budget: { maxInputChars, maxOutputChars } });
  } catch (err) {
    return abortDecision(1, `the bounded LLM parse failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Output budget gate: an unserializable or oversized emission is refused wholesale.
  let serialized;
  try {
    serialized = JSON.stringify(raw);
  } catch {
    serialized = undefined;
  }
  if (typeof serialized !== 'string') {
    return abortDecision(1, 'parse output is not a JSON-serializable artifact candidate');
  }
  if (serialized.length > maxOutputChars) {
    return abortDecision(
      1,
      `parse output exceeds the re-derive output budget (${serialized.length} > ${maxOutputChars} chars)`,
    );
  }

  // EXACTLY-ONCE validation, schema first. A failure aborts with the structured
  // per-field reasons stamped into the decision; nothing is ever re-validated.
  const schemaResult = validatePlanArtifact(raw);
  instrument.onSchemaValidated?.(schemaResult);
  if (!schemaResult.ok) {
    return abortDecision(
      1,
      're-derived artifact failed the module-owned PlanArtifact schema',
      schemaResult.reasons,
    );
  }

  // EXACTLY-ONCE deterministic verbatim-anchor check (word-for-word, no semantic matching).
  const anchorResult = verbatimAnchorCheck(raw, groundedSources);
  instrument.onAnchorChecked?.(anchorResult);
  if (!anchorResult.ok) {
    return abortDecision(
      1,
      're-derived artifact carries an anchor that does not quote the grounded summary/seed text word-for-word',
      anchorResult.failures,
    );
  }

  // EXACTLY-ONCE deterministic, bijective approved-prose binding check BEFORE RUN
  // (literal whitespace-collapsed containment only, never semantic span->slot
  // matching; bound in BOTH directions and PER SLOT): a schema-valid, fully-anchored
  // emission that carries values absent from the APPROVEd prose, DROPS approved plan
  // elements, or re-pairs approved values across slots describes a plan the human
  // never approved and must not execute. The stamped failures name each unbound
  // value, dropped slot, or cross-wired slot.
  const bindingResult = approvedProseBinding(raw, editedProse);
  instrument.onBindingChecked?.(bindingResult);
  if (!bindingResult.ok) {
    return abortDecision(
      1,
      'binding failure: the re-derived artifact does not bind bijectively to the APPROVEd prose — ' +
        'a plan element value is absent from the prose, an approved plan element was dropped, or a ' +
        'value is not in the approved line for its own slot; the emission describes a plan the human ' +
        'never approved (see the stamped failures for each named slot)',
      bindingResult.failures,
    );
  }

  return Object.freeze({
    outcome: 'RUN',
    path: 'approve-with-edits',
    parseCalls: 1,
    artifact: canonicalizePlanArtifact(raw),
  });
}

/**
 * Resolve what executes after the one-shot gate APPROVEs a prose plan:
 *
 *   - approvedProse byte-identical to renderPlanProse(derivedArtifact) -> the
 *     already-derived artifact executes AS-IS (same object, zero parse calls);
 *   - ANY byte difference -> the single bounded re-derive parse (rederiveFromProse),
 *     which RUNs on success or fail-to-ABORTs with a stamped reason.
 *
 * @param {object} options
 * @param {import('./planArtifact.schema.mjs').PlanArtifact} options.derivedArtifact
 *   The artifact derived BEFORE the gate (already schema-validated at derive time;
 *   rendering re-refuses a schema-invalid one).
 * @param {string} options.approvedProse The plan body the gate resolved with APPROVE.
 * @param {Map<string,string>|Record<string,string>} options.groundedSources
 * @param {Function} options.parse
 * @param {number} [options.maxInputChars]
 * @param {number} [options.maxOutputChars]
 * @param {object} [options.instrument]
 * @returns {Promise<RederiveRunDecision|RederiveAbortDecision>}
 */
export async function resolveApprovedPlan({ derivedArtifact, approvedProse, ...rederiveOptions } = {}) {
  if (typeof approvedProse !== 'string') {
    throw new TypeError('resolveApprovedPlan: approvedProse must be a string (the gate-approved plan body)');
  }
  const renderedProse = renderPlanProse(derivedArtifact);
  if (approvedProse === renderedProse) {
    return Object.freeze({
      outcome: 'RUN',
      path: 'approve-verbatim',
      parseCalls: 0,
      artifact: derivedArtifact,
    });
  }
  return rederiveFromProse({ editedProse: approvedProse, ...rederiveOptions });
}
