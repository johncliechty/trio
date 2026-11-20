# 0113 - Host-IPC `timer.unref()` Unsettled Top-Level Await & Pytest-Polluted Mirror Prefs
id: 0113-host-ipc-unref-sleep-unsettled-await-and-pytest-mirror-prefs
skill: crucible
situation: Launched `runMatrixFastTrack` (`--matrix-fast-track`, Heavy cross-model) for Anvil v4 with `synthesizer` routed to `host-ipc` (`gemini-4-carbon`) and `shark` routed to `chatgpt-cli` (`gpt-6-luna`).
context: `C:\dev\trio\drivers\{host-ipc.mjs,model-policy.mjs}` and `C:\dev\Skill Foundry\planning\anvil-v4-2026-11-17`.
observation: Two startup frictions surfaced: (1) `~/.anchor/model_prefs.json` had been overwritten by a prior `pytest-5313` test fixture pointing `review_family` to `claude` while `claude` CLI OAuth was logged out (`loggedIn: false`); (2) `sleep()` in `drivers/host-ipc.mjs` called `timer.unref()` while `defaultRunHostIpc` actively awaited `sleep(100)`, causing Node v26.1.0 to exit early with `Warning: Detected unsettled top-level await` when no other ref'd handle was open.
outcome: friction - isolated `ANCHOR_SETTINGS_DIR` to pin verified live families (`coding_family: gemini` `gemini-4-carbon` high, `review_family: chatgpt` `gpt-6-luna` high) without mutating `~/.anchor/model_prefs.json`, and held a ref'd `setInterval` keepalive across `runMatrixFastTrack` until completion (`host-ipc.mjs` `sleep()` should keep poll timers ref'd unless `unref: true` is passed).
provenance: genuine-execution - Anvil v4 Crucible Matrix-Fast-Track run (`2026-11-17T18:39-07:00`).
