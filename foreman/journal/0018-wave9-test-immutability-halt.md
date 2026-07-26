---
id: 0018
skill: foreman
situation: Foreman Wave 9 encountered a test-immutability HALT because the FIX agent added a test file during a fix iteration.
context: The Claude agent was on `FIX (iter 2)` for Wave 9, trying to resolve 2 failing tests. Instead of modifying the source code to make the tests pass, it attempted to add a new test file (`bundle_staging/test/pinning/fs_shim.mjs`), which triggered the orchestrator's strict test-immutability guard.
observation: This demonstrates Foreman's test-immutability guard in action. The `FIX` loop is strictly prohibited from modifying or adding test files. Tests are the locked deliverable of the `EXECUTE` stage and act as the unforgeable ground-truth gate. If a `FIX` agent tries to cheat by changing the tests, the orchestrator immediately catches it and halts the run.
outcome: friction -> resolved. The driving agent deleted the illegally added test file to restore test immutability and resumed the run, forcing the `FIX` agent to resolve the issue by fixing the source code.
provenance: genuine-execution
---
