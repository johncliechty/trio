**id**: 0040-wave2-resume-state-machine-bug
**skill**: foreman
**situation**: Resuming Foreman after a vacuous-GREEN halt by amending the plan.
**context**: Wave 2 halted at the gate step because no test was written. I amended the plan to require the test and resumed.
**observation**: Foreman resumed at the exact state it left off (`step=gate`), skipping the `execute` and `fix` steps entirely. Thus, the agent was never invoked to read the new plan, and the gate immediately failed again with the exact same vacuous-GREEN halt.
**outcome**: halted
**provenance**: genuine-execution
