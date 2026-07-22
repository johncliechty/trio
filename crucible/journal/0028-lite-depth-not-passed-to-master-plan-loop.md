# 0028 — LITE depth not applied to runMasterPlanLoop (roundCap stayed 5)

- **id:** 0028
- **skill:** crucible
- **situation:** launch-shark.mjs / launch-stage1.mjs passed `depth: 'LITE'` into `runMasterPlanLoop`.
- **observation:** Only `runStage1` maps depth→roundCap (2). `runMasterPlanLoop` default `roundCap=5` and has **no depth param**. Shark log showed `loop bounds: rounds 1..5` — FULL Shark budget while user chose LITE. Fixed launchers to pass `roundCap: 2` explicitly. Restart Shark if still on 5-round window.
- **outcome:** friction
- **provenance:** genuine-execution
