# 0109 - agy stream-json Non-Exit Hang in Stage-1 Elegance Pass & Enforcement of 120s Seat Timeout
id: 0109-agy-stream-json-elegance-non-exit-and-matrix-fast-track
skill: crucible
situation: During Crucible Stage 1 planning for Anchor's Cross-Platform Desktop Shell (`planning/cross-platform-shell-2026-10-29`), `_run-crucible-lite.mjs` completed `stage1-oranges-brainstorm`, `stage1-triage` (`stage1-triage.json`), and `stage1-phased-plan`, then stalled indefinitely at `phase stage1-elegance-pass: start`.
context: Windows 11 host (`PUTER`), `C:\dev\trio` commit `4b3e2ea`, `C:\dev\Anchor` commit `27f604a`, `agy.exe` v1.3.x running `--input-format stream-json --output-format stream-json --model gemini-4-argon-high --mode plan -p=`.
observation: The spawned `agy.exe` child process (`PID 31176`, conversation `23e5e55d-e825-49d7-97d7-4a4da2da9f5b`) finished generating its complete 24-element `KEEP` JSON verdict table at `17:17:31Z` (16 seconds after launch, recorded at `step_index: 9`, `status: "DONE"` in `transcript.jsonl`), but failed to close stdout or exit its process. Because `elegance-pass.mjs` invoked `agent()` without an explicit per-seat `timeoutMs` and `drivers/gemini-cli.mjs` sets `DEFAULT_GEMINI_TIMEOUT_MS = 60 * 60 * 1000` (60 minutes) while `buildAgyStreamArgs` omits `--print-timeout`, `runCloseBoundProcess` remained blocked waiting for `child.on('close')` for over 20 minutes while concurrent `agy.exe` processes (`gemini_turn_bridge.py`) also logged intermittent auth-token contention (`error getting token source: You are not logged into Antigravity`).
outcome: worked - reaped hung `agy.exe` PID `31176`, recovered the completed 24-element Stage-1 elegance verdict payload from conversation `23e5e55d-e825-49d7-97d7-4a4da2da9f5b`, and switched execution to the `0108` Multi-Level Adversarial Matrix Fast-Track (`--matrix-fast-track`) with a hard `120s` per-seat timeout ceiling.
provenance: genuine-execution - live Crucible Stage-1 run on `C:\dev\Anchor\planning\cross-platform-shell-2026-10-29` (`task-110`, node PID `15720`, `agy.exe` PID `31176`).

## 1. Root Cause Analysis

1. **Post-Turn Non-Exit in `agy.exe --input-format stream-json`:**
   - At `11:17:13 AM` local (`17:17:13Z`), `elegance-hooks.mjs` -> `drivers/elegance-pass.mjs` spawned `agy.exe --input-format stream-json --output-format stream-json --model gemini-4-argon-high --mode plan -p=` (`PID 31176`).
   - Inspection of `C:\Users\john\.gemini\antigravity-cli\brain\23e5e55d-e825-49d7-97d7-4a4da2da9f5b\.system_generated\logs\transcript.jsonl` confirmed that `step_index: 9` (`PLANNER_RESPONSE`, `status: "DONE"`) completed at `17:17:31.594Z` (~16.5s execution time) with valid schema-conformant JSON for all 24 Stage-1 specifics (`P1.1`..`P4.6`).
   - However, `agy.exe` `PID 31176` never emitted process exit after flushing the turn, leaving `runCloseBoundProcess` in `drivers/subscription-process.mjs` waiting on process close.
2. **60-Minute Default Ceiling Without Per-Seat Override:**
   - `drivers/gemini-cli.mjs` defines `DEFAULT_GEMINI_TIMEOUT_MS = 60 * 60 * 1000` (1 hour) and `buildAgyStreamArgs` does not pass `--print-timeout`.
   - When `stage1.mjs` / `elegance-pass.mjs` calls `agent()` without an explicit bounded `timeoutMs` (such as the `120_000` ms per-seat cap mandated by journal `0108` `--matrix-fast-track`), a post-turn non-exit hangs the entire Stage-1 pipeline for up to 60 minutes per seat.

## 2. Remedy & Operational Rule

1. **Always Enforce a Bounded Per-Seat `timeoutMs` (`120_000` ms) and `--matrix-fast-track` (`0108`):**
   - Any Crucible or cross-family seat invocation over `gemini-cli` (`agy.exe`) must pass an explicit bounded `timeoutMs` (`120_000` ms for structured review/elegance seats) rather than inheriting the 60-minute `DEFAULT_GEMINI_TIMEOUT_MS`.
   - Use the `0108` Multi-Level Adversarial Matrix (`L0–L5`) + bounded single-pass convergence architecture so Stage 1 and Stage 2 artifacts are materialized deterministically and verified by `foreman/bin/locate-plan.mjs`.
