# 0145 - Auto-Partitioned `tests/` Sub-Waves Missing `Depends-On` on Uncommitted Subdirectory
id: 0145-auto-subwave-tests-dependson-and-uncommitted-subdir-linear-wave
skill: foreman
situation: Inspected Crucible `--matrix-fast-track` `IMPLEMENTATION-PLAN.md` before launching `run-live.mjs` on `C:\dev\Skill Foundry\skills\anvil`.
context: `C:\dev\trio\crucible\bin\plan-quality-gates.mjs` (`partitionDisjointSubWaves`) and `C:\dev\trio\foreman\bin\wave-engine.mjs` (parallel sub-wave worktrees).
observation: `partitionDisjointSubWaves` split each vertical wave into sibling `### Wave N.1` (`scripts/...`) and `### Wave N.k` (`tests/test_wN_...`) without `Depends-On: N.1`. Running `tests/` concurrently in a temporary git worktree branched from `HEAD` would (a) lose uncommitted baseline edits in `skills/anvil/scripts/anvil_engine.py` and (b) force the test sub-wave to guess un-landed function signatures.
outcome: friction - pruned synthetic `### Wave N.k` sub-wave splits from `IMPLEMENTATION-PLAN.md` so each vertical wave (`## Wave 1..3`) executes as a cohesive single-threaded linear wave (`gitDiff: false` SHA-256 snapshot), verified `locate-plan.mjs` exit `0` (`partitionDisjointSubWaves` should emit `Depends-On` from `tests/` slices onto implementation slices and skip git-worktree branching when target subdir is dirty).
provenance: genuine-execution - Anvil v4 Foreman pre-launch contract check (`2026-11-17T19:18-07:00`).
