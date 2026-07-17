# 0004 — Shark prompts >32KB argv: warned, then a same-second "DRY 0 findings" round (2026-07-16 ~18:27 UTC, Item-F Stage 1)

Live Item-F Stage-1 run: round-2 Shark prompts hit ~55KB (whole locked North-Star doc embedded +
revised draft). The engine WARNED (`risks ENAMETOOLONG (~32KB argv). Trim it; let Gemini read
files itself.`) and the round came back "DRY — 0 blocker(s), 0 finding(s)" in the SAME second —
consistent with the Shark spawns failing/emptying rather than genuinely reviewing. The Judge
independently held (NOT_CONVERGED), so no false lock — the Judge backstop worked.

Repair-plan feed (Item E / crucible rigor):
1. Sharks need Foreman's T10 discipline: a transport-failed/empty Shark must be a LOUD dropped
   seat (and all-seats-failed = transport HALT), never counted as a clean DRY round.
2. The gemini-cli driver should pass long prompts via stdin/tempfile, not argv (same >32KB class
   as the reverted foreman driver rewrite).
3. Operator note: launchers should pass the North-Star STATEMENT + criteria, not the whole
   Stage-0 document, as `northStar` (prompt inflation is quadratic across rounds).
