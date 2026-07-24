# 0086 — Full thrash backlog closeout (0082 P0–P3 + Crucible 0075 leftovers)

**Date:** 2026-07-24  
**Trigger:** Operator asked for ALL thrash modes fixed, not only P0 EPIPE/review. Prior session stopped early after "waves" — this entry closes the rest.

## Already closed earlier today
| Item | Commit |
|------|--------|
| EPIPE emit + benign IO | f672302 |
| ALL transport_failed + GREEN → review:degraded | f672302 |
| Stage-2 HALT.json / force-emit / progress | c159ccf |

## Landed this commit

| 0082 / 0075 item | Implementation |
|------------------|----------------|
| P0.3 Mid-agent heartbeat | `withAgentHeartbeat` around execute/review/fix |
| P0.5 Auto proven-ledger | reachability fill after GREEN when hash-diff empty |
| P1.6 Wave-scoped gate | `parseWaves` → `wave.gateCommand`; `resolveWaveGateCommand` |
| P1.9 Skip re-execute on resume | skip execute at gate when proven ledger exists |
| P2.10 Dead-process checkpoint | `acquireLock` onStale → stamp halted checkpoint |
| P2.11 Stuck hint | status table shows intra_wave / pending |
| P2.12 HALT taxonomy | `[taxonomy:vacuous]` / `dead-process` prefixes |
| P2.13 Doctor | `doctorTestCommand` + `run-live --doctor` + `go.ps1 -Doctor` |
| P0.2 Detached launch | `go.ps1 -Detached` (file logs; engine EPIPE-safe) |
| P3.14 Pre-gate syntax smoke | `preGateSyntaxSmoke` before runGate |
| P3.15–16 Execute checklist | absolute paths banned + import-by-test in execute prompt |
| Crucible ASCII status | status-heartbeat plain ASCII bars |
| Crucible input budget | decomposePrompt truncates huge NS/MP embeds |
| Crucible LITE ETA banner | log line on Stage-2 start |

## Tests
- `test/thrash-0082-cleanup.test.mjs` — 8/8
- `test/wave-engine.test.mjs` — 31/31 (incl. prior T10a-bis)
- stage2 + status-heartbeat still green

## Honesty
- Live multi-hour soak of the full stack was **not** re-run on the onboard project (product already DONE).
- Wave-scoped gates only apply when the plan declares per-wave `gate-command:`; default remains full suite.
- Vacuous-GREEN hard guard is **intentionally kept** — auto-ledger + credit reduce false thrash without allowing empty execute GO.
