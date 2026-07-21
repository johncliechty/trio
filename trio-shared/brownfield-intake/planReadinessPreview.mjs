// trio-shared/brownfield-intake/planReadinessPreview.mjs — Wave 8: the pre-flight
// 'plan readiness' preview.
//
// DISPLAY ONLY. Like the Wave-6 manifest and the Wave-3 coverage sidecar, this is
// informational text the user is SHOWN before the gate — it prompts for nothing,
// gates nothing, and is never part of the editable plan body (the Wave-1 subtractive
// decision: coverage is an advisory sidecar, never a schema gate). It renders:
//
//   - the advisory coverage sidecar (./renderCoverageSidecar.mjs) for a schema-valid
//     artifact;
//   - UNANCHORED ELEMENTS highlighted: every element whose model-authored anchor
//     fails the deterministic word-for-word check against the grounded sources;
//   - UNCOVERED HIGH-SIGNAL SPANS: grounded-source sentences long enough to ground an
//     anchor (>= DEFAULT_MIN_QUOTE_LENGTH collapsed chars) that no anchor quotes into;
//   - on a FAILED derivation (no artifact exists), the stamped per-element failures —
//     the offending elements are surfaced here rather than silently executed.
//
// Deterministic and pure: output depends only on its inputs; total — bad shapes render
// as text, they never throw (throwing is reserved for caller programming errors).

import { validatePlanArtifact } from './validatePlanArtifact.mjs';
import { verbatimAnchorCheck, DEFAULT_MIN_QUOTE_LENGTH } from './verbatimAnchorCheck.mjs';
import { renderCoverageSidecar } from './renderCoverageSidecar.mjs';

export const PLAN_READINESS_VERSION = 'brownfield-intake/plan-readiness/1';

/** Stable marker naming the preview — consumers/tests assert it stays display-only. */
export const PLAN_READINESS_MARKER = 'PLAN READINESS PREVIEW';

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function collapse(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

/** Deterministic sentence split for uncovered-span reporting (display only). */
function splitSpans(text) {
  return String(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => collapse(s))
    .filter((s) => s.length >= DEFAULT_MIN_QUOTE_LENGTH);
}

/** Collect every anchor quote on the artifact (defensively; shape may be partial). */
function collectQuotes(artifact) {
  const quotes = [];
  if (!isPlainObject(artifact)) return quotes;
  const elements = [artifact.scope, artifact.foresight];
  for (const list of [artifact.branches, artifact.sourcesToBeat]) {
    if (Array.isArray(list)) elements.push(...list);
  }
  for (const element of elements) {
    if (!isPlainObject(element) || !Array.isArray(element.anchors)) continue;
    for (const anchor of element.anchors) {
      if (isPlainObject(anchor) && typeof anchor.quote === 'string') {
        quotes.push(collapse(anchor.quote));
      }
    }
  }
  return quotes;
}

/**
 * Uncovered high-signal spans: for each grounded source, the sentences long enough to
 * ground an anchor that no anchor quote overlaps (literal collapsed containment in
 * either direction — display heuristic only, never a gate).
 *
 * @param {unknown} artifact
 * @param {Map<string,string>|Record<string,string>} groundedSources
 * @returns {Array<{ sourceId: string, span: string }>}
 */
export function uncoveredHighSignalSpans(artifact, groundedSources) {
  const quotes = collectQuotes(artifact);
  const entries =
    groundedSources instanceof Map
      ? [...groundedSources.entries()]
      : isPlainObject(groundedSources)
        ? Object.entries(groundedSources)
        : [];
  const uncovered = [];
  for (const [sourceId, text] of entries) {
    if (typeof text !== 'string') continue;
    for (const span of splitSpans(text)) {
      const covered = quotes.some((q) => q.length > 0 && (span.includes(q) || q.includes(span)));
      if (!covered) uncovered.push({ sourceId, span });
    }
  }
  return uncovered;
}

function pushFailureLines(lines, failures) {
  for (const failure of failures) {
    if (!isPlainObject(failure)) continue;
    const path = typeof failure.path === 'string' ? failure.path : '(derive)';
    const reason = typeof failure.reason === 'string' ? failure.reason : 'unspecified failure';
    lines.push(`- ${path}: ${reason}`);
    if (typeof failure.sourceId === 'string') lines.push(`    - claimed sourceId: ${failure.sourceId}`);
    if (typeof failure.quote === 'string') lines.push(`    - offending quote: "${failure.quote}"`);
  }
}

/**
 * Render the pre-flight plan-readiness preview. Display only — never a gate, never a
 * prompt, never part of the editable plan body.
 *
 * @param {object} options
 * @param {unknown} [options.artifact] The derived PlanArtifact (null when derivation
 *   failed and no artifact exists).
 * @param {Map<string,string>|Record<string,string>} [options.groundedSources]
 *   sourceId -> grounded text the anchors quote from.
 * @param {object[]} [options.failures] Stamped failures from a FAILED derivation
 *   (schema reasons or anchor failures) to surface.
 * @returns {string} display-only text (LF line endings, single trailing newline)
 */
export function planReadinessPreview({ artifact = null, groundedSources = {}, failures = [] } = {}) {
  const lines = [];
  lines.push(`> ${PLAN_READINESS_MARKER} (${PLAN_READINESS_VERSION}) — display only.`);
  lines.push('> Shown ALONGSIDE the plan before the gate for information. It is never part of');
  lines.push('> the editable plan body, never a prompt, and never an approval gate.');
  lines.push('');

  if (Array.isArray(failures) && failures.length > 0) {
    lines.push('## Derivation failures (surfaced here, never silently executed)');
    lines.push('');
    pushFailureLines(lines, failures);
    lines.push('');
  }

  if (artifact === null || artifact === undefined) {
    if (!Array.isArray(failures) || failures.length === 0) {
      lines.push('No plan artifact was derived and no failures were reported.');
      lines.push('');
    }
    return lines.join('\n') + '\n';
  }

  const schemaResult = validatePlanArtifact(artifact);
  if (!schemaResult.ok) {
    lines.push('## Artifact is schema-invalid (no such artifact may execute)');
    lines.push('');
    pushFailureLines(lines, schemaResult.reasons);
    lines.push('');
    return lines.join('\n') + '\n';
  }

  lines.push(renderCoverageSidecar(artifact).trimEnd());
  lines.push('');

  const anchorResult = verbatimAnchorCheck(artifact, groundedSources);
  lines.push('## Unanchored elements (highlighted)');
  lines.push('');
  if (anchorResult.ok) {
    lines.push('None — every plan element anchors verbatim into a grounded source.');
  } else {
    pushFailureLines(lines, anchorResult.failures);
  }
  lines.push('');

  const uncovered = uncoveredHighSignalSpans(artifact, groundedSources);
  lines.push('## Uncovered high-signal spans (grounded text no anchor quotes into)');
  lines.push('');
  if (uncovered.length === 0) {
    lines.push('None — every high-signal span of the grounded sources is covered by an anchor.');
  } else {
    for (const { sourceId, span } of uncovered) {
      lines.push(`- ${sourceId}: "${span}"`);
    }
  }
  return lines.join('\n') + '\n';
}
