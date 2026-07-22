# 0046 — Phase A: prior-attempt credit + plan-amendment re-entry (2026-07-22)

**Why (journals):** 0010, 0015, 0043, 0045 — after real code was delivered and gated green,
resume/`git=false`/`--clear-halt` re-entered with empty hash-diff → **vacuous-GREEN HALT**
despite deliverables still on disk. 0040/0045 — after PLAN-AMENDMENT, clear-halt always
seeded `intra_wave_step=gate`, so amendment work never re-entered EXECUTE cleanly.

**North Star check (must not violate):**

| Pillar | Preserved? |
|--------|------------|
| Orchestrator-owned gate | **Yes** — credit only applies *after* gate is already GREEN |
| Vacuous-GREEN real | **Yes** — no ledger / missing files / unexercised code still HALTs |
| FIX ≠ tests | **Unchanged** |
| No silent plan rewrite | **Yes** — amendment still human-applied; we only change *re-entry step* |
| Single-threaded code | **Unchanged** |

**What changed:**

1. **`writeWaveProvenLedger` / `creditPriorWaveAttempt`** (`wave-engine.mjs`) — on GO, write
   `.foreman/wave-N-proven.json` with code paths. On later empty-diff vacuous check, if those
   paths still exist and are still test-exercised → credit (return null from guard).
2. **`clearHaltedCheckpoint`** (`project-engine.mjs`) — if pending_action matches PLAN-AMENDMENT,
   re-enter at `execute` with `iteration=0`; else keep gate re-entry.

**Tests:** `test/phase-a-efficiency.test.mjs` (7 pass) + full `wave-engine.test.mjs` (46 pass).

**Anti-arguments (self shark):**

- *“Ledger lets a stale wave GO forever.”* Files must still exist; must still be exercised by
  current tests; gate still runs every resume. Deleting code or tests breaks credit.
- *“Amendment → execute always wastes a seat.”* Cheaper than vacuous loop + human surgery;
  execute is no-op when agent correctly sees work done, then prior-credit or real delta applies.
- *“Should disable vacuous-GREEN.”* Rejected — that violates North Star. We only fix false
  positives after a *proven* same-wave GO.

**Outcome:** engine change ready for collaborator ship + triage stream.
