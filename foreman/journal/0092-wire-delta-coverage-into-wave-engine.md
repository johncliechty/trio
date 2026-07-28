# 0092 — Wire delta-coverage-gate into the wave GO path (dogfood of 0091)

- **id**: 0092-wire-delta-coverage-into-wave-engine
- **date**: 2026-07-27
- **situation**: Journal 0091 defined `checkDeltaCoverage` after the steward shipped
  surfaces with zero tests. The module and unit tests existed; `wave-engine.mjs`
  never called it — so a wave could still GO with new routes/CLI/persist paths
  and no test naming them, as long as the suite stayed green.
- **why**: Same class as crucible 0080/0081 — law written, not enforced. Steward
  tracking Foreman handoff is the first real build after 0091; the gate must fire
  on the live GO path.
- **action**: After vacuous-GREEN passes and before finishGo, run
  `checkDeltaCoverage` on the wave's changed files + test file text; write
  `.foreman/wave-N-delta-coverage.json`; HALT with journal-0091 recommend text
  when surfaces are uncovered. Soft-skip only on unexpected throw (never silent
  suppress of a real fail).
- **outcome**: wired (2026-07-27 dogfood alongside crucible 0081)
- **provenance**: genuine-execution
