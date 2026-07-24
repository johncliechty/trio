# 0084 — P0 direct fix: EPIPE-safe emit + ALL-reviewers transport_failed → GO when gate GREEN

**Date:** 2026-07-24  
**Trigger:** Canonical onboard live run thrashed on (1) `uncaughtException EPIPE` at `emit → process.stdout.write` when parent closed the pipe, and (2) ALL reviewers `transport_failed` HALT after a GREEN orchestrator gate (same-family grok review JSON thrash).  
**Method:** Direct in-session fix — **not** via Crucible/Foreman self-heal (engines were the patients).

## Changes

| File | Fix |
|------|-----|
| `foreman/bin/run-live.mjs` | stdout/stderr `error` listeners; `emit()` try/catch around `stdout.write` — file status log remains source of truth |
| `drivers/process-lifetime.mjs` | `isBenignIoError` (EPIPE/EIO/broken pipe) → note + return, never `process.exit` |
| `foreman/bin/wave-engine.mjs` | T10a-bis: ALL `transport_failed` + `lastGate.green` → empty reviews, `review:degraded` GO; HALT only if gate not green |
| `foreman/test/wave-engine.test.mjs` | T10a-bis unit |
| `drivers/test/process-lifetime.test.mjs` | benign EPIPE unit |

## Verification

- `node --test test/wave-engine.test.mjs` → 31 pass (incl. T10a-bis)
- `node --test test/process-lifetime.test.mjs` → 3 pass (incl. EPIPE)

## Honest scope

Wave-1 P0 only. Does not rewrite Crucible Stage-2 silence, does not re-vendor packages into share zips, does not re-run live multi-hour Foreman. Product onboard (share_ suite) already DONE with dual Package B gate; engine hygiene was residual.

## Next candidates (not this wave)

- Mirror EPIPE-safe emit on Crucible status emitters if same pattern
- Optional: re-vendor fixed foreman/drivers into Package A/B clean-ship trees before external handoff
- Commit trio fix to origin when operator asks
