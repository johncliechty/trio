# DRAFT SYNTHESIS (to be adversarially attacked) — Foreman parallel-EXECUTE

## F-1 — Citation integrity
"Anthropic + Cognition both agree" = 2 GENUINELY INDEPENDENT origins (published ~same day Jun 13 2025, NO cross-citation, opposite priors). NOT a bandwagon at origin. BUT contains 0 OBSERVED parallel-code-writing data — both are opinion/principle. Ceiling = CORROBORATED-by-opinion, never OBSERVED.

## F-2 — The rule's wording over-generalizes
SKILL.md "coding is the least-parallelizable task" over-states the primaries. Anthropic actually: "most coding tasks involve FEWER truly parallelizable tasks than research" + "not yet great at coordinating" (capability-now, hedged comparative). The well-supported claim is NARROWER: parallel agents that MUTATE a SHARED, UNDER-SPECIFIED decision surface conflict. RECOMMEND: rewrite the rule to target shared-mutation-under-specification, not code-writing-in-general.

## F-3 — There IS a mechanically-checkable parallel-safe boundary
Convergent across build systems (Bazel hermeticity), agent vendors (Cognition/Claude Code worktrees), and literature: parallel-safe <=> every decision a unit makes is either (a) FROZEN upstream & shared identically, or (b) PRIVATE to that unit's isolated output, never read by a sibling. Gate conditions (ALL must hold):
1. Disjoint write-set (file/symbol ownership; static-checkable; default-deny on overlap).
2. No shared MUTABLE interface, or shared interfaces FROZEN before fan-out.
3. Hermetic isolation (per-unit worktree/sandbox) — converts silent corruption to detectable merge conflict.
4. Deterministic mechanical merge OR a strong automatic gate that picks the winner.

## F-4 — Branch ranking (evidence-weighted)
- Branch 2 CONCURRENT READ-ONLY REVIEWERS = BEST-supported, lowest risk. One change at wave-engine.mjs:859-863 (for-await -> Promise.all). Reviewers already independent + read-only (write nothing but findings). Cognition: "most multi-agent setups limited to read-only"; fresh-context reviewers report MORE effective. Multi-candidate FIX = best-of-N over the gate.
- Branch 1 PLAN-DECLARED-INDEPENDENT UNITS = SUPPORTED conditionally; needs the disjoint-write-set gate + worktree isolation + mechanical merge. Risk: an UNDECLARED implicit dependency (verify disjointness mechanically, don't trust the plan's word).
- Branch 3 SPECULATIVE FAN-OUT EXECUTE + keep gate-passer = SUPPORTED where the gate is a STRONG automatic verifier (OBSERVED: Large Language Monkeys arXiv:2407.21787 log-linear coverage scaling) BUT gated by gate-trust (weak/flaky gate selects a FALSE winner) + diminishing returns (keep N small, <=~10). Foreman already has a trusted orchestrator-run gate => unusually well-positioned.
- Branch 4 CROSS-WAVE PIPELINING = WEAKEST support; collides with the truth-gated-advance invariant (project-engine.mjs:272-277,347). Unsafe-by-default absent a frozen handoff contract.

## F-5 — Foreman is unusually well-positioned for BOUNDED parallelism
It already has: (a) a frozen plan with declared wave/section structure; (b) an orchestrator-run TRUSTED gate (the strong verifier best-of-N requires); (c) worktree-capable git hygiene; (d) configurable fan-out (REVIEWER_COUNT). Missing pieces: a disjoint-write-set checker + per-unit worktree isolation + a mechanical/reviewable merge step.

## RECOMMENDATION PRIORITY
1. Concurrent reviewers — immediate, evidence-blessed, ~one-line + ensure finding-tally is order-independent.
2. Plan-declarable "parallel-safe group" + disjoint-write-set gate + worktree isolation (branch 1).
3. Optional speculative fan-out for high-value/high-uncertainty waves, leveraging the existing trusted gate (branch 3).
4. Keep cross-wave pipelining OUT unless an explicit frozen handoff contract is declared.
5. Reword the SKILL.md topology rule from "don't parallelize code-writing" to "don't parallelize SHARED-MUTATION / under-specified-decision work; parallelize where write-sets are disjoint and contracts are frozen."
