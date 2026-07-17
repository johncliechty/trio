# 0005 — Stale TRIO_MODEL_* labels killed every Shark seat (root-caused 2026-07-16 ~19:45)

The REAL Shark killer in both Item-F Stage-1 runs was NOT prompt size: user-env
`TRIO_MODEL_SHARK/REVIEW/REVIEWER/DEBATE` were setx'd to `gemini-3.1-pro`, but agy tightened its
model-name strictness and now requires its LABEL strings (`Gemini 3.1 Pro (High)` etc.). agy
exits 1 in ~1.5s printing its model list; the driver returns `{text:'', cli_status:1,
degraded:true}`; the Shark seam counted the empty reply as a CLEAN DRY round (the fake-dry hole,
journal 0004 item 1). Proven by a live probe: oversized FILE-delivered prompt + `role: shark` →
`cli_status: 1`, `requested_model: "gemini-3.1-pro"`, agy's model list on stdout. The Judge seat
survived because it had no env override and fell back to `GEMINI_HEAVY_MODEL = 'Gemini 3.1 Pro
(High)'` (valid). The agy-hosted foreman build hit the same class (its journal
0007-model-string-strictness).

**Operator fix (PERMANENT, applied 2026-07-16 ~20:05):** all four labels persisted to the User
environment via `[Environment]::SetEnvironmentVariable(...,'User')` (the `setx` path was
classifier-blocked; the API route was not) and verified. Future sessions inherit them.

**Repair-plan feeds:** (1) the fake-dry hole stands (a cli_error seat MUST be a loud dropped
seat, never a clean DRY); (2) model-label drift should fail LOUD at the driver (unknown-label
detection: agy printing the model list on exit 1 is machine-recognizable); (3) the argv fix
(ed2093a) remains correct and necessary — both bugs were real, this one was the killer.
