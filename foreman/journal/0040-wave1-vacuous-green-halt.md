---
skill: foreman
situation: Wave 1 passed the test gate with `assert.strictEqual(1, 1)`, but halted on `vacuous-GREEN` because `.gitignore` and `.foundry-build-lock.json` are not executable JS files, so V8 coverage cannot see them being exercised.
observation: The orchestrator requires tests to cover changed source files, or the wave must be explicitly tagged `[test-only]`.
outcome: friction - Added `[test-only]` to the Wave 1 title in the plan, reverted the uncommitted files, cleared the checkpoint, and restarted Foreman.
provenance: genuine-execution
---
