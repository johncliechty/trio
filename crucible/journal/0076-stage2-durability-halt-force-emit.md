# 0076 — Stage-2 durability: progress, HALT.json, force-emit (wave 3)

**Date:** 2026-07-24  
**Closes residuals from:** 0075 (canonical onboard Stage-2 silent death)  
**Method:** Direct in-session fix + unit tests (not self-heal via live Crucible).

## Changes

| Surface | Fix |
|---------|-----|
| `drivers/process-lifetime.mjs` | optional `onFatal(payload)` after last-crash write |
| `crucible/bin/stage2.mjs` | `writeStage2HaltJson`, `stampStage2Progress`, `forceEmitStage2HumanLockable` |
| `runStage2` | installs process-lifetime; phase progress; wave-decomposition.json; on unexpected/process death → HALT.json + human-lockable draft if decomp exists |
| tests | stage2 durability + process-lifetime onFatal |

## Operator contract

After a Stage-2 stall, look for:

1. `<artifactsDir|outputDir/.crucible>/stage2-progress.json` — last phase
2. `.../last-crash.json` — if process died
3. `.../HALT.json` — reason, last_step, human_lockable, artifact paths
4. `<outputDir>/_human-lockable-draft/` — force-emitted doc-trio when waves were already decomposed (not a Foreman handoff)

## Verification

- `node --test test/stage2.test.mjs` (durability cases + existing e2e)
- `node --test test/process-lifetime.test.mjs`

## Still open (not this wave)

- Stage-2 input budget (don't embed 40k NS twice)
- LITE ETA banner honesty
- Plain-ASCII status table default
