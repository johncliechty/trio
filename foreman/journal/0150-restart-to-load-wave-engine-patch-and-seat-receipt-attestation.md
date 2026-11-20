# 0150 - Restarting In-Flight `run-live.mjs` After `0149` Engine Patch & Requiring Challenge-Bound Seat Provenance in `xval-audit`
id: 0150-restart-to-load-wave-engine-patch-and-seat-receipt-attestation
skill: foreman
situation: After patching `wave-engine.mjs` on disk (`0149`) during Wave 2 iteration 3, the already-running Node process (`task-4662`) retained the pre-patch `judge()` and `testBaseline` in memory, causing `tests/test_w2_anvil_v4_refactor_paper_xval.py:517+elegance` to block `wave-2-review-3.json` alongside two remaining Wave 2 findings (`symbol-conservation` across test files and positive seat provenance for `cross_family_attested`).
context: `C:\dev\Skill Foundry\skills\anvil\.foreman\wave-2-review-3.json` and `C:\dev\trio\foreman\bin\wave-engine.mjs`.
observation: Patching `wave-engine.mjs` on disk does not hot-reload an active Node ESM process. Stopping the pre-patch `run-live.mjs` process cleanly before `fix:w2.4` and resuming with `--resume --clear-halt --cap 6` loads the `0149` engine fix at Wave 2 (`skipExecute` / gate re-entry with fresh `testBaseline`), allowing `compile` to be removed from `banned_calls` while closing both product-code findings (`prod_files + test_files` symbol conservation and challenge-bound/receipt-verified cross-family seat attestation).
outcome: fixed - stopped pre-patch `run-live.mjs`, closed all 3 `wave-2-review-3.json` findings, and resumed Foreman on Wave 2 with `--cap 6`.
provenance: genuine-execution - Anvil v4 Foreman Wave 2 (`2026-11-17T22:11-07:00`).
