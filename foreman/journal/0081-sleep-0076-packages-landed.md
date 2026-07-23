---
id: 0081-sleep-0076-packages-landed
skill: foreman@2026-07-23
situation: foundry-sleep-0076-execute-vacuous-packages-1-6-landed
context: >
  Foundry sleep on 0076/0078/0079 family (portfolio E). Operator: implement the plan.
  Guardrails 0079 obeyed — vacuous-GREEN not weakened.
observation: >
  ## Packages landed (code + unit tests)

  | # | Package | Surfaces | Result |
  |---|---------|----------|--------|
  | 1 | Execute contract injection | `wave-workflow.js` extractWaveSection + executePrompt BEGIN WAVE CONTRACT | **DONE** — two-step header parse (JS has no `\Z`; fixed empty final-wave extract) |
  | 2 | Unified live agent telemetry | `run-live.mjs` always `makeForemanDriver({ agent, log })` | **DONE** — never TRIO_DRIVER ? {log} : {agent} |
  | 3 | Vacuous clear-halt policy | `project-engine.clearHaltedCheckpoint` refuse unless force; run-live `--force`/`--clear-halt-force`; checkpoint.mjs clear | **DONE** — vacuous re-enter EXECUTE with force; non-vacuous still gate |
  | 4 | Windows-safe expanding gate | preflight message prefers `scripts/run-all-tests.mjs`; bare `test/` still hard-error | **DONE** (engine); Crucible emit companion **0071** |
  | 5 | Stable gate artifacts (engine) | `isRuntimeNoisePath` excluded from hash-diff + proven ledger | **DONE** — logs/status/out never look like wave deltas |
  | 6 | Proven ledger quality | `writeWaveProvenLedger` source-only; no log-only overwrite | **DONE** |

  ## Tests

  - New: `test/sleep-0076-execute-vacuous-ledger.test.mjs` (packages 1/3/4/5/6)
  - Updated: project-engine clear-halt, phase-a ordinary-halt (no longer treats vacuous as ordinary)
  - Green subset: sleep-0076 + project-engine + phase-a clear-halt paths — **all pass**

  ## Honesty residuals (not closed by this sleep)

  - Live greenfield multi-wave execute without human pre-land still needs a **hermetic live demo** (0079 acceptance item 1) — unit proves contract injection; product residual remains labeled.
  - Full Foreman suite still has **pre-existing** fails outside this family: `lock-lifecycle-crash-recovery` (2), `gate-preflight` dual-root when projectDir is foreman root (1). Not introduced by this sleep.

  ## What we did NOT do (0079)

  - Did not weaken vacuous-GREEN for empty execute GO
  - Did not re-allow bare `node --test test/` on Windows
  - Did not freestyle mid-portfolio-run (this is the Foundry sleep)

outcome: fixed
provenance: genuine-execution
---

# Sleep promotion — 0076 packages 1–6

**One-line:** Foreman sleep landed execute contract + always-on agent telemetry + vacuous clear-halt refuse + ledger/noise hygiene + expanding-gate messaging; vacuous-GREEN remains hard.

**Read with:** 0078 (investigation) · 0079 (guardrails) · 0076 (packages) · Crucible **0071** (Stage-2 emit)

**Ops note after this sleep:**
- Vacuous HALT: **do not** `--clear-halt` alone. Land import-tested source, or `--clear-halt --force` then `--resume` (force re-enters EXECUTE).
- Prefer plan `test-command: node scripts/run-all-tests.mjs` (Crucible Stage-2 now emits the helper).
- Proven ledgers: source paths only; never hand-write logs into `changed`.
