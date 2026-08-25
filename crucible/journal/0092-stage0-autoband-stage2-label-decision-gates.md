# 0092 — S-bundle: Stage-0 auto-band, Stage-2 label truth, decision-format gates, DRY≠clean promoted (2026-08-25)

Four John-ratified fixes (elegance card):

1. **`runStage0` now sizes the job ITSELF, first line of the run** (stage0.mjs): calls
   `assessComplexity` (the shared @foundry/triage wire), AUTO-APPLIES the band and announces
   it — never asks (the wire's confirm-halt is deliberately not thrown; a confirm question
   would be a fourth gate, Elegance rule 3). An unsizable intake defaults FULL **loudly**
   ("DEFAULTED — triage could not size"), closing 0087's silent-FULL tax. The `triage` result
   rides the Stage-0 return so launchers route stage1/stage2 depth from the engine's own
   sizing — never a second rubric (NS-01).
2. **Stage-2's approval prompt names what it locks** (verified R3 mislabel): the reused loop
   takes `artifactName` + `haltStagePrefix`; Stage-2 passes "the Implementation Plan
   (Stage 2)" / `stage2` — the user is no longer told they are locking the Master Plan.
   Regression caught by the suite and fixed in-session: stage2's approved:true force-emit
   catch recognized the OLD 'stage1-human-lockable' string; it now keys on the semantic
   `e.humanLockable` flag (string-matching a halt id broke once — don't do it again).
3. **Every gate reason speaks the decision format** (crucible-lib.mjs HALT_GATES + the
   human-lockable-approval branch): the decision, a recommendation with one line of why,
   and a one-word door — extending the pattern journal 0090/0091 proved (four attempts →
   first-attempt). Gate NAMES unchanged (pinned identifiers).
4. **DRY ≠ clean promoted out of journal 0091** into SKILL.md's standing rules AND into the
   human-lockable gate ask itself ("skim OPEN-FINDINGS.json; DRY does not mean clean") —
   rule 9: a correction that lives only in a journal has not been made.

Gate: `node --test "test/*.test.mjs"` → **305/305 pass** (was 304/305 mid-fix; the one
failure was my own regression, caught and closed). provenance: genuine-execution.
