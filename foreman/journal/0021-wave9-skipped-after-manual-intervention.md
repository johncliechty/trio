# Lesson 0021: Skipping a Wave After Complete Manual Intervention

## Context
During Wave 9, the orchestrator repeatedly hit a `vacuous-GREEN HALT` with the message: "wave reached green without proving its own deliverable was exercised — the wave changed no source file reachable by an executed test."

## Cause
Because the underlying test failures were completely resolved via a pair-programming intervention before the wave was re-run (modifying tests, updating `MANIFEST`, adding schemas, fixing leak-scan patterns, and correcting `anchor_gui.py`), the codebase was already fully GREEN and compliant with Wave 9's deliverables. When the agent ran to execute the wave, it correctly saw no remaining work to be done and made zero code modifications. The orchestrator's F2-9 vacuous-GREEN guard correctly detected that no source files were changed during the agent's run and halted the wave, preventing an unproven GO.

## Resolution
To proceed, the human pair-programmer manually advanced the `foreman-checkpoint.json` to `current_wave: 10`, setting `status: halted` and resetting findings. This bypasses the wave since its deliverables were already satisfied and verified manually.

## Future Prevention
When a wave is fully implemented during a manual intervention (rather than by the orchestrator's agent), the engine's vacuous-GREEN guard will properly refuse to pass it. In these scenarios, manually advancing the checkpoint is the correct resolution to continue the orchestration.
