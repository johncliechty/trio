# 0104 — S-bundle: timeout floor 45m, delta-scan transparency, sibling-repo guard; plus a red-suite finding (2026-08-25)

Three John-ratified fixes (elegance cards, S-bundle), all designed in this journal's own
earlier entries:

1. **Per-call timeout default 20→45 min** (run-live.mjs; 0102 fix 4, 0103 item 1): the 20-min
   default SIGKILLed HEALTHY agents in two builds after diagnosis. Explicit values below 45
   still run but announce the floor breach by name. go.ps1 comment synced.
2. **Delta-coverage scan transparency** (delta-coverage-gate.mjs; 0103 item 3): every verdict
   now carries `scanned: {files, tests}` (persisted in the wave's delta-coverage.json), and
   the BLOCKER detail states exactly which changed files were scanned and which test files
   were read for mentions — the halt that never said what it scanned burned three remedy
   attempts on 2026-08-17.
3. **Sibling-repo cleanliness pre-flight** (run-live.mjs; 0102 defect 2/fix 5): before the
   engine starts, every OTHER git repo the plan text names (absolute paths) must be clean;
   HALT `[taxonomy:dirty-sibling]` names the dirty repo AND everything checked. PROJECT and
   the engine's own home repo are excluded; `FOREMAN_ALLOW_DIRTY_SIBLINGS=1` proceeds with
   the state recorded.

**Verification:** `node --check` clean on both files. Suite comparison — baseline (fixes
stashed) vs with-fixes: **identical failure sets, 156 pass / 27 fail both ways — the fixes
introduce ZERO regressions.**

**FINDING (new, needs its own session): the foreman suite has 27 PRE-EXISTING failures** —
budget-resume (A1/A2/B1/C2: fixture runs return HALT where BUDGET-STOP/DONE is expected),
git-reconciliation, e2e, dashboard classes. FOREMAN_CONCURRENT_REVIEW=0 does NOT cure it
(hypothesis tested and retired). Shared cause undiagnosed; candidate suspects include the
2026-08 drivers changes (e.g. 12940c0 grok-cli gate-3 conformance) — unverified. The doc
claim "suite green" was exactly the STATUS-drift class the elegance review flagged: trust
PLAN.md, and now trust THIS entry — the suite is red on this host today, and was red before
the S-bundle touched anything.
