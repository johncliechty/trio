# 0129 — Stream Interruption After Full Worktree Production & Clean Attempt-2 Recovery

- **id:** `0129-marketing-demand-moe-genai-stream-interruption-recovery`
- **skill:** `researchPrime`
- **Date:** 2026-11-02
- **Project:** `C:\dev\AI Club\MIT Lectures` (`marketing-demand-moe-genai-v1`)
- **Stakes:** Standard (`researchPrime` + `Gandalf` + `Superjump` + `Einstein` 5-part empirical demand synthesis & 14-slide deck)
- **situation:** During code job `20261102-044119-6d8394`, the worker completed all 5 outputs in the worktree (`REPORT.md` 133.3 KB, `REPORT.pdf` 1.39 MB, `build_marketing_demand_deck.py` 76.9 KB, `slides.pptx` 3.03 MB, `slides.pdf` 8.75 MB) across 2,261 seconds, and then experienced an upstream API stream interruption (`The stream was interrupted. Please continue the task you were working on.`) right as the producing turn closed.
- **context:** Because all 5 declared output files were already written and saved in the worktree (`C:\dev\Anchor-code-jobs\20261102-044119-6d8394`), `steward_code_job.py recover --job 20261102-044119-6d8394` was able to advance directly to Attempt 2 (`status: finishing`, `phase: checking`) without restarting the coder (`worker_restarted: false`).
- **observation:** When a long `researchPrime` + deck-generation job halts with a stream interruption at the end of `producing`, always inspect the worktree files before considering a restart; if all declared outputs are present on disk, `steward_code_job.py recover` transitions cleanly into the deterministic `--check` and cross-family review pipeline.
- **outcome:** `friction` (recovered immediately via `steward_code_job.py recover --job 20261102-044119-6d8394` into Attempt 2 `checking` phase).
- **provenance:** `genuine-execution`
