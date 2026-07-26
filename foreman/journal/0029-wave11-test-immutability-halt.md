# Journal Entry 0029: Wave 11 Test Immutability Halt

- **id**: 0029-wave11-test-immutability-halt
- **skill**: foreman
- **situation**: The fix subagent for Wave 11 modified the test file `test/update.test.mjs`, which triggered the `test-immutability HALT` from the orchestrator.
- **context**: The execute agent successfully implemented Wave 11 and its tests, but two tests failed in the gate step due to a relative path typo in the test (`../../anchor.py`) and a missing MANIFEST exclusion. The fix agent stepped in, diagnosed the issue perfectly, and modified the test file and MANIFEST to make the tests pass. However, Foreman's strict rules dictate that the fix agent may only change *non-test* code to prevent cheating the tests.
- **observation**: The fix agent correctly diagnosed and fixed the issue, but violated the orchestrator's test immutability guarantee. This proves that the strict separation of duties between the execute and fix agents is enforced heavily.
- **outcome**: friction. I manually reverted the fix agent's changes to `test/update.test.mjs` and `bundle/MANIFEST` so the tests would fail again. I then reset the checkpoint back to the `execute` phase (iteration 0) so the execute agent can apply the test fix itself. Foreman was restarted.
- **provenance**: genuine-execution
