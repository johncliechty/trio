# 0088 — P1: gate TIMEOUT_INCOMPLETE class, async gate + heartbeat + rebind, scoped test-only bar, prior-credit ordering, EXECUTION-LOG writer (2026-07-25)

The P1 babysitting-killer batch from the 2026-07-25 journal-hardening review, direct fixes:

1. **Gate timeout ≠ RED (0078 T1).** `runGate` classifies a cap-kill as
   `gate_class: TIMEOUT_INCOMPLETE` (+ `timed_out`, `timeout_ms`, `progress_pct` from
   the last pytest `[ N%]`), kills the child TREE via taskkill (orphan pytests were
   surviving the shell kill), and `runWave` HALTs `[taxonomy:gate-timeout]` with a
   scoping steer BEFORE the fix loop — no more chasing a `0 pass 0 fail` lie. A
   timed-out gate is also never labeled vacuous.
2. **Async gate + heartbeat (0078 T4/T8, 0082 P0.3).** `runGate` is now spawn-based
   async (was a spawnSync event-loop freeze for up to 20m during which no log line or
   status write was physically possible). The wave loop awaits it under `agentWait`
   ('gate' seat in waiting-on.json) and prints `gate running · t+Nm · last: <line>`
   every minute. Call sites/tests updated to await.
3. **Per-iteration gate rebind (0078 T7).** The gate command is re-resolved from the
   plan ON DISK each loop iteration (discoverTestCommand + parseWaves fresh read;
   `{command}` unwrapped) — a mid-run plan amendment rebinds the live gate; unreadable
   plan falls back to invocation bindings.
4. **Test-only evidence bar (0035/0041, aggravated by 0086).** The bar compared the
   gate's executed count to the WHOLE-REPO inventory (29 vs 2597). Now: full-suite bar
   first; a PLAN-DECLARED wave-scoped gate (`gateScoped`) accepts the wave's NET-NEW
   test count (>=1 for modify-only [test-only]); an UNDECLARED subset still HALTs —
   counts can't prove which tests ran, so T4 is not weakened. Residual: repo-wide
   inventory over-breadth in monorepos (0035's other half) needs gate-file-scoped
   inventory — not attempted here.
5. **Prior-attempt credit ordering (0076 RC3).** `creditPriorWaveAttempt` now runs
   whenever `code.length === 0` — BEFORE the doc/data and test-only-failure branches —
   so a resume whose second pass touched only docs/status still sees the prior proven
   ledger. Credit semantics unchanged (ledger + live files + exercise required).
6. **EXECUTION-LOG writer (0023/0025/0028/0058, 0076 RC2).** `finishGo` appends one
   GREEN line per GO (before the commit, so it rides the wave's own commit),
   best-effort via locateDocs. Downstream EXECUTE agents no longer halt on
   "prerequisite wave missing".
7. **SKILL.md refreshed** — the July flags/behaviors are finally documented
   (`--clear-halt --force`, taxonomy prefixes, review:degraded, per-wave gate-command,
   gate-timeout class, the never-`git clean -fd` warning).

Tests: +3 new pins (TIMEOUT_INCOMPLETE unit, runWave gate-timeout HALT with zero fix
calls, plan-scoped test-only acceptance vs undeclared-subset HALT). Suite: 165 pass /
5 fail — the 5 are the pre-existing lock-lifecycle/preflight/F3 set (confirmed at HEAD).

provenance: genuine-execution (direct-fix session, tests green)
