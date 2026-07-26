# 0066 — C Legal FULL post-F-H-sleep live re-proof DEAD (F048)

**Date:** 2026-07-23  
**skill/engine:** Crucible Stage-1 FULL · C-legal-engine  
**provenance:** genuine-execution  
**pairs with:** F048 · F047 · 0065 · foreman 0075 · F042–F045 cluster

## What happened

Post-sleep relaunch (F047) with `installProcessLifetimeGuards` + all-claude seats + direct node stderr capture:

| Field | Value |
|-------|--------|
| Launch | 2026-07-23T15:18:57Z · pid **21660** |
| Last log | guards installed · routes claude · FULL band stamp |
| Death check | ~15:29:51Z · PID **DEAD** |
| last-crash.json | **absent** |
| stage1-progress.json | **absent** |
| heartbeat | frozen at t0 (no 30s beats) |
| stderr | 0 bytes |

Never reached assumption-map. Same silent empty-progress death class (F-H) as pre-sleep runs; earlier kill point than post-triage F042/F045.

## Diagnosis

Guards cover uncaughtException / unhandledRejection / SIGINT / SIGTERM. Absence of last-crash + frozen heartbeat implies **external kill** (SIGKILL / job-object / host policy) or process tree disappearance without signal handlers. Sleep residual from 0065 explicitly noted external SIGKILL still possible; live re-proof confirms residual is **live**, not fixed by current guards alone.

## Operator decision

**STOP** — no blind relaunch (F045 rule + cadence tick policy: F-H again → report, do not infinite restart).

## Residual / sleep feed

- P0 still open: process-lifetime under nested agent trees on this host
- Need: parent watchdog that re-spawns or surfaces job-object death; or ConPTY/job isolation that survives host session; or root cause of who kills node ~minutes into Stage-1
- Track C Legal FULL parked until new hypothesis lands via formal Foundry sleep (not mid-run freelancing)

## Addendum F050 · F049 detached+watchdog also dead (~8m)

**2026-07-23 ~15:39Z:** Detached relaunch F049 (node **37384**, powershell watchdog **22224**, launched 15:31:25Z) both DEAD. Log still band-stamp only; no last-crash; no stage1-progress; heartbeat frozen at guards-installed. Detached-err empty.

**Implication:** Moving off the tool/session tree and adding a PS watchdog did **not** clear F-H. Whatever kills Stage-1 early also takes the watchdog (or kills the job containing both). Operator **STOP** — no further blind relaunch. Track C parked (F050).
