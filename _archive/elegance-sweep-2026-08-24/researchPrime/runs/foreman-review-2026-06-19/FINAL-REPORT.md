# researchPrime — Foreman parallel-development review (FINAL)
Date: 2026-06-19 · AXIS: where (if anywhere) should Foreman relax its no-parallel-EXECUTE rule?

## STAMPS
- Mode: **ENGINE-capable** (Node import probe GO; 28 trio symbols crossed: shark-tank/synthesizer/judge/enhanced/foreman-lib).
- Phase-3 governed loop executed via **real fresh-context sub-agents** applying the engine's governance rules: heterogeneous reviewers with **>=2-agree**, a **separate context-free Judge** that decides, **convergence-until-dry**. This is stronger isolation than in-process agent() role-play, but it is NOT the Node engine's in-process scoring path — stated honestly.
- ISOLATION: **real** (parallel-swarm host; each agent a genuinely separate model context).
- **cross_model: false** (single model substrate; no cross-model parity claimed). The word "parity" is not used.
- Convergence: **3 substantive rounds** (R1 ruling; R2 -> N-1 HOLDS; R3 -> N-2 WEAKENED, no new finding) -> CONVERGED.

## BOTTOM LINE
Your instinct ("parallel development where appropriate") is **half-right, and the boundary is sharper than the rule states.** The rule should be RE-WORDED and ONE concrete parallelization SHIPPED — but the core of the rule (no parallel code-WRITING) is **correct and, on this harness, over-determined**: it is right on conflict-safety AND right on economics, independently.

Two scarce resources, conflated by the original one-line rule:
1. **Conflict-safety** (write correctness) — parallel writers make conflicting *implicit* decisions on shared, under-specified decision surfaces.
2. **Quota topology** (the wall-clock win) — every model step (coder OR reviewer) draws from ONE Pro/Max subscription window; N parallel model agents serialize on quota and drain it N× faster. There is no live quota API to meter it (the engine says so itself, foreman-lib.mjs:418-423).

A relaxation must beat BOTH to win the AXIS. Write-parallelism fails both. That is why the rule holds.

