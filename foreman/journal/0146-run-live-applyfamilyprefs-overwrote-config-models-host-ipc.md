# 0146 - `run-live.mjs` `applyFamilyPrefsToEnv` Unconditionally Overwrote `foreman.config.json` `models` Pins
id: 0146-run-live-applyfamilyprefs-overwrote-config-models-host-ipc
skill: foreman
situation: Launched `run-live.mjs` on `skills/anvil` with `foreman.config.json` `"models": {"execute": "host-ipc:gemini-4-carbon", "review": "chatgpt-cli:gpt-6-luna"}`, plus plan text referencing `C:/dev/Anchor` as a zero-edit sibling.
context: `C:\dev\trio\foreman\bin\run-live.mjs` (lines 245–268) and `C:\dev\trio\drivers\index.mjs` (`applyFamilyPrefsToEnv`).
observation: Despite `run-live.mjs` line 262 stating `never overrides explicit env or foreman.config.json models block above`, `applyFamilyPrefsToEnv(process.env)` unconditionally stamped `TRIO_DRIVER_EXECUTE = gemini-cli` over `host-ipc`; additionally, `C:/dev/Anchor` in the plan's non-modification clause triggered `[taxonomy:dirty-sibling]` preflight HALT because `DASHBOARD.md` in `Anchor` had uncommitted task state.
outcome: worked - preserved `_configPinnedDrivers` across `applyFamilyPrefsToEnv` in `run-live.mjs` so `foreman.config.json` `models` pins (`host-ipc:gemini-4-carbon`) are honored, and set `FOREMAN_ALLOW_DIRTY_SIBLINGS=1` to record `C:\dev\Anchor`'s pre-run state without touching `C:\dev\Anchor`.
provenance: genuine-execution - Anvil v4 Foreman launch (`2026-11-17T19:19-07:00`).
