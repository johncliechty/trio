---
id: 0005
skill: foreman
situation: Engine tripped a vacuous-GREEN HALT on Wave 4.
context: The Wave 4 execution agent implemented its deliverable, and the test suite passed with 11/11 passing. However, the agent failed to add a test that exercised its new code.
observation: Foreman's ground-truth gate correctly detected that the tests were passing vacuously (no source file changed by the wave was actually reachable by an executed test). It immediately HALTED to prevent an unproven wave from auto-advancing, proving the efficacy of the anti-weakening guards.
outcome: friction
provenance: genuine-execution
---

### Resolution
1. The engine safely halted the run at Wave 4/5.
2. The recommended resolution is to explicitly add a test that exercises the changed code, then re-invoke the wave.
3. This ensures that every single wave is strictly forced to prove its deliverable through test coverage before it can be merged.
