# researchPrime PLAN (frozen) — Agentic system structure beyond the ReAct loop

## AXIS (load-bearing win-condition)
A best-practices synthesis that yields **concrete, correct, buildable** recommendations for the
next GWL harness generation — the orchestration layer ABOVE the raw reason→act→observe loop.
**Falsifier:** any recommendation that (a) contradicts how a cited real system actually works,
(b) ignores a documented failure mode (e.g. recommends parallelizing code-writing, which both
Cognition and Anthropic warn against), or (c) is un-buildable on the GWL substrate (one
cache-stable model per loop; spawn-budget/child-ledger/depth-guard/forget-boundary primitives).

## Stakes VECTOR
- **Impact:** HIGH — steers the next major build (the richer harness; grasscatcher #5).
- **Reversibility:** MEDIUM — the research is a doc (reversible), but it directs expensive build work.
- **Blast-radius:** the whole next GWL phase (orchestration layer + multi-subagent).
- → **Governor tier: HIGH** (full adversarial loop; user explicitly requested it).

## Candidate branches (the 6 investigation lanes)
1. **Up-front PLANNING** — plan-and-execute vs ReAct vs plan-and-solve; TodoWrite; Devin planning; LangGraph plan-execute; plan representation/revision/drift control.
2. **CLARIFICATION** — when/how agents pause to ask the user; pre-plan vs pre-irreversible-step; protocol/UX.
3. **PROGRESS communication** — streaming brief step summaries/narration without dumping transcripts.
4. **MID-EXECUTION steering / interjection** — interrupt-and-amend, steering queues, safe incorporation.
5. **MULTI-SUBAGENT orchestration** — headless `-p` spawn, swarms, supervisor/worker, research→plan→build trio, parallel fan-out, context isolation, budgets, aggregation; when multi-agent HELPS vs HURTS.
6. **SUPPORTING components** — verification/critique passes, memory, guards/permission-gating, replanning triggers, termination/escalation criteria.

## Best-in-class baselines to beat / benchmark against
Claude Code / Cowork (TodoWrite, plan mode, sub-agents, hooks, headless `-p`); Cognition/Devin
(context-engineering essays; "don't parallelize coding"); Anthropic multi-agent research system
(orchestrator-worker blog); OpenAI Agents SDK (handoffs, guardrails, sessions); LangGraph
(plan-execute, human-in-the-loop interrupts/checkpointers); AutoGen/AG2; CrewAI; Cursor; Aider;
papers: ReAct, Reflexion, Plan-and-Solve, Plan-and-Execute, Tree-of-Thoughts (as relevant).

## Oranges foresight receipt (required)
- **Dropped branch:** deep agent-EVALUATION/benchmark methodology (SWE-bench scoring, etc.).
  *Counterfactual cost:* recommendations are design/structure-level, NOT empirically ranked by
  benchmark — acceptable because the question is about CONTROL-FLOW/STRUCTURE, not "which model wins."
- **Reordered:** prioritized lanes #5 (multi-subagent) + #1 (planning) — the user's stated near-term
  build (grasscatcher #5) — ahead of #3 (progress UX, more polish). *Counterfactual cost:* if the
  next build turns out to be UX-first, #3 evidence is thinner; mitigated by still covering it.

## Expected winner
NONE named (per protocol). Evidence decides.

## Isolation
Execution sub-agents are spawned context-isolated via the Agent tool (real forget); each derives
its lane only from this frozen plan's quoted lane spec. ISOLATION: real (sub-agent host).
