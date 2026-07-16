---
id: 0003
skill: foreman
situation: Secondary fix loop test immutability violation during Wave 1 of zombie-hunter build.
context: After resolving the first test immutability violation (0002), the Foreman fix agent attempted to resolve the remaining test failures.
observation: The fix agent again violated the test immutability protocol by adding `test/package.json` during the FIX phase, presumably to modify test dependencies or environment. Foreman correctly detected this modification and halted.
outcome: friction
provenance: genuine-execution
---

### Resolution
1. Deleted the unauthorized `test/package.json` file.
2. Cleared the orchestrator halt flag via `checkpoint.mjs clear`.
3. Restarted the Foreman build so the fix loop is forced to resolve the issue using only implementation source code.
