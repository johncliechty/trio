// crucible/bin/elegance-hooks.mjs — the Elegance / Rabbit-Catcher pass at Crucible's two hooks.
//
// John, 2026-09-05: run the pass after the plan is built (Stage 1) and after the wave
// decomposition (Stage 2), BEFORE the Shark round, so the Sharks review the CUT plan together
// with the verdict table — that is the adversarial review of the pass. CUT verdicts BLOCK here
// (John's decision: the cheapest point, before anything is built). Pure apply functions +
// one runner; the engine is drivers/elegance-pass.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { runElegancePass, renderElegancePass } from '../../drivers/elegance-pass.mjs';

/** Elements of a Stage-1 plan: every near-term specific, id `P<phase>.<n>`. */
export function elementsFromPlan(plan) {
  const out = [];
  const phases = Array.isArray(plan?.phases) ? plan.phases : [];
  phases.forEach((p, i) => {
    const specs = Array.isArray(p?.nearTermSpecifics) ? p.nearTermSpecifics : [];
    specs.forEach((s, j) => {
      const text = String(s ?? '').trim();
      if (text) out.push({ id: `P${i + 1}.${j + 1}`, text, kind: kindOf(text), detail: `phase ${i + 1}: ${String(p?.name ?? '').slice(0, 120)}` });
    });
  });
  return out;
}

/** Apply verdicts to a Stage-1 plan: CUT removes the specific; HOLD annotates it with its trigger. Pure. */
export function applyVerdictsToPlan(plan, verdicts) {
  const byId = new Map((Array.isArray(verdicts) ? verdicts : []).map((v) => [v.id, v]));
  const phases = (Array.isArray(plan?.phases) ? plan.phases : []).map((p, i) => {
    const specs = Array.isArray(p?.nearTermSpecifics) ? p.nearTermSpecifics : [];
    const kept = [];
    const cut = [];
    specs.forEach((s, j) => {
      const v = byId.get(`P${i + 1}.${j + 1}`);
      if (v?.verdict === 'CUT') { cut.push(String(s)); return; }
      if (v?.verdict === 'HOLD') { kept.push(`${String(s)} (HOLD — ${v.trigger || v.needed_because || 'trigger to be named'})`); return; }
      kept.push(s);
    });
    const deferred = [...(Array.isArray(p?.deferred) ? p.deferred : []), ...cut.map((s) => `${s} (CUT by the elegance pass)`)];
    return { ...p, nearTermSpecifics: kept, deferred };
  });
  return { ...plan, phases };
}

/** Elements of a Stage-2 decomposition: every wave deliverable, id `W<n>.<k>`; a wave with none contributes its title. */
export function elementsFromWaves(waves) {
  const out = [];
  (Array.isArray(waves) ? waves : []).forEach((w, i) => {
    const dels = Array.isArray(w?.deliverables) ? w.deliverables.map((d) => String(d ?? '').trim()).filter(Boolean) : [];
    if (!dels.length) {
      out.push({ id: `W${i + 1}.1`, text: String(w?.title ?? `Wave ${i + 1}`), kind: 'element', detail: `done-when: ${String(w?.doneWhen ?? '').slice(0, 300)}` });
      return;
    }
    dels.forEach((d, k) => out.push({ id: `W${i + 1}.${k + 1}`, text: d, kind: kindOf(d), detail: `wave ${i + 1} "${String(w?.title ?? '').slice(0, 80)}" — done-when: ${String(w?.doneWhen ?? '').slice(0, 300)}` }));
  });
  return out;
}

/** Apply verdicts to waves: CUT removes the deliverable; a wave whose deliverables are ALL cut is dropped; HOLD annotates. Pure. */
export function applyVerdictsToWaves(waves, verdicts) {
  const byId = new Map((Array.isArray(verdicts) ? verdicts : []).map((v) => [v.id, v]));
  const out = [];
  (Array.isArray(waves) ? waves : []).forEach((w, i) => {
    const dels = Array.isArray(w?.deliverables) ? w.deliverables : [];
    if (!dels.length) {
      const v = byId.get(`W${i + 1}.1`);
      if (v?.verdict === 'CUT') return;
      out.push(v?.verdict === 'HOLD' ? { ...w, title: `${w.title} (HOLD — ${v.trigger || 'trigger to be named'})` } : w);
      return;
    }
    const kept = [];
    dels.forEach((d, k) => {
      const v = byId.get(`W${i + 1}.${k + 1}`);
      if (v?.verdict === 'CUT') return;
      kept.push(v?.verdict === 'HOLD' ? `${d} (HOLD — ${v.trigger || v.needed_because || 'trigger to be named'})` : d);
    });
    if (!kept.length) return;   // every deliverable cut ⇒ the wave is gone
    out.push({ ...w, deliverables: kept });
  });
  return out;
}

