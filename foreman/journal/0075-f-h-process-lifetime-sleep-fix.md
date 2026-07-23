---
id: 0075-f-h-process-lifetime-sleep-fix
skill: foreman@2026-07-23
situation: sleep-fix-silent-midwave-process-death
context: >
  Formal Foundry sleep cycle for F-H cluster (0072 / F036–F045).
  Code roots: trio/drivers/process-lifetime.mjs, foreman run-live + project-engine +
  wave-engine, crucible stage1 progress stamps. 2026-07-23.
observation: >
  Root class (genuine-execution): long-lived engines had (1) no process-level handlers
  for uncaughtException/unhandledRejection/SIGINT/SIGTERM, so deaths left empty stderr;
  (2) status=running mid-wave checkpoints did NOT seed resumeFrom, so every --resume
  re-ran full EXECUTE even after a GREEN gate stamp; (3) no checkpoint stamp between
  GREEN gate and review agent call — the exact B7 W4 death window; (4) Crucible Stage-1
  had no durable post-triage progress file before buildPhasedPlan (C Legal death window).

  Fixes landed:
  · drivers/process-lifetime.mjs — installProcessLifetimeGuards + withPhaseProgress
    (heartbeat, last-crash.json, fail-loud exit)
  · run-live.mjs — install guards at entry (crash/heartbeat under .foreman/)
  · project-engine planResume — status=running mid-wave returns resumeFrom
    {iteration, intraStep}
  · wave-engine — skip execute when resume at gate|review; stamp
    intra_wave_step=review after GREEN gate before review agents
  · crucible stage1 — post-triage durable stage1-progress.json + stage1-triage.json;
    explicit log + error stamp around buildPhasedPlan
  · C-legal launcher — process-lifetime guards installed
  · unit tests: process-lifetime.test.mjs (2), process-lifetime-resume.test.mjs (2);
    budget-resume regression 11/11 green

  Does NOT claim external SIGKILL / host reaper is eliminated — those still need
  heartbeat observation — but deaths are fail-loud when caused by JS exceptions, and
  resume is no longer execute-thrash after a proven GREEN gate.
outcome: worked
provenance: genuine-execution
---

Sleep F-H P0 closed for this cycle. Next operator step: resume B7 W4 with --resume
(should skip execute if checkpoint stamped review, or re-gate only) and/or relaunch
C Legal FULL Stage-1 with progress files under artifacts/.
