// trio-shared/brownfield-intake/renderCoverageSidecar.mjs — Wave 3: the ADVISORY
// coverage sidecar.
//
// Derived entirely from the artifact's model-emitted verbatim span anchors, this is
// DISPLAY-ONLY text the user is SHOWN alongside the plan body at the gate. It is never
// part of the editable plan body, never a human-maintained field, never a schema gate on
// edits (Wave-1 subtractive decision, docs/DECISION-RECEIPT-shared-location.md §3): the
// user is never asked to hand-edit or reconcile it, and altering or removing it has no
// effect on the rendered plan body bytes — the sidecar tests pin exactly that.
//
// Deterministic and pure: output depends only on the artifact's values, so two calls on
// the same content are byte-identical.

import { validatePlanArtifact } from './validatePlanArtifact.mjs';

/** Stable marker naming the sidecar — consumers/tests use it to assert the sidecar
 *  stays OUT of the editable plan body. */
export const COVERAGE_SIDECAR_MARKER = 'ADVISORY COVERAGE SIDECAR';

function pushElementCoverage(lines, label, anchors) {
  lines.push(`- ${label}: ${anchors.length} anchor(s)`);
  for (const anchor of anchors) {
    lines.push(`    - ${anchor.sourceId}: "${anchor.quote}"`);
  }
}

/**
 * Render the advisory coverage sidecar for a schema-valid PlanArtifact: per-element
 * anchor coverage (scope, each branch, each source-to-beat, the foresight receipt),
 * quoting each verbatim span and its source id. Seeds are user-supplied identity and
 * carry no anchors by design, so they are reported as a count only.
 *
 * @param {import('./planArtifact.schema.mjs').PlanArtifact} artifact
 * @returns {string} display-only sidecar text (LF line endings, single trailing newline)
 */
export function renderCoverageSidecar(artifact) {
  const res = validatePlanArtifact(artifact);
  if (!res.ok) {
    const detail = res.reasons.map((r) => `${r.path}: ${r.reason}`).join('; ');
    throw new TypeError(`renderCoverageSidecar: schema-invalid PlanArtifact — ${detail}`);
  }

  const lines = [];
  lines.push(`> ${COVERAGE_SIDECAR_MARKER} — display only.`);
  lines.push("> Derived from the plan artifact's verbatim span anchors and shown ALONGSIDE");
  lines.push('> the plan for information. It is never part of the editable plan body: you are');
  lines.push('> not asked to hand-edit it, and editing or removing it has no effect on the plan.');
  lines.push('');
  lines.push('Coverage by plan element:');
  lines.push('');
  pushElementCoverage(lines, 'scope', artifact.scope.anchors);
  artifact.branches.forEach((branch, i) => {
    pushElementCoverage(lines, `branches[${i}] (${branch.question})`, branch.anchors);
  });
  artifact.sourcesToBeat.forEach((source, i) => {
    pushElementCoverage(lines, `sourcesToBeat[${i}] (${source.title})`, source.anchors);
  });
  pushElementCoverage(lines, 'foresight', artifact.foresight.anchors);
  lines.push(
    `- seeds: ${artifact.seeds.length} seed(s) — user-supplied identity, no anchors by design`,
  );
  return lines.join('\n') + '\n';
}
