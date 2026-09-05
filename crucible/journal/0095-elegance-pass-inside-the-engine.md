# 0095 — the Elegance / Rabbit-Catcher pass is inside the engine now: after the plan, after the decomposition, before the Sharks

**Date:** 2026-09-05
**Asked by John:** "take the journal on crucible and foreman and modify them so that there is an elegance pass and a rabbit catcher pass that are run after the crucible plan gets built (along with an adversarial review of these)". Decision (John, same day, on my recommendation): CUT verdicts BLOCK in Crucible.
**Closes:** journal 0094's owed item 1 ("the LITE band needs the battery at triage, not only at plan approval") and item 2 (the plan is judged element by element before the Shark round is paid for).

## What changed

- **One shared module, vendored with the drivers:** `drivers/elegance-pass.mjs` — `runRabbitCatcher` (the steering seat, role `synthesizer`, runs RC-1 … RC-G over an enumerated element list; every claimed need carries a provenance tag `user-ratified | record | proposer-written | none`; a KEEP whose only need is proposer-written is downgraded to HOLD; an unjudged element is HOLD, never a silent KEEP), `runRabbitCatcherAdversary` (the review seat, role `shark`, attacks the verdicts: a refuted CUT is restored to HOLD with the adversary's trigger, an attacked KEEP is demoted; MINOR disputes move nothing), `runElegancePass` (both, bounded: one call each, never recursive), `renderElegancePass` (the record; "nothing cut" is said aloud), and `runCriticalPathCheck` (RC-6 only, for round boundaries).
- **Crucible hooks (`bin/elegance-hooks.mjs`):** `elementsFromPlan` (every near-term specific, `P<phase>.<n>`), `applyVerdictsToPlan` (CUT → the phase's deferred list "(CUT by the elegance pass)"; HOLD → the specific annotated with its trigger), `elementsFromWaves` / `applyVerdictsToWaves` (`W<n>.<k>`; a wave whose every deliverable is cut is dropped), `runPlanElegancePass` (runs the pass, writes `ELEGANCE-PASS.md` + `elegance-pass.json` beside the stage artifacts), `elegancePassSection` (the verdict table appended to the Shark draft so the reviewers dispute the pass too — the adversarial review John asked for, using the round that already exists).
- **`runStage1`:** after the phased plan, before `runMasterPlanLoop`; **`runStage2`:** after `decomposeIntoWaves`, before hardening and the loop. Both take `provenance` (`{userRatified, records, proposerWritten}`); the default marks the criteria proposer-written, which is what they usually are. A pass failure is non-fatal and said aloud (the plan proceeds unchanged).

## What was cut from the design of the pass itself

A fourth stage; a per-skill copy; a new config surface; the battery text as a separate file (it is a constant with the canonical pointer, so the law and the engine cannot drift silently); a recursive pass over HOLD investigations.

## Tests

`drivers/test/elegance-pass.test.mjs` (6), `drivers/test/elegance-pass-rc6.test.mjs` (1), `crucible/test/elegance-hooks.test.mjs` (5); the Crucible suite 302/306 — the four reds are `test/agent.test.mjs` "Claude transport unavailable (missing_receipt)", pre-existing on committed HEAD.

## The first proof

The pass runs on its own first plan: the Anchor "reports clickable everywhere + a runnable deliverable link" effort (planning 2026-09-05), Crucible LITE with the pass inside.
