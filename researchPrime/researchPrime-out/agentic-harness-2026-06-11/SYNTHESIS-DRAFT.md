# SYNTHESIS DRAFT (under adversarial review) — Next-gen GWL harness orchestration layer

The next GWL harness = an **orchestration layer ABOVE** the reason→act→observe loop. Six components,
each grounded in the lane evidence, each fitted to GWL's invariants (one cache-stable model/loop;
spawn-budget/child-ledger/depth-guard/forget-boundary; pluggable t2rs Taste→Reason→Summary brain).

## C1 — PLAN layer (Taste-gated · list-shaped · externally-persisted · Summary-reconciled)
- Plan-first is **gated by complexity** — the **Taste** stage decides *whether* to plan (cheap turns skip it). [Anthropic effort-scaling; "don't always plan" arXiv:2509.03581; Claude "3+ actions" trigger]
- The plan is a **tool the in-loop model emits** (TodoWrite / Codex `update_plan` / the new `TaskCreate` w/ dependency edges) — **NOT a separate planner model** (a pre-call would break one-cache-stable-model-per-loop).
- **Persisted as an external artifact** (Anthropic Memory-plan / Codex `PLANS.md` living doc) with **observable acceptance criteria** + decision log — kept **OUT of the cache prefix** (mutable plan in a tail/file, so status flips don't bust the cache). This is the load-bearing cache move.
- The **Summary** stage reconciles plan-vs-reality each observe (anti-drift); replan on a **budget** (~every 1–3 steps, hard floor ~6).
- AVOID: a separate planner LLM (cache-bust); a DAG executor (brittle vs the single-model loop).

## C2 — CLARIFICATION gate
- A **branch on the reason output** `{action: ASK|PROCEED}` (no second model → cache-safe), mirroring the UA "Intent Agent". ASK only when **underspecified OR next action irreversible OR calibrated-uncertain**; cap **1–3 branch-eliminating** questions; default PROCEED-with-stated-assumptions when pre-approved. [Ask-or-Assume arXiv:2603.26233; practitioner UX consensus]
- Plus an **irreversible-tool approval gate at the act boundary** (OpenAI `needs_approval`, sticky approvals), independent of the intent gate. [OpenAI Agents SDK]

## C3 — PROGRESS narration
- **One compressed status line per observe** ("ran tests: 3 failing in payments/"), never the raw tool transcript. The **forget-boundary is the compression seam**; add a thrashing guard (stop compacting if it doesn't reclaim room). [Claude Code sub-agent summary discipline + the 2.0.77 leak regression; Devin follow-along]

## C4 — MID-RUN interjection / steering
- A **tagged priority steering queue** (distinct from a next conversational turn — the exact gap Claude Code users file), **drained only at the reason-phase boundary** (between observe N and reason N+1), **NEVER mid-tool-call**. Hard-`Esc` cancels **read-only** tools immediately; side-effecting tools finish then the steer applies. [Claude Code Esc vs Enter; LangGraph interrupt]
- **Snapshot state to the ledger before any pause**; keep pre-pause work idempotent (LangGraph re-runs the node on resume); ≤1 pause boundary per atomic step.

## C5 — MULTI-SUBAGENT orchestration (grasscatcher #5)
- **Supervisor / orchestrator-worker, single-writer.** The **research→plan→build trio = a sequential pipeline**: research = **parallel-READ fan-out** (multi-agent OK; Anthropic's proven win), plan = **single agent** consuming aggregated research, build = **single-threaded linear agent** (Cognition; Anthropic concedes coding).
- **Decision rule (CORROBORATED, 3 primaries):** parallelize READ / breadth-first / context-overflow / independent directions; keep dependent WRITES single-threaded. **Never parallel code-writing** (conflicting implicit decisions).
- Children = `claude -p --bare --output-format json`; feed `total_cost_usd` into the **child-ledger**; **spawn-budget** = the "no 50 subagents" cap; **depth-guard** = max-depth 1; **forget-boundary** = each child gets clean plan-only context. Subtasks must be **fully specified** (objective + output format + boundaries). Supervisor **reads all child JSON then writes** the synthesis itself.
- Budget note: after 2026-06-15 `claude -p` draws a separate Agent-SDK credit pool on subscription — ledger should track it distinctly.

## C6 — Externally-grounded VERIFICATION + REPLANNING (supporting)
- Add a **verify worker** (gated, ≤1/turn, hosted like the existing Observe worker) that runs **GROUND-TRUTH checks** (run the test command, execute code, re-read the claimed file) — **NOT self-critique** (intrinsic self-correction doesn't help and can hurt; external grounding is the load-bearing ingredient). [Huang 2310.01798; CRITIC 2305.11738; Reflexion; Anthropic evaluator-optimizer]
- **Replanning triggers** from existing guard signals → **outer-loop strategy reset** (not step retry): repeat-call guard fires; verify fails twice on a sub-goal; provenance/unknown-tool guard fires. Hard wallet/step caps remain the backstop.
- **Long-term memory: DEFER + GUARD.** Raw episodic recall into the live loop is a poisoning/context-rot vector; the current "running summary in tail, no persisted recall" is the safer posture until provenance-tag + temporal-decay + trust-weighted-retrieval mitigations exist.

## Phased build proposal
- **G1 (human-facing orchestration; low risk, high value):** C1 plan layer + C2 clarification + C3 progress narration.
- **G2:** C4 mid-run steering queue.
- **G3:** C5 multi-subagent (supervisor + research→plan→build, read-parallel / write-serial) — grasscatcher #5.
- **G4:** C6 externally-grounded verification + replanning triggers.
- **Deferred/guarded:** long-term memory.

## Top things to AVOID (consolidated)
separate planner model (cache-bust) · DAG executor · parallel code-writing (Anthropic+Cognition agree) ·
self-critique "verification theater" (hurts) · raw long-term memory (poisoning) · classifier-only guards
(17% false-negative — keep hard deny-lists) · self-assessed termination.
