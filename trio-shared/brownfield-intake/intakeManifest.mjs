// trio-shared/brownfield-intake/intakeManifest.mjs — Wave 6: the pre-Gandalf MANIFEST.
//
// Before any Gandalf call, intake emits ONE manifest — roots, resolved file list,
// token estimate + budget decision, seed set — as DISPLAY and fail-fast ONLY. It is
// explicitly NOT a second approval gate: nothing here prompts, waits, or reads input;
// the ONE plan-review gate (researchPrime's frozen plan-gate/two-gate) remains the
// only approval surface in the whole flow. `proceed` is a computed fail-fast verdict
// (false on a fail-fast budget decision), not a question.
//
// Pure and synchronous throughout, in the module's established total style.

import { SECURITY_REASONS } from './trustBoundary.mjs';

export const INTAKE_MANIFEST_VERSION = 'brownfield-intake/manifest/1';

/** The manifest's standing disclaimer, rendered on every display. */
export const MANIFEST_NOT_A_GATE =
  'This manifest is informational display + fail-fast only. It is NOT an approval ' +
  'gate: no prompt is issued, no response is awaited, and the one-shot plan-review ' +
  'gate remains the only approval surface.';

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * @typedef {object} IntakeManifest
 * @property {string} manifestVersion
 * @property {true} notAGate Structural marker: display + fail-fast, never approval.
 * @property {string[]} roots The declared ingest roots, in declared order.
 * @property {Array<{ path: string, tokens: number|null }>} files The resolved file list
 *   (post-budget when a budget decision is supplied).
 * @property {Array<{ path: string, reason: string, detail?: string }>} securityRejections
 *   Trust-boundary rejections, each with its named security reason.
 * @property {{ estimatedTokens: number|null, budgetTokens: number|null,
 *   decision: string|null, truncated: boolean,
 *   stamp: object|null, reason: string|null }} budget
 * @property {{ accepted: Array<{ idType: string, id: string, title: string }>,
 *   rejected: Array<{ reason: string }> }} seeds
 * @property {boolean} proceed False iff the budget decision is fail-fast.
 * @property {string[]} failFastReasons Every reason the run stops at the door.
 */

/**
 * Build the pre-Gandalf manifest from the trust-boundary file set, the pre-flight
 * budget decision, and the validated seed set. Pure; no prompt, no I/O.
 *
 * @param {object} options
 * @param {string[]} options.roots Declared roots, in declared order.
 * @param {{ files?: Array<{ path: string }>, rejected?: Array<object> }} [options.fileSet]
 *   resolveIngestFileSet() output (pre-budget enumeration).
 * @param {object} [options.budget] preflightIntakeBudget() decision.
 * @param {{ seeds?: ReadonlyArray<object>, rejected?: Array<object> }} [options.seeds]
 *   validateSeedsForHandoff() output.
 * @returns {Readonly<IntakeManifest>}
 */
export function buildIntakeManifest({ roots, fileSet = {}, budget = null, seeds = {} } = {}) {
  if (!Array.isArray(roots) || roots.some((r) => typeof r !== 'string')) {
    throw new TypeError('buildIntakeManifest: roots must be an array of strings');
  }
  if (!isPlainObject(fileSet)) {
    throw new TypeError('buildIntakeManifest: fileSet must be an object');
  }

  // Prefer the budget decision's (possibly truncated) file spans; fall back to the
  // trust-boundary enumeration (which never reads bytes, so tokens are unknown there).
  const budgetFiles = budget && Array.isArray(budget.files) ? budget.files : null;
  const files = (budgetFiles ?? fileSet.files ?? []).map((f) => ({
    path: f.path,
    tokens: Number.isInteger(f.tokens) ? f.tokens : null,
  }));

  const securityRejections = (fileSet.rejected ?? []).map((r) => ({
    path: r.path,
    reason: r.reason,
    detail: r.detail,
  }));

  const failFastReasons = [];
  if (budget && budget.decision === 'fail-fast') failFastReasons.push(budget.reason);

  const manifest = {
    manifestVersion: INTAKE_MANIFEST_VERSION,
    notAGate: true,
    roots: [...roots],
    files,
    securityRejections,
    budget: {
      estimatedTokens: budget?.estimatedTokens ?? null,
      budgetTokens: budget?.budgetTokens ?? null,
      decision: budget?.decision ?? null,
      truncated: budget?.truncated === true,
      stamp: budget?.stamp ?? null,
      reason: budget?.decision === 'fail-fast' ? budget.reason : null,
    },
    seeds: {
      accepted: (seeds.seeds ?? []).map((s) => ({ idType: s.idType, id: s.id, title: s.title })),
      rejected: (seeds.rejected ?? []).map((r) => ({ reason: r.reason })),
    },
    proceed: failFastReasons.length === 0,
    failFastReasons,
  };
  return Object.freeze(manifest);
}

