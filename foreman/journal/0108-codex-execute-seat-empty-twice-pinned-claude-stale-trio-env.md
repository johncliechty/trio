# 0108 — the ChatGPT (codex) execute seat reported wave 1 "complete" twice with no file changed; execute/fix pinned to Claude for this build; stale TRIO_* env in the launching shell

**Date:** 2026-09-04
**Project:** C:\dev\Skill Foundry\skills\literature-review (Crucible LITE handoff, 5 waves; crucible journal 0093)
**Class:** journal 0106 (a Codex seat on a Claude-shaped execute prompt reports complete with 0 tool calls) — recurred.

## What happened

- **Run 1** (routing `execute=chatgpt-cli · review=claude · fix=chatgpt-cli`, seats from the dashboard: coding=chatgpt, review=claude): execute "complete" after 40 s, **changed nothing**; the E1 guard let it through because the wave section names no missing deliverable; the gate went GREEN on the pre-existing 463 tests; two Claude reviewers (3 calls, 9 permission denials, ~$3.6 subscription-equivalent) then the **vacuous-GREEN HALT** fired correctly ("wave changed no source file reachable by an executed test").
- **Not the sandbox:** a direct `codex exec --sandbox workspace-write -c windows.sandbox="unelevated"` with the driver's exact arguments wrote a file in a scratch dir (PONG and PING.txt smoke tests both rc=0). Codex CAN write here. What it does with Foreman's execute prompt is unrecorded — the codex path emits no per-call "done — N tools" line and keeps no transcript under `.foreman/`, so the 0106 diagnosis still rests on inference. **Owed:** log the codex seat's `rec` (tool calls, file_change items, last agent_message) like the claude path does.
- **Run 2** was launched with `foreman.config.json` `"models": {"execute": "claude:…", "fix": "claude:…"}` — and the routing header STILL said `execute=chatgpt-cli`. The seat env from the dashboard (`TRIO_DRIVER_EXECUTE=chatgpt-cli`) was already set in the launching shell, and "pre-set env always wins" over the config. Killed after the same empty execute.
- **Run 3**: the launching shell's `TRIO_*` scrubbed, `TRIO_DRIVER_EXECUTE=claude` / `TRIO_DRIVER_FIX=claude` exported explicitly. Routing `execute=claude · review=grok-cli · fix=claude` (review went cross-family to Grok because codex refuses verification roles as unattested and Claude was now the author). Execute is using tools and reading source (17+ calls at 3 min). Wave 1 outcome: see EXECUTION-LOG.md in the project.

## The stale environment

The shell this session runs in carried `TRIO_DRIVER_REVIEW=gemini-cli`, `TRIO_DRIVER_SHARK=gemini-cli`, `TRIO_DRIVER_DEBATE=gemini-cli`, `TRIO_DRIVER_REVIEWER=gemini-cli` and `TRIO_MODEL_*="Gemini 3.1 Pro (High)"` — process-level only (not in HKCU/HKLM, no profile sets them; HKCU holds only `CLAUDE_MODEL_EXECUTE/FIX/SYNTHESIZER=claude-fable-5`). They date from the Gemini era (dropped 2026-08-31). Their visible effect: the routing header labelled the Claude review seat `claude:Gemini 3.1 Pro (High)` — the label is read from `TRIO_MODEL_REVIEW` without checking the driver family. Recorded in the session scratchpad; a launcher should scrub `TRIO_*` before exporting the dashboard seats (go.ps1 today sets only `TRIO_DRIVER=gemini-cli` under Antigravity).

## Owed

1. A codex-seat transcript/record line per call (tool calls, file changes) — 0106 is still diagnosed by absence.
2. The routing header must not print a model label from a different family than the driver.
3. Launchers scrub stale `TRIO_*` before applying the dashboard seats (Universal Seating Law: the dashboard, not a forgotten shell, is the source).
4. The Universal Seating Law puts execute on the coding family; until the codex execute path is proven on Foreman's prompt, a build that needs to land should pin execute/fix to Claude explicitly and say so (this build's `foreman.config.json` carries `models_note`).
