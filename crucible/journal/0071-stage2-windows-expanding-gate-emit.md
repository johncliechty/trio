---
id: 0071-stage2-windows-expanding-gate-emit
skill: crucible@2026-07-23
situation: sleep-0076-package-4-stage2-default-test-command-and-helper-emit
context: >
  Companion to Foreman 0076 package 4 / F053. Stage-2 previously defaulted (or fixtures
  used) bare `node --test test/`, which Windows Node hard-fails in Foreman preflight.
observation: >
  ## Landed

  - `DEFAULT_TEST_COMMAND = 'node scripts/run-all-tests.mjs'` (exported)
  - `RUN_ALL_TESTS_SCRIPT` canonical helper body
  - `writeDocTrio` always writes `scripts/run-all-tests.mjs` next to the doc-trio
  - stage2 + gates fixtures updated off bare `test/` form
  - Unit: stage2 render/writeDocTrio + gates well-formedness good-trio — green

  ## Residual

  - Historical plans still on bare `test/` need amend or helper drop-in (Foreman preflight still refuses)
  - Crucible full suite has pre-existing `reviseDraft` markdown-first fail (unrelated)

outcome: fixed
provenance: genuine-execution
---

# Stage-2 Windows-safe expanding gate emit

Handoffs from Crucible Stage-2 now ship a runnable expanding test helper so Foreman locate-plan preflight accepts the default test-command without per-wave plan amend for new `test/*.test.mjs` files.
