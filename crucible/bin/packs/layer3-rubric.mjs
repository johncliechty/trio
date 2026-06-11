// crucible/bin/packs/layer3-rubric.mjs — LAYER 3: frozen evidence-anchored rubric.
//
// Reuses the Judge MACHINERY (selectJudgeModel + stampRole + the spawn seam) but defines
// a NEW scoring output contract (RUBRIC_SCHEMA: per-criterion score+citations) that is
// DISTINCT from the convergence Judge's CONVERGED/NOT_CONVERGED. The two contracts never
// merge — judge.mjs is imported, not modified, so its byte-identical convergence path is
// preserved (SR-6; asserted in pack-layer3-rubric.test.mjs).
//
// Determinism (Phase 2.4 done-when): a frozen rubric + a deterministic scorer always
// yields the same verdict — the rubric spec is deep-frozen so a run cannot mutate it.

import { selectJudgeModel, stampRole, defaultProbeCrossModel } from '../judge.mjs';
import { HaltError } from '../crucible-lib.mjs';

export const RUBRIC_ROLE = 'RubricJudge';

/** The rubric judge's per-criterion reply — NOT the convergence verdict. */
export const RUBRIC_SCHEMA = {
  type: 'object',
  required: ['score'],
  properties: {
    score: { type: 'number' },                          // 0..1 evidence-anchored score
    pass: { type: 'boolean' },
    citations: { type: 'array', items: { type: 'string' } },
    rationale: { type: 'string' },
  },
};

/** Compile a pack rubric to an IMMUTABLE spec (deep-frozen) so a run can't mutate it. */
export function compileRubric(pack) {
  const r = pack?.rubric;
  if (!r || !Array.isArray(r.criteria) || r.criteria.length < 3 || r.criteria.length > 7) {
    throw new HaltError('Layer 3 needs a frozen 3-7 criterion rubric', `pack "${pack?.id}" has no valid rubric`);
  }
  const spec = {
    model: r.rubric_judge_model,
    pass_score_min: r.boundary?.pass_score_min ?? 0.7,
    criteria: r.criteria.map((c) => Object.freeze({
      id: c.id, statement: c.statement, pass_threshold: c.pass_threshold ?? 0.7,
    })),
  };
  Object.freeze(spec.criteria);
  return Object.freeze(spec);
}

/** Build a per-criterion scorer from the agent seam (live path). */
export function makeRubricScorerFromAgent({ agent, model, log = () => {} }) {
  if (typeof agent !== 'function') throw new HaltError('makeRubricScorerFromAgent requires agent()', 'pass the Wave-1 seam');
  return async ({ doc, criterion }) => {
    const prompt = [
      `You are a RUBRIC JUDGE scoring ONE criterion of a frozen rubric. Score 0..1 by how`,
      `well the DELIVERABLE satisfies the criterion, citing the supporting passages. Use`,
      `ONLY the deliverable as evidence.`,
      ``,
      `=== CRITERION (${criterion.id}) ===\n${criterion.statement}`,
      `=== DELIVERABLE ===\n${doc}\n=== END ===`,
    ].join('\n');
    const out = await agent(prompt, { label: `rubric:${criterion.id}:${model}`, schema: RUBRIC_SCHEMA });
    return { score: Number(out?.score) || 0, citations: Array.isArray(out?.citations) ? out.citations : [] };
  };
}

/**
 * Score a deliverable against the pack's frozen rubric.
 * @param {object} o
 * @param {string} o.doc
 * @param {object} o.pack
 * @param {Function} [o.score]   injected `({doc,criterion})=>{score,citations}` (test/live)
 * @param {Function} [o.agent]   OR the agent seam (live)
 * @param {Function} [o.probeCrossModel=defaultProbeCrossModel]  reused Judge cross-family probe
 * @returns {Promise<{verdict:'PASS'|'FAIL', criteria:object[], aggregate_score:number,
 *   stamp:object, rubric_frozen:true, contract:'rubric-score'}>}
 */
export async function scoreAgainstRubric({ doc, pack, score, agent, probeCrossModel = defaultProbeCrossModel, log = () => {} }) {
  const spec = compileRubric(pack);
  // Reuse the Judge machinery for model selection + attestation (NOT a fork).
  const selection = selectJudgeModel({ authorFamily: 'claude', probe: probeCrossModel });
  const stamp = stampRole({ role: RUBRIC_ROLE, model: selection.model, family: selection.family, mode: selection.mode, reachable: selection.reachable });

  const scoreFn = score || (agent ? makeRubricScorerFromAgent({ agent, model: spec.model, log }) : null);
  if (!scoreFn) throw new HaltError('Layer 3 needs a scorer', 'pass { score } (test) or { agent } (live)');

  const criteria = [];
  for (const c of spec.criteria) {
    const r = await scoreFn({ doc, criterion: c });
    const s = Number(r.score) || 0;
    criteria.push({ id: c.id, score: s, pass: s >= c.pass_threshold, citations: r.citations || [] });
  }
  const aggregate = criteria.length ? criteria.reduce((a, c) => a + c.score, 0) / criteria.length : 0;
  const allPass = criteria.every((c) => c.pass);
  const verdict = (allPass && aggregate >= spec.pass_score_min) ? 'PASS' : 'FAIL';

  return { verdict, criteria, aggregate_score: aggregate, stamp, rubric_frozen: true, contract: 'rubric-score' };
}
