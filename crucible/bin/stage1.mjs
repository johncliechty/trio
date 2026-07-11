// stage1.mjs — Crucible's Stage 1: the Master Plan protocol (Wave 7).
//
// Stage 1 turns a LOCKED North Star (the Stage-0 deliverable) into an approved,
// PHASED Master Plan — the "what & why", with enough concrete near-term specifics
// to seed the Stage-2 implementation plan (MASTER-PLAN §4 Stage 1). It runs the
// Shark-Tank refinement loop end-to-end and ends at the user-approval HALT gate
// (the user is the convergence authority). The flow, in order:
//
//   1. ORANGES BRAINSTORM, in the MANDATORY order assumption-mapping → premortem
//      (§4.1). Map the load-bearing assumptions FIRST, run a premortem AGAINST
//      those assumptions, THEN brainstorm widely with Oranges foresight. The order
//      is structural: the premortem is handed the assumptions, the ideation is
//      handed both — so "two steps ahead" reasoning is seeded by named failure
//      modes, not generated in a vacuum.
//   2. BATCH idea-triage (§4.1): refinements that serve the North Star INTEGRATE ·
//      out-of-scope ideas go to the GRASSCATCHER (parked, not dropped) · redundant/
//      no-value ideas DROP. Batched (the whole brainstorm at once, then summarized
//      — §9), and routed by the inclusion test (a non-tracing idea is out-of-scope).
//   3. A PHASED PLAN with concrete near-term specifics and the rest DEFERRED
//      EXPLICITLY (§4.2) — the plan absorbs ONLY the integrated ideas, never the
//      Grasscatchered ones.
//   4. The SHARK-TANK LOOP (Waves 2–4): sharkfood → fix → sharkfood → … until dry,
//      the Synthesizer (Wave 3) issuing direction between rounds (it steers, never
//      decides), a fresh-eyes cold pass before the lock, the Judge deciding, and the
//      convergence gate (Wave 4) gating dry-round + Judge + drift + fresh-eyes.
//   5. The user-approval HALT gate — reusing the canonical
//      HALT_GATES['stage1->stage2'] ('master-plan-approval') so this gate and the
//      engine's state-machine boundary name the SAME gate.
//
// REUSE, NOT REINVENT: every adversarial/steering/deciding mechanic is the Wave 2–5
// machinery, reached through the Wave-1 `agent()` seam — Stage 1 ORCHESTRATES the
// loop, it does not re-implement Sharks, the Synthesizer, the Judge, the gates, or
// researchPrime.

import fs from 'node:fs';
import path from 'node:path';

import { HaltError, haltForHuman, HALT_GATES } from './crucible-lib.mjs';
import { runSharkTank } from './shark-tank.mjs';
import {
  makeSynthesizer,
  freshEyesColdPass,
  freshEyesIsolationOracle,
  reconcileFreshEyes,
} from './synthesizer.mjs';
import { makeJudge } from './judge.mjs';
import { evaluateConvergenceGate } from './gates.mjs';

// ---------------------------------------------------------------------------
// (1) The Oranges brainstorm — MANDATORY order: assumption-mapping → premortem
//     → ideation. Every prompt embeds the North Star verbatim (§9).
// ---------------------------------------------------------------------------

/** The load-bearing assumptions the whole plan rests on (mapped FIRST). */
export const ASSUMPTION_SCHEMA = {
  type: 'object',
  required: ['assumptions'],
  properties: {
    assumptions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['assumption'],
        properties: {
          id: { type: 'string' },
          assumption: { type: 'string' },
          criticality: { enum: ['high', 'medium', 'low'] },
          basis: { type: 'string' },
        },
      },
    },
  },
};

/** The premortem: how the plan fails, run AGAINST the mapped assumptions. */
export const PREMORTEM_SCHEMA = {
  type: 'object',
  required: ['failureModes'],
  properties: {
    failureModes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['mode'],
        properties: {
          id: { type: 'string' },
          mode: { type: 'string' },
          cause: { type: 'string' },
          assumptionRef: { type: ['string', 'null'] },
          mitigation: { type: 'string' },
        },
      },
    },
  },
};

/**
 * The brainstorm ideas. Each carries the inclusion-test verdict
 * (`traces_to_north_star` + which criterion) and an optional `disposition` the
 * batch-triage honors (else triage infers it from the inclusion test).
 */
export const BRAINSTORM_IDEAS_SCHEMA = {
  type: 'object',
  required: ['ideas'],
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        required: ['idea'],
        properties: {
          id: { type: 'string' },
          idea: { type: 'string' },
          traces_to_north_star: { enum: ['yes', 'no'] },
          criterion: { type: ['string', 'null'] },
          tag: { enum: ['refinement', 'out-of-scope'] },
          disposition: { enum: ['integrate', 'grasscatcher', 'drop'] },
          note: { type: 'string' },
        },
      },
    },
  },
};

