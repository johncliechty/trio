# CONVERGENCE ROUND 2 — N-1 stress-test -> N-2

## N-1: HOLDS (OBSERVED-grade)
- EXECUTE/REVIEW/FIX all dispatch through the SAME injected agent() (wave-workflow.js:100/104/118) -> live runner runClaude/spawnGuarded {command:'claude'} (run-live.mjs), CLAUDE_ARGS has NO --model -> subscription session default. Reviewers draw the IDENTICAL window as coders.
- No escape as built: TRIO_DRIVER selects a different VENDOR not a cheaper Claude tier; gemini driver supports per-role TRIO_MODEL_<ROLE> but makeAgentDriver passes NO role; Claude driver ignores role/model. Engine self-comment foreman-lib.mjs:418-423: "§7's real binding limit is the Pro USAGE WINDOW... no live quota API... cannot read the window directly." Single-window serialization unavoidable.
- Residual value of concurrent reviewers (made precise): does NOT save quota/compute (R reviewers = R× token draw either way); WOULD save only the OVERLAPPABLE LATENCY TAIL (spawn/startup + file-read round-trips + network/inference latency) of R read-only calls within one shared budget. Engine currently FORFEITS even that (sequential await loop wave-engine.mjs:861-863; no Promise.all anywhere). Buys latency, never quota.

## N-2 (new AXIS finding): the boundary is "model-window vs deterministic-local", not "read vs write"
Two orthogonal scarce resources, conflated by prior rounds: conflict-safety governs WRITE CORRECTNESS; quota-topology governs the WALL-CLOCK win INDEPENDENTLY. Three classes:
(a) model-driven write-parallel -> fails BOTH (conflict-unsafe AND quota-bound). Rejected.
(b) model-driven read-parallel reviewers -> conflict-safe by construction but quota-bound -> concurrency buys only the latency tail, small; engine doesn't even claim it.
(c) DETERMINISTIC non-LLM write work (the GATE runGate=spawnSync wave-engine.mjs:548-557, git hygiene, checkpoint writes, codegen/templates, linters) -> OFF the quota path entirely -> the ONLY class where parallelism yields genuinely ADDITIVE wall-clock, gated purely by the mechanically-checkable disjoint-write-set rule (and for DETERMINISTIC work the write-set IS knowable ex-ante, unlike LLM agents).
=> mechanically-checkable boundary = "draws from the model window vs deterministic-local"; the latter is where real wall-clock lives.

## Status: NOT converged (N-2 emerged) -> run round 3 to stress-test N-2.
