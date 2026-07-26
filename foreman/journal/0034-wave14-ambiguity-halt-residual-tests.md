# Journal Entry 0034: Wave 14 Ambiguity Halt due to Residual Test Files

- **id**: 0034-wave14-ambiguity-halt-residual-tests
- **skill**: foreman
- **situation**: Foreman halted on Wave 14 with an `ambiguity HALT` because the review agent could not find a plan line to justify its "wave-not-implemented" blocker.
- **context**: In the previous run, the execute agent had successfully written `test/acceptance.test.mjs` and `test/windows.test.mjs`. When I reset the checkpoint back to the execute phase to fix the `[test-only]` title issue, I left those test files on the disk. Because they were already passing, the execute agent on iteration 0 did nothing and changed zero files. The review agent saw zero changed files, threw a "wave-not-implemented" blocker, but got confused when trying to cite the frozen docs, resulting in an ambiguity halt.
- **observation**: This reinforces the strictness of the Foreman file tracking loop. If the execute agent doesn't actively change files *during its invocation*, it cannot pass the gate, even if the files exist from a previous attempt. 
- **outcome**: friction. I manually deleted the residual test files so that the execute agent is forced to write them again during its next run. I reset the checkpoint to `execute` iteration 0 and restarted Foreman.
- **provenance**: genuine-execution