function assumptionPrompt({ northStar, criteria, research }) {
  return [
    `You are the Crucible STAGE-1 ASSUMPTION-MAPPING step (the FIRST step of the brainstorm,`,
    `before the premortem). Surface the LOAD-BEARING assumptions the plan toward this North`,
    `Star would silently rest on — the ones that, if wrong, sink it. Reason in the Oranges`,
    `spirit: probe for what is actually assumed two steps downstream, not just the obvious.`,
    ``,
    `=== THE NORTH STAR (verbatim) ===`,
    String(northStar),
    `=== END NORTH STAR ===`,
    criteria.length ? `\n=== SUCCESS CRITERIA ===\n${criteria.map((c, i) => `(${i + 1}) ${c}`).join('\n')}\n=== END CRITERIA ===` : '',
    research ? `\n=== FRESH RESEARCH INPUT ===\n${typeof research === 'string' ? research : JSON.stringify(research)}\n=== END RESEARCH ===` : '',
    ``,
    `Emit: assumptions [{id, assumption, criticality (high|medium|low), basis}].`,
  ].join('\n');
}

function premortemPrompt({ northStar, assumptions }) {
  return [
    `You are the Crucible STAGE-1 PREMORTEM step. It is some time in the future and the plan`,
    `FAILED. Working AGAINST the mapped assumptions below, name how it failed: the failure`,
    `modes, their cause, the assumption each falsifies, and a mitigation. Press hardest where`,
    `a high-criticality assumption turns out to be wrong.`,
    ``,
    `=== THE NORTH STAR (verbatim) ===`,
    String(northStar),
    `=== END NORTH STAR ===`,
    ``,
    `=== MAPPED ASSUMPTIONS (the premortem runs against THESE) ===`,
    assumptions.length
      ? assumptions.map((a, i) => `(${i + 1}) [${a.criticality || '?'}] ${a.assumption}`).join('\n')
      : '(none mapped)',
    `=== END ASSUMPTIONS ===`,
    ``,
    `Emit: failureModes [{id, mode, cause, assumptionRef, mitigation}].`,
  ].join('\n');
}

function ideationPrompt({ northStar, criteria, assumptions, premortem, research }) {
  return [
    `You are the Crucible STAGE-1 BRAINSTORM. Brainstorm WIDELY toward this North Star with`,
    `Oranges foresight (think 2–3 steps ahead; add justified value; show the receipt), now`,
    `INFORMED by the mapped assumptions and the premortem's failure modes. For each idea,`,
    `apply the INCLUSION TEST honestly: does it trace to a North-Star criterion?`,
    ``,
    `=== THE NORTH STAR (verbatim) ===`,
    String(northStar),
    `=== END NORTH STAR ===`,
    criteria.length ? `\n=== SUCCESS CRITERIA ===\n${criteria.map((c, i) => `(${i + 1}) ${c}`).join('\n')}\n=== END CRITERIA ===` : '',
    ``,
    `=== PREMORTEM FAILURE MODES (mitigate these) ===`,
    premortem.length ? premortem.map((f, i) => `(${i + 1}) ${f.mode} — ${f.mitigation || ''}`).join('\n') : '(none)',
    `=== END FAILURE MODES ===`,
    research ? `\n=== FRESH RESEARCH INPUT ===\n${typeof research === 'string' ? research : JSON.stringify(research)}\n=== END RESEARCH ===` : '',
    ``,
    `Emit: ideas [{id, idea, traces_to_north_star (yes|no), criterion, tag (refinement|out-of-scope)}].`,
    `An idea that does NOT trace to a criterion is out-of-scope (it will be parked in the`,
    `Grasscatcher, not absorbed) — label it honestly rather than inflating its relevance.`,
  ].join('\n');
}

/** Map the load-bearing assumptions (the FIRST brainstorm step). */
export async function runAssumptionMap({ agent, northStar, criteria = [], research = null, log = () => {} } = {}) {
  requireAgent(agent, 'runAssumptionMap');
  const out = (await agent(assumptionPrompt({ northStar, criteria, research }), { label: 'stage1:assumptions', schema: ASSUMPTION_SCHEMA })) || {};
  const assumptions = Array.isArray(out.assumptions) ? out.assumptions : [];
  log(`stage1 assumption-map: ${assumptions.length} assumption(s)`);
  return assumptions;
}

