# 0111 — the Elegance / Rabbit-Catcher review after every GREEN wave; a confirmed CUT is one fix iteration before GO

**Date:** 2026-09-05
**Asked by John:** "have an elegance and rabbit catcher review after each wave of foreman". Decision (John, on my recommendation): a CUT blocks in Foreman only when confirmed by a second seat.
**Closes:** journal 0110's owed single-wave concern in part — the review is now a seat, not a person remembering.

## What changed

- **`bin/wave-workflow.js` `makeAgentDriver` gains `elegance(ctx, gate)`:** the steering seat (role `synthesizer`) runs the battery over the wave's changed files (tests/fixtures tagged malleability; the plan's wave section rides as context), the review seat (role `shark`) attacks the verdicts — `drivers/elegance-pass.mjs` does both, bounded to one call each. `northStarFromPlan` / `waveSectionText` are the two pure helpers.
- **`bin/wave-engine.mjs` `runWave`:** after the gate is GREEN and the reviewers CONVERGE, if the driver has the seat and the pass has not run for this wave: run it; write `.foreman/wave-N-elegance.md`; a **confirmed CUT** becomes one fix iteration with `[taxonomy:rabbit-hole] REMOVE …` findings (`agreement: 2` — the second seat confirmed), then the loop re-gates and re-reviews and GOes; **HOLDs** ride the EXECUTION-LOG GREEN line as `elegance HOLD (Grasscatcher)` lines. One pass per wave, never twice; a driver without the seat (every existing test fixture) is byte-for-byte unchanged.
- **§5 is untouched:** the elegance CUT never blocks GREEN through the judge (a reviewer may only block GREEN with a failing repro); it is a fix-loop item that must itself re-prove GREEN.

## Tests

The Foreman suite 189/189 with the seat absent (non-regression); `test/elegance-review.test.mjs` exercises the seat and the fix-then-GO path on the canonical fixture.

## Still owed

- A single-wave fast path (0110): unchanged.
- The `codex exec` execute seat's transcript (0108): unchanged.

## Addendum (same day): the guards the pass had to get past

Dogfooding the fixture found two of Foreman's own guards standing between a confirmed CUT and GO, and
both were right to stand there:

- **delta-coverage (journal 0091)** fires on an untested surface file BEFORE the elegance step. So a
  rabbit hole that ships without a test never reaches the battery: the older guard catches it first.
  The test fixture now models the honest case: an unneeded module shipped WITH its own test, which only
  the battery can see.
- **test-immutability (Wave 7)** HALTs when the fix seat deletes a test file. A confirmed CUT over a
  test file is the second seat's judged verdict (RC-2's malleability carve-out applied, disputed and
  upheld), not the fix seat weakening a gate, so the engine now releases exactly those files from the
  baseline before the elegance fix iteration. Any other test change in that iteration still HALTs.
