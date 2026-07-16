---
id: 0002
skill: foreman
situation: Fix loop test immutability violation during Wave 1 of zombie-hunter build.
context: The Foreman fix agent (claude-fable-5) was attempting to resolve test failures from the execution phase of Wave 1.
observation: The fix agent violated the test immutability protocol by adding a new test file (`test/index.js`) during the FIX phase. Foreman correctly detected this modification, flagged it as a "test-immutability HALT", and aborted the run.
outcome: friction
provenance: genuine-execution
---

### Resolution
1. Reverted the test modification by deleting the newly added `test/index.js` file, ensuring the original EXECUTE tests remain the untampered ground truth.
2. Cleared the orchestrator halt flag via `checkpoint.mjs clear`.
3. Restarted the Foreman build to allow the fix loop to attempt a valid resolution exclusively on the implementation source code.
