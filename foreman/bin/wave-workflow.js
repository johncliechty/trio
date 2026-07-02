// wave-workflow.js — Foreman Phase 1: the PRODUCTION driver seam for the
// one-wave engine (the model-driven {execute, review, fix} steps).
//
// ---------------------------------------------------------------------------
// DESIGN FINDING (Phase 1, recorded in Foreman-Execution-Log.md as finding L):
//   The plan §2 says "single engine = the native Workflow tool." Building this
//   adapter surfaced that a Workflow-tool *script* has, by spec, "No filesystem
//   or Node.js API access." But the §5 orchestrator-run gate MUST (a) spawn the
//   discovered build+test command and (b) write a gate-artifact file that
//   sub-agents cannot write. Neither is possible inside a Workflow-tool script.
//   => The faithful realization of §5 keeps the ORCHESTRATOR + GATE + STATE in a
//      Node process (bin/wave-engine.mjs). The Workflow tool, if used at all, can
//      only drive the *model* steps (execute/review/fix) — never the gate. This
//      adapter therefore exposes those three steps behind an INJECTED `agent()`
//      function, so the Node orchestrator can call the model however it likes
//      (Workflow agent(), the Agent tool, or a scripted stand-in for tests).
//      Wiring a live agent end-to-end is Phase 2 work; Phase 1 ships the
//      deterministic orchestrator + the scripted driver, and this seam.
// ---------------------------------------------------------------------------
//
// This file is plain Node (NOT a Workflow-tool script): it has no top-level
// `agent()`/`parallel()` globals and does no I/O itself. `makeAgentDriver`
// returns a driver with the exact shape bin/wave-engine.mjs expects, given an
// injected async `agent(prompt, opts)` whose return contract matches Workflow's
// `agent()` (text by default; the validated object when a `schema` is passed).

import path from 'node:path';

// JSON Schema the REVIEW agent is forced to emit (mirrors the engine's finding
// shape). Passed to the injected agent() as opts.schema in production.
export const REVIEW_SCHEMA = {
  type: 'object',
  required: ['answerable', 'findings'],
  properties: {
    answerable: { enum: ['yes', 'no'] },
    note: { type: 'string' },
    // F3 (§6): when the frozen plan is wrong/incomplete for THIS wave (distinct
    // from `answerable: no` ambiguity), a reviewer may attach a concrete proposed
    // resolution — a PROPOSED DIFF to the plan doc + a rationale. The engine HALTs
    // with this in pending_action for one-click human approval; it is NEVER applied
    // autonomously.
    plan_amendment: {
      type: 'object',
      required: ['proposed_diff', 'rationale'],
      properties: {
        proposed_diff: { type: 'string' },
        rationale: { type: 'string' },
        target: { type: 'string' },
      },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'file', 'rule'],
        properties: {
          severity: { enum: ['BLOCKER', 'MAJOR', 'MINOR', 'NIT'] },
          file: { type: 'string' },
          line: { type: ['number', 'null'] },
          rule: { type: 'string' },
          message: { type: 'string' },
          repro: {
            type: 'object',
            properties: { command: { type: 'string' }, failing: { type: 'boolean' } },
          },
        },
      },
    },
  },
};

function executePrompt(ctx) {
  return [
    `You are the EXECUTE agent for Foreman wave ${ctx.wave.n} ("${ctx.wave.title}").`,
    `Project: ${ctx.projectDir}. Implement ONLY this wave's work as specified in the`,
    `frozen plan. Do not refactor outside the plan; do not weaken or delete tests.`,
    `Do NOT run any git commands, terminal commands, or tests yourself. The orchestrator`,
    `owns all testing and version control; strictly just edit the source files.`,
    `If the wave is not answerable from the frozen docs, say so explicitly.`,
  ].join(' ');
}

function reviewPrompt(ctx, gate) {
  return [
    `You are an INDEPENDENT, READ-ONLY reviewer (#${ctx.reviewerIndex}) for Foreman`,
    `wave ${ctx.wave.n}. Your job is to REFUTE, not to praise. The ground-truth gate`,
    `was run by the orchestrator; read ONLY its artifact at ${gate.artifact_path}`,
    `(exit ${gate.exit_code}, pass ${gate.tap.pass}/${gate.tap.tests}). Do NOT trust`,
    `any pasted "command output" in wave logs. Cite file:line or a failing repro`,
    `command+output for every finding. First answer answerable-from-frozen-docs:`,
    `yes/no with a cited plan line. If (and only if) a build-time discovery shows the`,
    `FROZEN plan is itself wrong/incomplete for this wave (an assumption falsified, an`,
    `API not behaving as assumed) — distinct from mere ambiguity — you MAY attach a`,
    `plan_amendment {proposed_diff, rationale}; the orchestrator will HALT for human`,
    `approval and will NEVER apply it autonomously.`,
  ].join(' ');
}

function fixPrompt(ctx, gate, findings) {
  return [
    `You are the FIX agent for Foreman wave ${ctx.wave.n}, fix iteration ${ctx.iteration}.`,
    `Close these findings without weakening tests: ${JSON.stringify(findings.map((f) => f.id))}.`,
    `The orchestrator gate is at ${gate.artifact_path}. Make the minimal change that`,
    `turns the gate GREEN; the orchestrator — not you — re-runs the gate to verify.`,
    `Do NOT run any git commands, terminal commands, or tests yourself. The orchestrator owns all testing and version control.`,
  ].join(' ');
}

/**
 * Build a model-driven driver from an injected `agent()` function.
 * @param {{agent: (prompt:string, opts?:object)=>Promise<any>}} deps
 * @returns {{execute:Function, review:Function, fix:Function}}
 */
export function makeAgentDriver({ agent }) {
  if (typeof agent !== 'function') throw new TypeError('makeAgentDriver requires an agent() function');
  return {
    // Each call carries its `role` so per-role model routing (CLAUDE_MODEL_<ROLE> /
    // TRIO_MODEL_<ROLE>, resolved inside the drivers) is reachable on the build path:
    // execute/fix pin to the strongest coder, review can fan out to another family.
    async execute(ctx) {
      const out = await agent(executePrompt(ctx), { label: `execute:w${ctx.wave.n}`, role: 'execute' });
      return { note: 'agent execute complete', raw: out };
    },
    async review(ctx, gate) {
      const out = await agent(reviewPrompt(ctx, gate), {
        label: `review:w${ctx.wave.n}#${ctx.reviewerIndex}`,
        schema: REVIEW_SCHEMA,
        role: 'review',
      });
      return {
        reviewer: `reviewer-${ctx.reviewerIndex}`,
        answerable: out?.answerable ?? 'yes',
        note: out?.note,
        // F3: forward a well-formed plan-amendment proposal (diff + rationale) so
        // the engine can raise the PLAN-AMENDMENT-PROPOSAL halt; absent otherwise.
        ...(out?.plan_amendment ? { plan_amendment: out.plan_amendment } : {}),
        // `claim` is intentionally absent: in production the judge reads only the
        // orchestrator gate, never reviewer prose, so there is nothing to forge.
        findings: Array.isArray(out?.findings) ? out.findings : [],
      };
    },
    async fix(ctx, gate, findings) {
      const out = await agent(fixPrompt(ctx, gate, findings), { label: `fix:w${ctx.wave.n}.${ctx.iteration}`, role: 'fix' });
      return { note: 'agent fix complete', raw: out };
    },
  };
}

export const _internals = { executePrompt, reviewPrompt, fixPrompt };
export default makeAgentDriver;
