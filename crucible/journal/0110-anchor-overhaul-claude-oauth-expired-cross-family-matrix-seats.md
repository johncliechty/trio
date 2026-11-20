# 0110 - Expired Claude CLI OAuth During Crucible Stage-1 Review & Healthy 3-Family Matrix Seat Routing
id: 0110-anchor-overhaul-claude-oauth-expired-cross-family-matrix-seats
skill: crucible
situation: During Crucible `--matrix-fast-track` Stage-1 review for the Anchor system-wide overhaul (`C:\dev\Anchor\planning\anchor-overhaul-2026-11-12`), host `model_prefs.json` designated `review_family: "claude"` and `coding_family: "gemini"`, while the host `claude` CLI OAuth session was expired (`OAuth session expired and could not be refreshed`) and `agy.exe --input-format stream-json` retained the post-turn non-exit hazard documented in `0109`.
context: Windows 11 host (`PUTER`), `C:\dev\trio` + `C:\dev\Anchor`, active authenticated CLIs: `gemini-cli`, `chatgpt-cli` (`codex`), and `grok-cli` (`grok`).
observation: Calling `runAgent()` in `drivers/index.mjs:674` unconditionally overwrites `opts.driver` with `resolveDriverFromFamilies(...)` (`gemini-cli` for coding roles, hitting the `0109` `agy.exe` stream-json non-exit timeout, and `claude` for review roles, hitting `verification_fail_closed` due to expired `claude` OAuth), even when `chatgpt-cli` and `grok-cli` are authenticated and healthy on the same workstation.
outcome: worked - invoked `chatgptCliDriver.runAgent` and `grokCliDriver.runAgent` directly for Stage-1 `runPlanElegancePass` (Rabbit-Catcher + Adversary) and two parallel Cross-Family Matrix Sharks (`timeoutMs: 120_000`), preserving genuine 3-family adversarial independence (Gemini planner vs. OpenAI Codex + xAI Grok reviewers) without mutating John's global `model_prefs.json`.
provenance: genuine-execution - live Crucible Stage-1 `--matrix-fast-track` run on `C:\dev\Anchor\planning\anchor-overhaul-2026-11-12` (`2026-11-12`).

## 1. Root Cause Analysis

1. **Expired Provider OAuth on Configured `review_family`:**
   - `~/.anchor/model_prefs.json` sets `coding_family: "gemini"` and `review_family: "claude"`, while `claude -p` returns `auth_error` (`OAuth session expired and could not be refreshed`).
   - Trio's `dispatchWithFailover` rightly refuses silent same-family substitution on `VERIFICATION_ROLES`, halting with `verification_fail_closed` unless an explicit healthy cross-family driver is bound.
2. **Concurrent `agy.exe` Stream Non-Exit (`0109`):**
   - Spawning `gemini-cli` (`agy.exe --input-format stream-json`) without a bounded per-seat timeout risks post-turn non-exit hangs (`0109`) and same-family blind spots when the primary session is already Gemini.

## 2. Remedy & Operational Rule

1. **Pre-Flight CLI Auth Check Before Crucible / Foreman Waves:**
   - Verify CLI authentication across `claude`, `chatgpt-cli`, `grok-cli`, and `gemini-cli` before launching multi-seat review or build loops.
   - When the primary session is Gemini and `claude` OAuth is expired, bind Stage-1/Stage-2 review and Rabbit-Catcher seats explicitly to healthy `chatgpt-cli` and `grok-cli` (`timeoutMs: 120_000`), achieving true 3-family diversity without touching global user settings.
