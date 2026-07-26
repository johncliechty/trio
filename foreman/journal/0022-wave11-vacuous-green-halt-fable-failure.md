# Lesson 0022: Vacuous-GREEN Halt Due to Agent Execution Failure

## Context
During Wave 11 ("Scrubbed Release Topology and the Update Transaction State Machine"), the orchestrator immediately triggered a `vacuous-GREEN HALT` because "the wave changed no source file reachable by an executed test."

## Cause
The orchestrator verified that no source files were modified. Unlike Wave 9, Wave 11 was NOT manually implemented, which means the execution agent (configured as `claude:claude-fable-5`) failed to output any file modifications during the execute phase. The agent ran for ~2 minutes but did not successfully apply the necessary implementation diffs. This triggers the vacuous-GREEN guard correctly, preventing an empty wave from converging. 
Furthermore, the `foreman.config.json` was still using `claude:claude-fable-5` for execute and fix, violating the global rule to always use the most capable model for complex orchestration (e.g., `Gemini 3.1 Pro (High)`).

## Resolution
The `foreman.config.json` was updated to route all roles (`execute`, `fix`, `review`) to `gemini-cli:Gemini 3.1 Pro (High)` to ensure a sufficiently capable model is driving the complex Wave 11 implementation. Foreman was then resumed from Wave 11.

## Future Prevention
When an agent fails to implement a wave and triggers a vacuous-GREEN halt by producing zero source code changes, verify the capability of the assigned model. Enforce the global model rule to use the highest tier model for Foreman executions to avoid capabilities-related execution failures.
