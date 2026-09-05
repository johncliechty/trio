# 0093 — LITE run for literature-review relevance (journal 0010): the plan's own gate command was the one Foreman refuses

**Date:** 2026-09-04
**Effort:** C:\dev\Skill Foundry\planning\litreview-relevance-2026-09-04 (North Star, baseline, launcher, stage1/, stage2/, handoff/)
**Seats:** from the Anchor dashboard via `buildLiveCrucibleAgent` — synthesizer/default on ChatGPT (codex), Sharks and Judge on Claude. No hardcoded family.

## What happened

1. **Stage 1 (LITE, roundCap 1, 2 Sharks) ran 6 minutes end to end.** Brainstorm 6 ideas / 4 assumptions / 3 failure modes; triage integrated all 6; a 4-phase master plan with 24 near-term specifics; one Shark round was DRY (0 two-Shark blockers, 27 findings, 26 single-reviewer concerns kept in `OPEN-FINDINGS.json`); the fresh-eyes pass and the Judge leaned not-lockable, but the multi-Shark bar was met, so the loop HALTed **human-lockable** with the draft on disk. The launcher took the steward's call (John asked to "act on" the journal) and carried the BEST-DRAFT into Stage 2 — stamped in `stage1/MASTER-PLAN.md`.
2. **Stage 2 (LITE) decomposed 5 waves with Given/When/Then, the hardening gate PASSED (4 asserted properties, each with a mechanical gate), one Shark round, doc-trio emitted** — and the well-formedness gate **HALTed with exit 3**: Foreman's `locate-plan.mjs` refuses `node --test test/` as known-broken on Windows Node (non-recursive directory arg; journals foreman 0038/0039/0047/0076). The command came from the plan declaration, which came from the launcher's `testCommand`, which I copied from the July precedent without checking it against Foreman's rule.
3. **Fix:** `node --test test/index.mjs` (the skill's self-discovering entry) runs the full suite green in 18 s (463/463). The plan's `test-command:` line was repointed, the gate re-run by hand (`status OK`, 5 waves, gate command accepted), the doc-trio copied into the skill dir (the July docs there were superseded; git history keeps them) and Foreman launched.

## The lesson (mechanism, not instruction)

Crucible's Stage 2 accepts any `testCommand` and only discovers at the very end, after the Shark round is paid for, that Foreman will refuse it. The refusal rule lives in Foreman (`locate-plan.mjs`); Crucible should ask it BEFORE the round: run `locate-plan.mjs` (or its test-command check) on the declared command at Stage-2 entry and HALT early with the same message, or substitute the project's `test/index.mjs` when one exists. **Owed:** a pre-round gate-command check in `runStage2` (one spawn, seconds) — cheaper than the round it would save.

## Honesty notes

- The status-heartbeat's `Procs` row printed `synthesizer(claude)` while the routes had the synthesizer on `chatgpt-cli`; the Judge line said "same-model persona: claude" though the drafter was ChatGPT. The stamp text is derived from a default table, not from the routes that actually dispatched. **Owed:** derive both from `routes` (T7 already asks this of the Judge stamp).
- Human-lockable HALT taken as the steward's call: the 26 single-reviewer concerns are on disk for John's eyes; none met the two-reviewer bar. He can object.