## WHAT TO ACTUALLY CHANGE (ranked, honest)
1. **SHIP — concurrent read-only reviewers.** Replace the sequential reviewer loop (wave-engine.mjs:861-863 `for…await`) with `Promise.allSettled`. OBSERVED-safe: finding-merge `collectFindings` (:678-694) keys by content-stable id into a Map, agreement = reviewer-Set size -> order-independent by construction. ~5 lines. **Bank it as a LATENCY-tail win (saves the slowest reviewer's wall-clock), NOT a quota/throughput win** — the R reviewers still cost R× tokens from the one window.
2. **SHIP — reword the SKILL.md topology rule.** From "do not parallelize code-writing" to bite on the real hazard: *"No parallel agent may MUTATE a shared, under-specified decision surface."* Keep it an **UNCONDITIONAL bright line** (its Schelling-fence enforceability is itself a safety property) — do NOT turn it into a menu of "conditional/optional" relaxations.
3. **OPTIONAL / low priority — concurrent independent deterministic checks.** IF you add lint/typecheck steps, run gate ∥ lint ∥ typecheck concurrently (all read-only checkers -> disjoint-write trivially safe, off-quota). Payoff is the cheap tail behind the dominant test gate (Amdahl-limited).
4. **DO NOT SHIP — parallel/speculative EXECUTE, worktree+merge, fan-out-keep-gate-passer, cross-wave pipelining.** Each rejected on OBSERVED code grounds (below).

## WHY THE WRITE-PARALLEL BRANCHES FAIL (OBSERVED)
- **Disjoint-write-set is not a pre-execution GATE.** A write-set is an OUTPUT of execution; you only learn collisions AFTER running N agents. It is a post-hoc collision *detector*, not a precondition — and serial EXECUTE makes overlap structurally impossible for free.
- **The conflict is SEMANTIC, not file-level.** Two agents can write disjoint files yet conflict on a shared interface contract (one adds `grass_origin=""`, the other assumes `None`). A file-diff checker is blind. This codebase proves it: nearly every wave threads a shared record field / seed builder / fixture through ~4 files at once; one sequential builder making all those implicit choices IS the guarantee.
- **The gate is a BOOLEAN, not a ranker.** `judge` returns GO on `gate.green && no agreed BLOCKER`. Best-of-N (Large Language Monkeys, arXiv:2407.21787 — OBSERVED log-linear coverage scaling) needs a *ranker*; Foreman has a boolean. Two candidates that both pass tests can't be ranked -> fan-out silently commits arbitrary design drift, and it breaks the per-invocation test-immutability/anti-weakening baseline (single-author assumption).
- **No merge machinery exists.** `grep worktree bin/` = nothing. Git model is one linear branch, per-file staging (never `git add -A`), dirty-tree HALT, commit-only-on-GO, crash-reconcile assuming a single linear commit stream. Branch-1 parallelism needs worktree+branch-per-unit+merge+merge-HALT+RE-GATE-after-merge (the merged tree is a config no sub-agent produced and no gate verified). It RELOCATES conflict to merge time, not removes it.
- **Economics dominate before correctness even enters.** Single per-subscription window (~1-3 waves/window calibrated), no pre-flight quota gate. N writers can't beat a per-subscription window with threads.

## CITATION INTEGRITY (the thing you were skeptical about)
- "Anthropic + Cognition both agree" = **2 genuinely independent origins** (published ~Jun 13 2025, NO cross-citation, opposite priors — Anthropic pro-multi-agent, Cognition anti). NOT a bandwagon at origin. (Mild caution: both are frontier vendors; but Cognition argues AGAINST parallelism, which breaks the "sell more invocations" incentive story.)
- BUT **0 OBSERVED parallel-code-writing data** in either — both are opinion/principle. Ceiling = CORROBORATED-by-opinion.
- The SKILL.md wording **over-generalizes**: Anthropic actually says "most coding tasks involve FEWER truly parallelizable tasks than research" + "not yet great at coordinating" (hedged comparative + capability-now), and it CITES Anthropic — a parallelism ADVOCATE (its own system is parallel on read-only research, 90% time cut) — as if an anti-parallel witness. The well-supported claim is narrower (shared-mutation), which is exactly the reword in #2.

## THE BOUNDARY, STATED CLEANLY (the AXIS answer)
The mechanically-checkable line is NOT "read vs write" — it is **"draws from the model window vs deterministic-local."** Three classes:
- (a) model-driven write-parallel -> fails conflict-safety AND quota. Rejected.
- (b) model-driven read reviewers -> safe by construction (no write-set), but quota-bound -> concurrency buys only the latency tail. = recommendation #1.
- (c) deterministic non-LLM work (test gate, git, lint, codegen) -> off quota, write-set knowable ex-ante -> the only ADDITIVE-wall-clock class. BUT the headline win (parallel test execution) already lives INSIDE the project's test runner; Foreman shells out one opaque `spawnSync(testCommand)` and correctly does not try to re-own it. So class (c)'s practical residue for Foreman is only the cheap checker-tail (#3).

## NET
Foreman should stay single-threaded for ALL write work — the rule is sound. Ship concurrent reviewers (latency win) + the reword (accuracy + keep the bright line). Everything else labeled "parallel development" is, on this harness, either unsafe, un-gateable, already-captured upstream, or economically dominated by the single subscription window.

---
## ROUND HISTORY
- Phase 2 (3 isolated gatherers): local cited-source + code map; primary-origin verification; external-systems survey. Ledgers A/B/C in run-dir.
- R1: 2 heterogeneous refuters + context-free Judge. F-3 OVERTURNED as a gate; Branch 1 OUT; Branch 3 TRAP; concurrent-reviewers conflict resolved by OBSERVED code (R2 > R1). New finding N-1.
- R2: N-1 (quota topology) HOLDS, OBSERVED-grade. New finding N-2 (boundary = model-window vs deterministic-local).
- R3: N-2 WEAKENED (deterministic win already captured by the test runner). CONVERGED — no new AXIS finding.
