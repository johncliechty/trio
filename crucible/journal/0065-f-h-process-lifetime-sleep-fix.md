---
id: 0065-f-h-process-lifetime-sleep-fix
skill: crucible@2026-07-23
situation: sleep-fix-silent-stage1-process-death
context: >
  Formal Foundry sleep cycle paired with foreman 0075 for F-H (0064 / F042–F045).
  2026-07-23. C Legal FULL Stage-1 death window = post-triage / pre-phased-plan.
observation: >
  stage1.mjs now stamps artifacts/stage1-progress.json + stage1-triage.json after
  Oranges triage and before buildPhasedPlan, logs "building phased plan…", and
  writes phased-plan-error progress on failure (no silent freeze at that boundary).
  C-legal-engine launch-crucible-full.mjs installs process-lifetime guards
  (last-crash.json + heartbeat under .crucible/). Shared module:
  trio/drivers/process-lifetime.mjs.
outcome: worked
provenance: genuine-execution
---

Pair with foreman **0075**. Resume Track C after this sleep; if death recurs, read
.crucible/last-crash.json and artifacts/stage1-progress.json first.