/** Run the premortem AGAINST the mapped assumptions (the SECOND brainstorm step). */
export async function runPremortem({ agent, northStar, assumptions = [], log = () => {} } = {}) {
  requireAgent(agent, 'runPremortem');
  const out = (await agent(premortemPrompt({ northStar, assumptions }), { label: 'stage1:premortem', schema: PREMORTEM_SCHEMA })) || {};
  const failureModes = Array.isArray(out.failureModes) ? out.failureModes : [];
  log(`stage1 premortem: ${failureModes.length} failure mode(s)`);
  return failureModes;
}

/**
 * Run the full Oranges brainstorm in the MANDATORY order (§4.1): map assumptions,
 * premortem against them, THEN ideate informed by both. The order is enforced by
 * data flow — the premortem receives the assumptions, the ideation receives both —
 * so it cannot silently run out of order.
 *
 * @param {object} o
 * @param {Function} o.agent                  the Wave-1 agent seam
 * @param {string}   o.northStar
 * @param {string[]}[o.criteria=[]]
 * @param {?(string|object)} [o.research=null]  researchPrime briefing (flows in up-front)
 * @param {Function}[o.log=()=>{}]
 * @returns {Promise<{assumptions:object[], premortem:object[], ideas:object[]}>}
 */
export async function runBrainstorm({ agent, northStar, criteria = [], research = null, log = () => {} } = {}) {
  requireAgent(agent, 'runBrainstorm');
  if (!northStar) throw new HaltError('runBrainstorm requires a locked North Star', 'lock the North Star in Stage 0 first');

  // MANDATORY ORDER: assumption mapping → premortem → ideation.
  const assumptions = await runAssumptionMap({ agent, northStar, criteria, research, log });
  const premortem = await runPremortem({ agent, northStar, assumptions, log });
  const out = (await agent(ideationPrompt({ northStar, criteria, assumptions, premortem, research }), { label: 'stage1:ideas', schema: BRAINSTORM_IDEAS_SCHEMA })) || {};
  const ideas = Array.isArray(out.ideas) ? out.ideas : [];
  log(`stage1 brainstorm: ${ideas.length} idea(s) (after assumption-map → premortem)`);
  return { assumptions, premortem, ideas };
}

// ---------------------------------------------------------------------------
// (2) Batch idea-triage — integrate / Grasscatcher / drop, by the inclusion test.
// ---------------------------------------------------------------------------

export const TRIAGE_DISPOSITIONS = { INTEGRATE: 'integrate', GRASSCATCHER: 'grasscatcher', DROP: 'drop' };

/**
 * The triage disposition of one idea. An explicit `disposition` from the brainstorm
 * wins; otherwise the INCLUSION TEST routes it: an out-of-scope / non-tracing idea
 * goes to the Grasscatcher (parked, never dropped silently), an explicitly redundant
 * idea drops, everything else (a refinement that serves the North Star) integrates.
 */
export function triageDisposition(idea) {
  const explicit = String(idea?.disposition || '').toLowerCase();
  if (Object.values(TRIAGE_DISPOSITIONS).includes(explicit)) return explicit;

  const tracesField = idea?.traces_to_north_star;
  const traces = String(tracesField || '').toLowerCase() === 'yes';
  // Out-of-scope by tag, OR a stated non-tracing verdict ⇒ park in the Grasscatcher.
  if (idea?.tag === 'out-of-scope' || (tracesField != null && !traces)) {
    return TRIAGE_DISPOSITIONS.GRASSCATCHER;
  }
  if (idea?.drop === true) return TRIAGE_DISPOSITIONS.DROP;
  return TRIAGE_DISPOSITIONS.INTEGRATE;
}

/**
 * BATCH-triage the whole brainstorm at once (§4.1/§9): route every idea to
 * integrate / Grasscatcher / drop, then summarize. The phased plan absorbs ONLY the
 * `integrate` bucket — the Grasscatchered ideas are parked (optionally appended to a
 * GRASSCATCHER.md) and never silently absorbed.
 *
 * @param {object} o
 * @param {object[]} [o.ideas=[]]
 * @param {?string} [o.grasscatcherPath=null]   when set, parked ideas are appended here
 * @param {Function}[o.log=()=>{}]
 * @returns {{integrate:object[], grasscatcher:object[], dropped:object[],
 *            batch:true, grasscatcherPath:?string}}
 */
export function triageIdeas({ ideas = [], grasscatcherPath = null, log = () => {} } = {}) {
  const integrate = [];
  const grasscatcher = [];
  const dropped = [];
  for (const idea of ideas || []) {
    const disp = triageDisposition(idea);
    if (disp === TRIAGE_DISPOSITIONS.GRASSCATCHER) grasscatcher.push(idea);
    else if (disp === TRIAGE_DISPOSITIONS.DROP) dropped.push(idea);
    else integrate.push(idea);
  }
  let writtenPath = null;
  if (grasscatcherPath && grasscatcher.length) writtenPath = appendGrasscatcher(grasscatcherPath, grasscatcher);
  log(`stage1 triage (batch): ${integrate.length} integrate · ${grasscatcher.length} → Grasscatcher · ${dropped.length} drop`);
  return { integrate, grasscatcher, dropped, batch: true, grasscatcherPath: writtenPath };
}

