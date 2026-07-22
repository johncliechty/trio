# 0020 — Tidy-Idy GUI polish Stage-1: silent death + relaunch

- **id:** 0020
- **skill:** crucible
- **situation:** LITE Stage-1 for Tidy-Idy GUI polish (mockup sort + panel polish only; engine already shipped). Depth LITE + North Star locked 2026-07-22. Seats from Anchor prefs: coding=grok, review=grok, cross_model:false, driver grok-cli. Plan dir: `C:\dev\plans\2026-07-tidy-idy-gui-polish\`.
- **context:** First launch via ConPTY `pty-launch.py` produced empty console/status (process never stayed up). Second launch (`Start-Process node launch-stage1.mjs`, pid ~65856) logged launch + `[stage1] brainstorm…` then **vanished** with empty stderr, no `_stage1-result.json`, no uncaught stack — silent death during first brainstorm agent calls. Smoke of `buildLiveCrucibleAgent` + one-word PONG via grok-cli succeeded (~4s). Third launch (pid 74048, wrap with uncaught/unhandled handlers, `--trace-uncaught`) stayed alive; by ~12:43Z had `assumption-map: 17` and `premortem: 18` (progress past the silent-death window).
- **observation:** (1) Operator session did **not** journal friction at the moment of failure — only after John asked “Are you journaling these issues?” — violates AGENTS journaling rule. (2) ConPTY wrapper path for Crucible launch was ineffective here (empty logs). (3) Stage-1 process can exit mid-brainstorm with **zero stderr** when not wrapped — hard to distinguish hang vs death without process census. (4) Same-family grok seats build cleanly; not a seating bug. (5) Relaunch without clearing status log appends a second launch header (ok for forensics).
- **outcome:** friction
- **provenance:** genuine-execution
- **next:** Keep uncaught wrappers on live launchers; census the Stage-1 node pid each status tick; if brainstorm stalls >~20m after premortem with no ideas line, kill+relaunch once and journal. Do not start a second concurrent Stage-1. Append human NNNN when Stage-1 HALTs for Master Plan approval.
