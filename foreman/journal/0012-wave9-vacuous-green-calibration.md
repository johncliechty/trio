# 0012: Wave 9 vacuous-GREEN HALT - Execution privileges required for calibration

**Timestamp:** 2026-07-16T12:06Z
**Project:** researchPrime (Foreman build)
**Wave:** 9

**Issue:**
Foreman hit a `vacuous-GREEN HALT` on Wave 9. The agent made 0 file changes.
The `IMPLEMENTATION-PLAN.md` required the agent to replay golden runs and produce a signed-off shadow-diff report. The execute agent correctly realized it is strictly forbidden from running shell commands, tests, or executing code. It therefore could not replay the golden runs to generate the diffs, and since the diffs didn't exist, it could not tune the governor. It declared the wave BLOCKED.

**Resolution:**
The plan was amended to remove the requirement for the agent to *execute* the calibration pass. Wave 9's deliverables were rewritten to focus entirely on building and testing the calibration *tooling* (e.g., `bin/calibrate-shadow.mjs`) using mock data. The actual execution of this tool on real golden runs is deferred to a human operator after the build completes. The checkpoint was reset to `execute` and the run was resumed.
