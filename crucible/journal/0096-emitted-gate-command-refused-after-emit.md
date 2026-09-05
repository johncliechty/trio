# 0096 — The well-formedness gate refused the plan's own test-command, after the doc-trio was emitted

**Date:** 2026-09-05 · **Run:** Anchor reports-links (LITE, elegance pass inside, Sharks on Grok)

## What happened

Stage 2 emitted the doc-trio + `foreman.config.json` to the handoff dir, then spawned Foreman's
`locate-plan.mjs` as the well-formedness gate. The gate HALTed (exit 3):

    pytest gate uses -q/--quiet — a gate the engine can NEVER pass as written

The `-q` came from the launcher's `testCommand` input (the steward's own habit), was copied verbatim
into the plan's `test-command:` line, and Foreman's rule (foreman-lib `preflightTestCommand`, 0082)
refuses `-q/--quiet` because the engine reads pytest's counts. So the HALT was correct and the
handoff was still usable after one edit — but two things were wrong on Crucible's side:

1. **The check ran after the emit.** The rule is Foreman's and is known at Stage 0. A `test-command`
   that the builder will refuse should be caught when it is INPUT (journal 0093 owed a pre-round
   gate-command check for the same class: `node --test test/` on Windows Node 26).
2. **The launcher exited 0 on the HALT.** `_run-crucible-lite.mjs` maps any HALT to exit 0 so a
   human-lockable Stage-1 exit is not an error; a blocked Stage-2 handoff reused that mapping.

## What the steward did

Stripped `-q` from the emitted plan's `test-command:`, re-ran `locate-plan` (3 waves parsed) and the
Foreman doctor (32 tests collected), then built.

## Owed (named, not built)

- Run Foreman's `preflightTestCommand` on the input `testCommand` at `runStage2` entry (and at Stage 0
  intake when a gate is named) and HALT there with the exact edit — before any Shark spend.
- Distinguish `human-lockable` (exit 0) from `handoff BLOCKED` (non-zero) in the launcher template.
