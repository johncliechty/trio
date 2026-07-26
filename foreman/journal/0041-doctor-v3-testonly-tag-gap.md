# 0041 — doctor-v3: [test-only] tag does not satisfy the vacuous-GREEN guard

- **id:** 0041-doctor-v3-testonly-tag-gap
- **skill:** foreman
- **situation:** Anchor Doctor UI V3 rebuild (C:\dev\anchor-doctor-v3-build worktree), 4 waves, all-Claude seats, gate `pytest tests/test_doctor_v3.py`.
- **context:** Wave 4 was a verification wave by design: +5 new tests (inventory 37→42) + doc artifacts (dist_manifest.txt, EXECUTION-LOG.md), zero product code. Gate GREEN 42/42, full panel 0 findings — three consecutive times.
- **observation:** The vacuous-GREEN guard halted all three times, including AFTER tagging the wave heading `## Wave 4 [test-only]` (the documented escape hatch). The guard's changed-file list never counts the test file as a proving artifact, and the doc/data artifacts alongside it appear to disqualify the test-only path. clear-halt cannot persist a human confirmation, so the run loops deterministically into the same halt. Resolution: human-confirmed manually — committed wave 4 outside the engine with the confirmation recorded in the commit message, then merged.
- **outcome:** friction — build shipped (merged e6c5a44, deployed, live-verified), but the last wave needed a manual commit. Engine gap: either the [test-only] path should tolerate accompanying doc/data artifacts when inventory rose and the gate ran the full declared suite, or clear-halt needs a `--confirm-docs-only` that persists.
- **provenance:** genuine-execution