/**
 * Render the manifest as deterministic display text. Returns a string; prints nothing,
 * prompts for nothing.
 *
 * @param {IntakeManifest} manifest
 * @returns {string}
 */
export function renderIntakeManifest(manifest) {
  if (!isPlainObject(manifest) || manifest.manifestVersion !== INTAKE_MANIFEST_VERSION) {
    throw new TypeError('renderIntakeManifest: not an intake manifest');
  }
  const lines = [];
  lines.push(`# Pre-Gandalf intake manifest (${manifest.manifestVersion})`);
  lines.push('');
  lines.push(`> ${MANIFEST_NOT_A_GATE}`);
  lines.push('');
  lines.push('## Declared roots');
  for (const root of manifest.roots) lines.push(`- ${root}`);
  if (manifest.roots.length === 0) lines.push('- (none)');
  lines.push('');
  lines.push('## Files');
  for (const f of manifest.files) {
    lines.push(`- ${f.path}${f.tokens === null ? '' : ` — ~${f.tokens} tokens`}`);
  }
  if (manifest.files.length === 0) lines.push('- (none)');
  lines.push('');
  if (manifest.securityRejections.length > 0) {
    lines.push('## Security rejections (trust boundary)');
    for (const r of manifest.securityRejections) {
      lines.push(`- ${r.path} — REJECTED [${r.reason}]${r.detail ? `: ${r.detail}` : ''}`);
    }
    lines.push('');
  }
  lines.push('## Budget');
  lines.push(
    `- estimate: ${manifest.budget.estimatedTokens ?? 'n/a'} tokens / budget: ` +
      `${manifest.budget.budgetTokens ?? 'n/a'} tokens — decision: ${manifest.budget.decision ?? 'n/a'}`,
  );
  if (manifest.budget.truncated) {
    lines.push(`- TRUNCATED: ${manifest.budget.stamp?.reason ?? 'stamped truncated'}`);
  }
  if (manifest.budget.reason) lines.push(`- FAIL FAST: ${manifest.budget.reason}`);
  lines.push('');
  lines.push('## Seeds');
  for (const s of manifest.seeds.accepted) lines.push(`- ${s.idType}:${s.id} — ${s.title}`);
  if (manifest.seeds.accepted.length === 0) lines.push('- (none)');
  for (const r of manifest.seeds.rejected) lines.push(`- REJECTED — ${r.reason}`);
  lines.push('');
  lines.push(
    manifest.proceed
      ? 'Decision: PROCEED to intake (no approval was asked; this is not a gate).'
      : 'Decision: FAIL FAST at the intake door (no approval was asked; this is not a gate).',
  );
  return lines.join('\n');
}

/**
 * The fail-fast verdict as a tiny helper for callers: `{ proceed, reasons }`.
 * @param {IntakeManifest} manifest
 */
export function manifestFailFast(manifest) {
  return { proceed: manifest.proceed === true, reasons: [...(manifest.failFastReasons ?? [])] };
}

/** Re-exported so manifest consumers can name-match security reasons without a second import. */
export { SECURITY_REASONS };
