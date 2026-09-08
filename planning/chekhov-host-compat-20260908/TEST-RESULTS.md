# Evaluation — 2026-09-08

Untouched source: commit a90deae in C:/dev/trio-chekhov-baseline-20260908 (detached worktree). Candidate: the same commit plus only this cycle's four implementation/test files in C:/dev/trio, branch fix/chekhov-codex-host-compat-20260908.

Both were run with the full package test command covering crucible/test, foreman/test, tools/test, drivers/test and researchPrime/test. No test name exclusions, new skips or weakened assertions.

| Run | Tests | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: | ---: |
| Untouched HEAD | 999 | 986 | 8 | 5 |
| Candidate | 1004 | 991 | 8 | 5 |

The failure identities are identical. Five added tests pass. Existing failure classes: four Crucible stub transports have no required receipts; Foreman's seat-last-words test imports a side-effectful CLI; researchPrime's nested Crucible-green assertion reports those same four failures; gate-inventory expects five obsolete names; publish scrub flags pre-existing personal-path journal records and an existing prompt example. See baseline-full-test.log and final-full-test.log for the complete output. The candidate's initial extra synthetic-credential scrub finding was removed by adopting the suite's existing dummy `secret` literal; the credential-scrub assertion itself remains unchanged.

Result: no regression observed across the full suite; the full repository is still RED from the eight reproduced baseline failures. This does not claim publish readiness or repair those unrelated failures. The sleep runbook's regression condition is satisfied differentially (no new failure); promotion still requires Grok's actual-patch review. Do not relabel the full suite as GREEN.
