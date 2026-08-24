# 0091-ba815-stage2-lite-emit-via-writedoctrio-after-loop-death

- **id:** 0091-ba815-stage2-lite-emit-via-writedoctrio-after-loop-death
- **skill:** crucible@2026-08-16
- **situation:** Stage 2 (LITE) reaching its human-lockable HALT in a detached schtasks process, then
  the user approving AFTER the process has exited — emit must happen without the live loop object.
- **context:** BA 815 build plan, `C:\dev\MBA Teaching AI` — Stage 2 of the Session-1+2 artifact build.
- **observation:** (1) **The dead-loop emit path that works:** apply the approved fixes to
  `.crucible/BEST-DRAFT.md` as deterministic string transforms, then call `writeDocTrio` directly with
  the fixed plan text — hardening gate re-runs fail-closed at write, and the emit produces the full
  handoff (doc-trio + foreman.config.json + scripts/run-all-tests.mjs). `approved=true must emit`
  honored without resurrecting the loop. (2) **Stage-2 artifacts land in `<outputDir>/.crucible/`**,
  not `<outputDir>/` — the first tick found only HALT.json and nearly misread the stage as
  draftless. (3) The Sharks ran DRY both stages while single-Shark BLOCKER-severity findings piled up
  in OPEN-FINDINGS (4 in stage 2: wave-numbering collision, missing Track-P dependency on the cold
  rebuild, a user gate with no mechanical stop, a declared testCommand nothing creates — that last one
  is standing-rule 0088 violated by the engine's own draft, caught by its own Skeptic). The ≥2-agree
  bar makes them non-blocking, but 4-of-4 were real and all became approved amendments: on LITE runs
  with 2 sharks, agreement is structurally rare — **read OPEN-FINDINGS at every gate; DRY ≠ clean.**
  (4) Elegance held this time: the Stage-2 ask was accepted on the FIRST attempt using the
  decision-not-architecture format (Stage 1 took four).
- **outcome:** worked (approved + emitted; handoff at `planning/crucible/handoff/`)
- **provenance:** genuine-execution
