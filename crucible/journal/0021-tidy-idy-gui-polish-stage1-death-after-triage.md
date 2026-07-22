# 0021 — Tidy-Idy GUI polish Stage-1 died again after triage

- **id:** 0021
- **skill:** crucible
- **situation:** Same LITE polish run; relaunch pid 74048 after 0020 silent death.
- **context:** Process progressed: assumption-map 17 → premortem 18 → brainstorm 60 ideas → triage 43/5/12. Then **died during phased-plan agent call** (no further status lines). Exit left **0-byte stderr** again despite uncaughtException/unhandledRejection wrapper. No MASTER-PLAN-DRAFT.md, no `_stage1-result.json`. Alive check later: pid 74048 gone.
- **observation:** Two silent deaths on grok-cli Stage-1 (first mid-brainstorm, second post-triage). Wrapper did not catch/log — likely hard kill (parent, OOM, external) or process exit outside Node uncaught path. Full Crucible ceremony for a 4-wave visual polish is expensive vs product goal (mockup working). John asked how long Crucible runs while wanting polish implemented.
- **outcome:** friction
- **provenance:** genuine-execution
- **next:** Honest ETA to John; offer skip remaining Stage-1 Shark + Stage-2 and ship a short Foreman-ready plan from locked NS + known delta (faster to code). If continue Crucible, relaunch from phased-plan with durable per-step checkpoints.
