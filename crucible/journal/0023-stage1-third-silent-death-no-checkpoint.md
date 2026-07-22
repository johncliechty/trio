# 0023 — Stage-1 third silent death (no checkpoint reached)

- **id:** 0023
- **skill:** crucible
- **situation:** Tidy-Idy GUI polish LITE Stage-1 relaunch after user said keep Crucible (0022). Pid 68544, checkpoints added to launcher.
- **context:** Logged launch + seats + `[stage1] brainstorm…` then **died** with empty stderr before any assumption-map line and **before** `_stage1-checkpoint.json` was written. Start-Process RedirectStandard* overwrote console log (only 336 bytes = third launch header). 10-min relay subagent reported stale “triage complete” from prior pid 74048 run — census was wrong.
- **observation:** Third silent death on grok Stage-1. Checkpoint feature never exercised. Status cadence must sample **live pid**, not last successful step from a dead process. RedirectStandardOutput on Start-Process is a bad fit (truncates + possible handle issues with nested grok spawns).
- **outcome:** friction
- **provenance:** genuine-execution
- **next:** Relaunch without stdout redirect (status log only via appendFileSync); record pid in `_stage1.pid`; journal if death #4.
