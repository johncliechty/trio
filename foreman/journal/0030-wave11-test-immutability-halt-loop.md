# Journal Entry 0030: Wave 11 Test Immutability Halt Loop and Forward Fix

- **id**: 0030-wave11-test-immutability-halt-loop
- **skill**: foreman
- **situation**: The execute subagent for Wave 11 repeatedly produced a buggy test file (`test/update.test.mjs`) and a buggy python script (`update_transaction.py`). The fix agent repeatedly fixed them, but triggered the `test-immutability HALT` every time because it is forbidden from editing tests.
- **context**: The execute agent was using `../../anchor.py` instead of an absolute path, and it forgot to exclude the test file in `bundle/MANIFEST`. It also imported `ANCHOR_DIR` from `paths.py` (which no longer exists) in the implementation script. When I reverted the fix agent's edits and restarted the execute agent, it simply reproduced the exact same bugs because it lacked the context of its previous failures.
- **observation**: To break out of this loop, I cannot simply keep resetting the execute agent. I must provide it with the correct context *before* it runs.
- **outcome**: friction. I added explicit instructions to the Wave 11 block in `IMPLEMENTATION-PLAN.md` detailing exactly how to fix the relative path, the manifest, and the `ANCHOR_DIR` import. I then reverted the fix agent's test changes and reset the checkpoint back to `execute`. This ensures the execute agent will read the solution and generate correct tests and implementation code from the start, avoiding the fix agent altogether. Foreman was restarted.
- **provenance**: genuine-execution