/** Append parked ideas to a GRASSCATCHER.md (creating it); returns the path. */
export function appendGrasscatcher(grasscatcherPath, parked) {
  const lines = ['', `## Stage-1 triage — parked (out-of-scope; revisit if the North Star is amended)`, ''];
  for (const idea of parked) {
    lines.push(`- ${idea.idea || idea.id || JSON.stringify(idea)}${idea.note ? ` — ${idea.note}` : ''}`);
  }
  const block = lines.join('\n') + '\n';
  fs.mkdirSync(path.dirname(path.resolve(grasscatcherPath)), { recursive: true });
  fs.appendFileSync(grasscatcherPath, block);
  return grasscatcherPath;
}

// ---------------------------------------------------------------------------
// (3) The phased plan — concrete near-term specifics + the rest deferred (§4.2).
// ---------------------------------------------------------------------------

/** A phased plan: each phase names its near-term specifics and what it DEFERS. */
export const PHASED_PLAN_SCHEMA = {
  type: 'object',
  required: ['phases'],
  properties: {
    summary: { type: 'string' },
    phases: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          rationale: { type: 'string' },
          nearTermSpecifics: { type: 'array', items: { type: 'string' } },
          deferred: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

function phasedPlanPrompt({ northStar, criteria, ideas, assumptions, premortem }) {
  return [
    `You are the Crucible STAGE-1 PHASED-PLAN step. Refine the INTEGRATED ideas into a`,
    `phased plan toward this North Star. Front-load CONCRETE near-term specifics — enough to`,
    `seed a Stage-2 implementation plan — and DEFER the rest EXPLICITLY (name what is deferred,`,
    `do not silently omit it). Every phase must serve a North-Star criterion (the inclusion test).`,
    ``,
    `=== THE NORTH STAR (verbatim) ===`,
    String(northStar),
    `=== END NORTH STAR ===`,
    criteria.length ? `\n=== SUCCESS CRITERIA ===\n${criteria.map((c, i) => `(${i + 1}) ${c}`).join('\n')}\n=== END CRITERIA ===` : '',
    ``,
    `=== INTEGRATED IDEAS (the plan absorbs THESE; Grasscatchered ideas are excluded) ===`,
    ideas.length ? ideas.map((d, i) => `(${i + 1}) ${d.idea || d.id}`).join('\n') : '(none)',
    `=== END INTEGRATED IDEAS ===`,
    ``,
    `=== PREMORTEM MITIGATIONS TO BUILD IN ===`,
    premortem.length ? premortem.map((f, i) => `(${i + 1}) ${f.mitigation || f.mode}`).join('\n') : '(none)',
    `=== END MITIGATIONS ===`,
    ``,
    `Emit: summary, phases [{name, rationale, nearTermSpecifics[], deferred[]}].`,
  ].join('\n');
}

/**
 * Build the phased Master Plan from the integrated ideas. HALTs (never silently
 * passes) if the pass yields no phases, or no near-term specifics at all — a phased
 * plan with nothing concrete cannot seed the Stage-2 implementation plan (§4.2).
 *
 * @param {object} o
 * @param {Function} o.agent
 * @param {string}   o.northStar
 * @param {string[]}[o.criteria=[]]
 * @param {object[]}[o.ideas=[]]          the INTEGRATED ideas (post-triage)
 * @param {object[]}[o.assumptions=[]]
 * @param {object[]}[o.premortem=[]]
 * @param {Function}[o.log=()=>{}]
 */
export async function buildPhasedPlan({ agent, northStar, criteria = [], ideas = [], assumptions = [], premortem = [], log = () => {} } = {}) {
  requireAgent(agent, 'buildPhasedPlan');
  if (!northStar) throw new HaltError('buildPhasedPlan requires a locked North Star', 'lock the North Star in Stage 0 first');
  const out = (await agent(phasedPlanPrompt({ northStar, criteria, ideas, assumptions, premortem }), { label: 'stage1:phased-plan', schema: PHASED_PLAN_SCHEMA })) || {};
  const phases = (Array.isArray(out.phases) ? out.phases : []).map((p) => ({
    name: p.name,
    rationale: p.rationale ?? '',
    nearTermSpecifics: Array.isArray(p.nearTermSpecifics) ? p.nearTermSpecifics : [],
    deferred: Array.isArray(p.deferred) ? p.deferred : [],
  }));
  if (!phases.length) throw haltForHuman('Stage-1 phased-plan pass produced no phases', 'rerun-phased-plan');
  if (!phases.some((p) => p.nearTermSpecifics.length)) {
    throw haltForHuman('Stage-1 phased plan has no near-term specifics to seed the implementation plan (§4.2)', 'rerun-phased-plan');
  }
  const plan = {
    northStar,
    criteria,
    summary: out.summary ?? '',
    phases,
    integratedIdeaCount: ideas.length,
  };
  log(`stage1 phased plan: ${phases.length} phase(s), ${phases.reduce((n, p) => n + p.nearTermSpecifics.length, 0)} near-term specific(s)`);
  return plan;
}

/** Render the phased plan to the markdown draft the Shark Tank reviews. */
export function renderMasterPlanDraft(plan) {
  const lines = [
    `# Master Plan (draft)`,
    '',
    `**North Star:** ${plan.northStar}`,
    '',
  ];
  if (plan.criteria?.length) {
    lines.push('## Success criteria', ...plan.criteria.map((c) => `- ${c}`), '');
  }
  if (plan.summary) lines.push(plan.summary, '');
  for (let i = 0; i < plan.phases.length; i++) {
    const p = plan.phases[i];
    lines.push(`## Phase ${i + 1} — ${p.name}`);
    if (p.rationale) lines.push('', p.rationale);
    if (p.nearTermSpecifics.length) lines.push('', '**Near-term specifics:**', ...p.nearTermSpecifics.map((s) => `- ${s}`));
    if (p.deferred.length) lines.push('', '**Deferred (explicitly):**', ...p.deferred.map((s) => `- ${s}`));
    lines.push('');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// (4) The Shark-Tank loop — sharkfood → fix → … until dry, then Judge + gate.
// ---------------------------------------------------------------------------

/** What the between-round draft revision returns (the "fix" step). */
const REVISE_SCHEMA = {
  type: 'object',
  properties: {
    draft: { type: 'string' },
    changelog: { type: 'array', items: { type: 'string' } },
  },
};

function revisePrompt({ northStar, draft, verdict, direction }) {
  return [
    `You are the Crucible STAGE-1 draft-revision step. Address the BLOCKING findings from the`,
    `last Shark Tank and the Synthesizer's direction, WITHOUT drifting from the North Star.`,
    `Return the revised Master-Plan draft in full.`,
    ``,
    `=== THE NORTH STAR (verbatim) ===`,
    String(northStar),
    `=== END NORTH STAR ===`,
    ``,
    `=== BLOCKING FINDINGS TO RESOLVE ===`,
    (verdict.blockers || []).length
      ? verdict.blockers.map((b, i) => `(${i + 1}) [${b.severity}] ${b.message || b.id}`).join('\n')
      : '(none — refine per the direction)',
    `=== END FINDINGS ===`,
    ``,
    `=== SYNTHESIZER DIRECTION ===`,
    direction ? `lean=${direction.lean}; press: ${direction.probingBrief || ''}` : '(none)',
    `=== END DIRECTION ===`,
    ``,
    `=== CURRENT DRAFT ===`,
    String(draft),
    `=== END DRAFT ===`,
    ``,
    `Emit: draft (the full revised draft), changelog (what you changed).`,
  ].join('\n');
}

async function reviseDraft({ agent, northStar, draft, verdict, direction, round, log }) {
  const out = (await agent(revisePrompt({ northStar, draft, verdict, direction }), { label: `stage1:revise:r${round}`, schema: REVISE_SCHEMA })) || {};
  const revised = typeof out.draft === 'string' && out.draft.trim() ? out.draft : draft;
  const changelog = Array.isArray(out.changelog) ? out.changelog : [];
  log(`stage1 revise r${round}: draft revised (${changelog.length} change(s))`);
  // 2026-07: the changelog is no longer discarded — the next round's Sharks get
  // it (with the blocker register) so refutation focuses on new ground.
  return { draft: revised, changelog };
}

/**
 * Drive the Shark-Tank refinement loop to a model-side convergence verdict.
 *
 * Each round: (optional) per-round researchPrime ONLY on a genuinely new candidate
 * (the Wave-5 cost-guard) → a Shark Tank (Wave 2) → the Synthesizer issues direction
 * (Wave 3, steers/never decides). A BLOCKED round triggers a draft "fix" and another
 * round. A DRY round triggers the lock checks: a fresh-eyes cold pass (a NEW, no-
 * context instance — Wave 3), the Judge's decision (Wave 3), and the convergence gate
 * (Wave 4). When the gate is model-side lockable the loop returns; otherwise it runs
 * one more challenge round. The round cap is a safety ceiling — hitting it HALTs.
 *
 * @param {object} o
 * @param {Function} o.agent
 * @param {string}   o.northStar
 * @param {string[]}[o.criteria=[]]
 * @param {string}   o.draft                          the initial Master-Plan draft
 * @param {?object} [o.research=null]                 the Wave-5 coordinator
 * @param {?object} [o.synthesizer=null]              an injected Synthesizer (else built here)
 * @param {?object} [o.judge=null]                    an injected Judge (else built here)
 * @param {?object} [o.routes=null]                   the run's role routes — lets the built Judge
 *                                                    stamp enhanced/cross_model from where the
 *                                                    judge role ACTUALLY dispatches (T7)
 * @param {string[]}[o.acceptanceCriteria=[]]         the Judge's oracle
 * @param {number}  [o.roundCap=5]                     §8 safety ceiling
 * @param {number}  [o.startRound=1]
 * @param {?string} [o.artifactsDir=null]             Shark-Tank round artifacts dir
 * @param {string}  [o.capPendingAction='stage1-round-cap']  the HALT's pending_action
 *                                                    (Stage 2 reuses this loop under
 *                                                    its own name)
 * @param {Function}[o.log=()=>{}]
 */
export async function runMasterPlanLoop({
  agent,
  northStar,
  criteria = [],
  draft,
  research = null,
  synthesizer = null,
  judge = null,
  routes = null,
  acceptanceCriteria = [],
  roundCap = 5,
  startRound = 1,
  artifactsDir = null,
  capPendingAction = 'stage1-round-cap',
  log = () => {},
} = {}) {
  requireAgent(agent, 'runMasterPlanLoop');
  const synth = synthesizer || makeSynthesizer({ agent, northStar, log });
  // T7 (2026-07-11): when the caller supplies the run's ROUTES, the Judge's
  // selection/stamp is DERIVED from where the judge role actually dispatches —
  // a route to a non-author family stamps enhanced/cross_model honestly.
  const jdg = judge || makeJudge({ agent, routes, log });

  let currentDraft = draft;
  let priorBlockerIds = [];
  let lastChangelog = null;   // the reviser's own changelog, fed to the next round's Sharks
  let directed = false;       // has the Director ever spoken? (anti-anchoring spine needs one position)
  const rounds = [];

  for (let round = startRound; round < startRound + roundCap; round++) {
    // Per-round research only on a genuinely NEW candidate (Wave-5 cost-guard).
    let analystBrief = null;
    if (research && typeof research.perRound === 'function') {
      await research.perRound({ candidate: currentDraft, round });
      analystBrief = research.forAnalyst ? research.forAnalyst() : null;
    }

    const verdict = await runSharkTank({
      agent, northStar, draft: currentDraft, round, priorBlockerIds,
      research: analystBrief, artifactsDir, log,
      changelog: lastChangelog && lastChangelog.length ? lastChangelog.join('\n') : null,
    });

    if (!verdict.dry) {
      // BLOCKED — the Synthesizer steers the revision (its one consumed output),
      // record the blockers (anti-oscillation), fix the draft, loop.
      const direction = await synth.direct({ round, verdict, research: research?.forSynthesizer?.() ?? null });
      directed = true;
      rounds.push({ round, verdict, direction });
      priorBlockerIds = [...new Set([...priorBlockerIds, ...verdict.blockers.map((b) => b.id)])];
      const rev = await reviseDraft({ agent, northStar, draft: currentDraft, verdict, direction, round, log });
      currentDraft = rev.draft;
      lastChangelog = rev.changelog;
      continue;
    }

    // DRY — T7/T11 (2026-07-11): the Synthesizer call is SKIPPED on a round that
    // locks — its direction is only ever consumed by the NEXT revision, so calling
    // it unconditionally wasted one guaranteed call per converging loop. Exception:
    // if the Director has never spoken (first-round-dry), take its single steer so
    // the anti-anchoring reconcile below compares against a real standing position.
    let direction = null;
    if (!directed) {
      direction = await synth.direct({ round, verdict, research: research?.forSynthesizer?.() ?? null });
      directed = true;
    }

    // Run the anti-anchoring fresh-eyes cold pass BEFORE the lock (Wave 3).
    const cold = await freshEyesColdPass({ agent, transcripts: verdict.reviews, northStar, log });
    const oracle = freshEyesIsolationOracle({ cold, directorSnapshot: synth.snapshot() });
    const reconcile = reconcileFreshEyes({ directorPosition: synth.position(), freshEyes: cold.assessment });

    // The Judge DECIDES from the injected evidence (Wave 3).
    const judgeVerdict = await jdg.decide({ northStar, findings: verdict.findings, acceptanceCriteria, freshEyes: cold.assessment, round });

    // The convergence gate (Wave 4): dry-round + Judge + drift + fresh-eyes (advisory-unless-BLOCKER, T7).
    const gate = evaluateConvergenceGate({ tally: verdict, judgeVerdict, freshEyes: cold.assessment, approved: false });
    rounds.push({ round, verdict, direction });
    if (gate.modelSideLockable) {
      log(`stage1 loop: model-side convergence at round ${round} (${rounds.length} round(s) run)`);
      return {
        converged: true,
        modelSideLockable: true,
        rounds,
        roundsRun: rounds.length,
        lastVerdict: verdict,
        draft: currentDraft,
        freshEyes: cold,
        oracle,
        reconcile,
        judgeVerdict,
        gate,
        synthesizerStamp: synth.stamp,
        judgeStamp: jdg.stamp,
      };
    }

    // Dry, but the Judge or a BLOCKER-bearing fresh-eyes pass held the lock —
    // run one more challenge round. The loop continues, so the Synthesizer's
    // steer IS consumed here: take it now if this round skipped it (T7/T11).
    log(`stage1 loop: dry round ${round} held (${gate.reasons.join('; ') || reconcile.reason}) — challenge round`);
    if (!direction) {
      direction = await synth.direct({ round, verdict, research: research?.forSynthesizer?.() ?? null });
      rounds[rounds.length - 1].direction = direction;
    }
    priorBlockerIds = [...new Set([...priorBlockerIds, ...verdict.blockers.map((b) => b.id)])];
    const rev = await reviseDraft({ agent, northStar, draft: currentDraft, verdict, direction, round, log });
    currentDraft = rev.draft;
    lastChangelog = rev.changelog;
  }

  // The cap is a safety ceiling, not a success condition — HALT to the user (§8).
  //
  // T5 (2026-07-11): the HALT no longer DISCARDS the run. The one full live run
  // (zombie-hunter, journal 0001) burned ~30 model calls into this cap and
  // emitted NOTHING — the user had to hand-stitch the emit path from exported
  // internals; the journal itself proposed this fix. The BEST DRAFT + the open
  // findings now (a) ride on the HaltError so the orchestrator/user always gets
  // them, and (b) are persisted to artifactsDir when one is set. The user stays
  // the convergence authority — this is still a HALT, never an auto-lock.
  const lastRound = rounds.length ? rounds[rounds.length - 1] : null;
  const openFindings = lastRound
    ? (lastRound.verdict.findings || []).filter((f) => !f.demoted)
    : [];
  const bestDraft = {
    draft: currentDraft,
    roundsRun: rounds.length,
    openFindings,
    priorBlockerIds,
    lastDirection: lastRound ? lastRound.direction : null,
  };
  if (artifactsDir) {
    try {
      fs.mkdirSync(artifactsDir, { recursive: true });
      fs.writeFileSync(path.join(artifactsDir, 'BEST-DRAFT.md'), String(currentDraft));
      fs.writeFileSync(path.join(artifactsDir, 'OPEN-FINDINGS.json'),
        JSON.stringify(openFindings, null, 2) + '\n');
      log(`loop cap: best draft + ${openFindings.length} open finding(s) persisted to ${artifactsDir}`);
    } catch (e) {
      log(`loop cap: could not persist best draft (${e.message}) — the HALT payload still carries it`);
    }
  }
  const err = haltForHuman(
    `hit the round cap (${roundCap}) without converging — the safety ceiling tripped; ` +
      `the best draft (${rounds.length} round(s) of refinement) and ${openFindings.length} open ` +
      `finding(s) are attached${artifactsDir ? ` and persisted to ${artifactsDir}` : ''} — nothing was discarded`,
    capPendingAction,
  );
  err.best_draft = bestDraft;
  throw err;
}

// ---------------------------------------------------------------------------
// (5) The user-approval HALT gate — the canonical stage1->stage2 boundary.
// ---------------------------------------------------------------------------

/**
 * The Stage-1 → Stage-2 approval gate. The user is the convergence authority: even a
 * model-side-converged Master Plan does NOT advance on its own. Without approval this
 * HALTs (reusing HALT_GATES['stage1->stage2'] = 'master-plan-approval', so this gate
 * and the engine's state-machine boundary name the SAME gate). With approval and a
 * model-side-lockable loop it returns the approved Master Plan.
 *
 * @param {object} o
 * @param {object}  o.loop                  the runMasterPlanLoop result
 * @param {object} [o.plan=null]            the structured phased plan (carried through)
 * @param {boolean}[o.approved=false]       the user's approval
 * @param {Function}[o.log=()=>{}]
 */
export function approveMasterPlan({ loop, plan = null, approved = false, log = () => {} } = {}) {
  if (!loop || !loop.modelSideLockable) {
    throw haltForHuman(
      'Stage 1 has not converged model-side — cannot approve the Master Plan yet',
      'stage1-not-converged',
    );
  }
  const gate = HALT_GATES['stage1->stage2'];
  if (!approved) {
    log('stage1: Master Plan converged model-side — HALT for the user to approve (the convergence authority)');
    throw haltForHuman(gate.reason, gate.name);
  }
  log('stage1: Master Plan APPROVED — ready for Stage 2');
  return {
    approved: true,
    gate: gate.name,
    masterPlan: loop.draft,
    plan,
    roundsRun: loop.roundsRun,
  };
}

// ---------------------------------------------------------------------------
// The Stage-1 orchestration — brainstorm → triage → phased plan → loop → approve.
// ---------------------------------------------------------------------------

/**
 * Run Stage 1 end-to-end. Requires a LOCKED North Star (the Stage-0 deliverable).
 * Brainstorms (assumption-map → premortem → ideate), batch-triages, builds the phased
 * plan from the integrated ideas, runs the Shark-Tank loop to model-side convergence,
 * then HALTs at the user-approval gate. With approval it returns the approved Master
 * Plan; without it (or on a blocking HALT inside the loop) it HALTs for the human.
 *
 * @param {object} o
 * @param {Function} o.agent                  the Wave-1 agent seam
 * @param {string}   o.northStar              the LOCKED North Star
 * @param {string[]}[o.criteria=[]]
 * @param {?object} [o.research=null]         the Wave-5 coordinator (research once up-front)
 * @param {string[]}[o.acceptanceCriteria=[]] the Judge's oracle
 * @param {boolean} [o.approved=false]        the user's Master-Plan approval
 * @param {number}  [o.roundCap=5]
 * @param {?string} [o.depth=null]            the user-CONFIRMED Stage-0 triage depth
 *                                            ('LITE' shrinks the default roundCap to 2;
 *                                            an explicit roundCap always wins)
 * @param {?string} [o.grasscatcherPath=null] where parked ideas are appended
 * @param {?string} [o.artifactsDir=null]     Shark-Tank round artifacts dir
 * @param {Function}[o.log=()=>{}]
 * @returns {Promise<{brainstorm:object, triage:object, plan:object, loop:object, approval:object}>}
 */
export async function runStage1({
  agent,
  northStar,
  criteria = [],
  research = null,
  acceptanceCriteria = [],
  approved = false,
  roundCap = undefined,
  depth = null,
  grasscatcherPath = null,
  artifactsDir = null,
  log = () => {},
} = {}) {
  requireAgent(agent, 'runStage1');
  if (!northStar) {
    throw new HaltError('runStage1 requires a locked North Star', 'Stage 1 starts from the Stage-0 North-Star lock');
  }
  // 2026-07: Stage-0's complexity triage finally has teeth. The depth arrives
  // USER-CONFIRMED (assessComplexity HALTs for confirmation — the documented
  // SKILL.md contract), so a LITE run shrinks the safety ceiling instead of
  // always paying the FULL 5-round cap. An explicitly passed roundCap wins.
  if (roundCap === undefined) {
    roundCap = String(depth || '').toUpperCase() === 'LITE' ? 2 : 5;
    if (depth) log(`stage1: depth=${depth} → roundCap=${roundCap}`);
  }

  // researchPrime ONCE up-front (idempotent; the Wave-5 cost-guard owns re-invocation).
  if (research && typeof research.upfront === 'function') {
    await research.upfront({ northStar });
  }
  const upfrontBrief = research?.forSynthesizer?.() ?? null;

  // (1) Oranges brainstorm in the mandatory order.
  const brainstorm = await runBrainstorm({ agent, northStar, criteria, research: upfrontBrief, log });

  // (2) Batch idea-triage — the plan absorbs ONLY the integrated bucket.
  const triage = triageIdeas({ ideas: brainstorm.ideas, grasscatcherPath, log });

  // (3) The phased plan from the integrated ideas.
  const plan = await buildPhasedPlan({
    agent, northStar, criteria,
    ideas: triage.integrate, assumptions: brainstorm.assumptions, premortem: brainstorm.premortem, log,
  });

  // (4) The Shark-Tank loop to model-side convergence.
  const loop = await runMasterPlanLoop({
    agent, northStar, criteria,
    draft: renderMasterPlanDraft(plan),
    research, acceptanceCriteria, roundCap, artifactsDir, log,
  });

  // (5) The user-approval HALT gate (master-plan-approval).
  const approval = approveMasterPlan({ loop, plan, approved, log });

  return { brainstorm, triage, plan, loop, approval };
}

// ---------------------------------------------------------------------------
// Shared guard.
// ---------------------------------------------------------------------------

function requireAgent(agent, who) {
  if (typeof agent !== 'function') {
    throw new HaltError(`${who} requires an agent() function`, `pass the Wave-1 seam: ${who}({ agent: makeAgentSeam(...).agent })`);
  }
}
