# FROZEN PLAN — Foreman parallel-EXECUTE review (researchPrime, 2026-06-19)

## AXIS
Under what conditions, if any, should Foreman relax its single-threaded EXECUTE
topology to permit parallel code-writing — and where is the boundary between
"safe to parallelize" and "conflicting implicit decisions"?

- WINS if it identifies a concretely-bounded class of work where parallel execution
  provably reduces wall-clock WITHOUT raising conflicting-implicit-decision risk,
  AND the boundary is mechanically checkable (gateable, not guessed).
- FALSIFIED if the parallel-safe zone still needs shared implicit design decisions,
  OR merge/coordination/review cost >= wall-clock saved, OR it can't be a no-guess gate.

## Stakes: HIGH (load-bearing rule; wide blast radius; motivated-reasoning hazard — requester wants parallelism allowed).

## Candidate branches (no winner named)
1. Decompose-by-the-plan: parallelize only plan-declared-independent units (separate files, no shared interface decision).
2. Parallelize non-EXECUTE phases (REVIEW reviewers concurrent; multi-candidate FIX; independent gate suites).
3. Speculative fan-out EXECUTE + merge-gate (N coders same wave, keep the gate-passer).
4. Cross-wave pipelining (prep wave N+1 independent work during wave N review).
5. Keep the rule; improve elsewhere (live-calibration gap, gate/doc hardening).

## Baselines to beat / verify at origin
The rule's own cited authority — Anthropic multi-agent post + Cognition "Don't Build Multi-Agents"
(VERIFY at primary origin; check for shared lineage / bandwagon), plus real parallel-build & coding-agent systems.

## Ledger ladder: OBSERVED > CORROBORATED > CLAIMED > UNVERIFIED > REFUTED. Count origins only as independent.