function kindOf(text) {
  const t = String(text).toLowerCase();
  if (/\btest(s|ing)?\b|fixture|hermetic|seam|refactor/.test(t)) return 'malleability';
  if (/\bgate\b|guard|fail[- ]closed|invariant|assert/.test(t)) return 'guard';
  return 'element';
}

/**
 * Run the pass over a plan or a wave list and persist the record. Returns the applied plan/waves
 * plus the markdown the Shark draft carries. Never throws on an empty element list.
 *
 * @param {object} o
 * @param {object} [o.plan]       Stage-1 plan (phases[]) — exactly one of plan / waves
 * @param {object[]} [o.waves]    Stage-2 waves
 * @param {string} o.northStar
 * @param {string[]} [o.criteria]
 * @param {object} [o.provenance] {userRatified[], records[], proposerWritten[]}; default: the criteria are proposer-written
 * @param {Function} o.agent      role-routed agent (synthesizer → catcher, shark → adversary)
 * @param {string} [o.artifactsDir]
 * @param {Function} [o.log]
 */
export async function runPlanElegancePass({ plan = null, waves = null, northStar, criteria = [], provenance = null, agent, artifactsDir = null, log = () => {}, adversary = true, fileTag = '' } = {}) {
  const isWaves = Array.isArray(waves);
  const elements = isWaves ? elementsFromWaves(waves) : elementsFromPlan(plan);
  const prov = provenance || { userRatified: [], records: [], proposerWritten: criteria.map((c) => `criterion: ${String(c).slice(0, 200)}`) };
  const context = isWaves ? `the Stage-2 wave decomposition (${waves.length} wave(s))` : `the Stage-1 master plan (${plan?.phases?.length ?? 0} phase(s))`;
  const result = await runElegancePass({ elements, northStar, criteria, provenance: prov, agent, context, log, adversary });
  const applied = isWaves ? applyVerdictsToWaves(waves, result.verdicts) : applyVerdictsToPlan(plan, result.verdicts);
  if (artifactsDir) {
    try {
      fs.mkdirSync(artifactsDir, { recursive: true });
      fs.writeFileSync(path.join(artifactsDir, `ELEGANCE-PASS${fileTag}.md`), result.markdown, 'utf8');
      fs.writeFileSync(path.join(artifactsDir, `elegance-pass${fileTag}.json`), JSON.stringify({
        version: result.version, context, cuts: result.cuts, holds: result.holds, keeps: result.keeps,
        verdicts: result.verdicts, disputes: result.disputes, at: new Date().toISOString(),
      }, null, 2) + '\n', 'utf8');
    } catch (e) { log(`!! elegance pass record not written (non-fatal): ${e?.message || e}`); }
  }
  log(`elegance pass (${context}): cut ${result.cuts.length} · hold ${result.holds.length} · keep ${result.keeps.length}` +
    (result.cuts.length ? ` — cut: ${result.cuts.join(', ')}` : ' — nothing cut (said aloud)'));
  return { ...result, plan: isWaves ? null : applied, waves: isWaves ? applied : null, elements };
}

/** The section appended to the Shark draft so the reviewers attack the verdicts too. */
export function elegancePassSection(result) {
  if (!result) return '';
  return `\n\n## Elegance pass (Rabbit-Catcher) — verdicts the reviewers may dispute\n\n` +
    renderElegancePass({ verdicts: result.verdicts, disputes: result.disputes, context: '' }) +
    `\nA reviewer who disagrees with a verdict states it as a finding: a KEEP without an independent need, a CUT that surrenders a datum, a HOLD without a trigger.\n`;
}
