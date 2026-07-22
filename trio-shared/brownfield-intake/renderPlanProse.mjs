// trio-shared/brownfield-intake/renderPlanProse.mjs — Wave 3: PlanArtifact -> the gate's
// canonical markdown plan body, as HUMAN-READABLE PROSE.
//
// This is the RENDER half of the gate round-trip, built OUTSIDE the frozen gate files
// (plan-gate.mjs / two-gate.mjs are never touched — Wave-1 empirical finding: the gate
// serializes the plan body opaquely and inspects no field). The rendered body is the
// EDITABLE surface a human sees at the one-shot APPROVE/EDIT/ABORT gate:
//
//   - every schema field appears as a LABELED prose section (scope/AXIS, candidate
//     branches/questions, sources-to-beat, foresight receipt, artifact version);
//   - seeds are listed ONE LINE PER SEED as identifier + title;
//   - anchors are NEVER rendered here — coverage/provenance is an ADVISORY SIDECAR
//     (./renderCoverageSidecar.mjs), display-only, never part of the editable body
//     (Wave-1 subtractive decision, docs/DECISION-RECEIPT-shared-location.md §3).
//
// Rendering is pure and deterministic: output depends only on the artifact's VALUES
// (never key insertion order), so two calls on the same content are byte-identical —
// what the golden-snapshot tests pin. The unedited round-trip needs no parse: APPROVE-
// verbatim executes the already-derived artifact (Wave 4 handles APPROVE-with-EDITs).

import { validatePlanArtifact } from './validatePlanArtifact.mjs';
import { renderCoverageSidecar } from './renderCoverageSidecar.mjs';

/** Refuse to present a schema-invalid artifact at the gate. */
function assertSchemaValid(artifact, caller) {
  const res = validatePlanArtifact(artifact);
  if (!res.ok) {
    const detail = res.reasons.map((r) => `${r.path}: ${r.reason}`).join('; ');
    throw new TypeError(`${caller}: schema-invalid PlanArtifact — ${detail}`);
  }
}

/**
 * Render a schema-valid PlanArtifact into the gate's markdown plan body as
 * human-readable prose. Deterministic and byte-stable: same content -> same bytes,
 * regardless of the artifact's key insertion order. Anchors are never rendered.
 *
 * @param {import('./planArtifact.schema.mjs').PlanArtifact} artifact
 * @returns {string} markdown prose plan body (LF line endings, single trailing newline)
 */
export function renderPlanProse(artifact) {
  assertSchemaValid(artifact, 'renderPlanProse');

  const lines = [];
  lines.push('# Research Plan');
  lines.push('');
  lines.push(`**Artifact version:** ${artifact.artifactVersion}`);
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push(artifact.scope.statement);
  lines.push('');
  lines.push(`**AXIS (win condition):** ${artifact.scope.axis}`);
  lines.push('');
  lines.push('## Candidate branches / questions');
  lines.push('');
  if (artifact.branches.length === 0) {
    lines.push('None derived.');
  } else {
    artifact.branches.forEach((branch, i) => {
      lines.push(`${i + 1}. **Question:** ${branch.question}`);
      lines.push(`   **Rationale:** ${branch.rationale}`);
    });
  }
  lines.push('');
  lines.push('## Sources to beat');
  lines.push('');
  if (artifact.sourcesToBeat.length === 0) {
    lines.push('None derived.');
  } else {
    for (const source of artifact.sourcesToBeat) {
      lines.push(`- **${source.title}** — ${source.why}`);
    }
  }
  lines.push('');
  lines.push('## Foresight receipt');
  lines.push('');
  lines.push(`**Dropped/reordered:** ${artifact.foresight.dropped}`);
  lines.push(`**Counterfactual cost:** ${artifact.foresight.counterfactualCost}`);
  lines.push(`**Stamp:** ${artifact.foresight.stamp}`);
  lines.push('');
  lines.push('## Seeds');
  lines.push('');
  if (artifact.seeds.length === 0) {
    lines.push('None provided.');
  } else {
    for (const seed of artifact.seeds) {
      lines.push(`- ${seed.idType}:${seed.id} — ${seed.title}`);
    }
  }
  return lines.join('\n') + '\n';
}

/**
 * Compose the full gate presentation: the editable plan body plus, when enabled, the
 * advisory coverage sidecar as a SEPARATE display-only string. The plan body bytes are
 * IDENTICAL whether or not the sidecar is enabled — coverage never enters the editable
 * surface, and altering or discarding the sidecar has no effect on the plan.
 *
 * @param {import('./planArtifact.schema.mjs').PlanArtifact} artifact
 * @param {{ includeCoverageSidecar?: boolean }} [options]
 * @returns {{ planBody: string, coverageSidecar: string | null }}
 */
export function renderPlanPresentation(artifact, { includeCoverageSidecar = true } = {}) {
  const planBody = renderPlanProse(artifact);
  const coverageSidecar = includeCoverageSidecar ? renderCoverageSidecar(artifact) : null;
  return { planBody, coverageSidecar };
}
