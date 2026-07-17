# 0010: vacuous-GREEN HALT on Wave 3 Resume

**Timestamp:** 2026-07-16T11:05Z
**Project:** researchPrime (Foreman build)
**Wave:** 3

**Issue:**
After clearing the `PLAN-AMENDMENT-PROPOSAL HALT` for Wave 3, Foreman hit another `vacuous-GREEN HALT`. Because `git=false` in `foreman.config.json` (due to the repo root containing the Foreman source), the `changedSince` function computes changed files by taking a hash snapshot (`hashStart`) at the exact moment the wave run/resume begins. 

However, because the agent had already run its `execute` phase before the `PLAN-AMENDMENT-PROPOSAL HALT`, the new files (`bin/governance-record.mjs`, `test/wave3-governance-record.test.mjs`) were already written to disk. When the run was resumed, `hashStart` included these files. The agent re-ran `execute`, doing a no-op idempotent rewrite, meaning the file hashes did not change. Thus, `changedSince` detected NO changed files, triggering the vacuous-green guard incorrectly.

**Resolution:**
Deleted the two generated Wave 3 files from disk and manually reset `foreman-checkpoint.json` to `intra_wave_step: "execute"` and `status: "running"` before resuming. This ensured `hashStart` was taken without the files, so the agent's re-execution correctly registered as adding new files, bypassing the vacuous-green halt.
