# 0147 - HTTP/2 `GOAWAY` (`server_shutting_down`) Mid-Stream on 22k-Token Subagent Monologue; Chunked One-File-Per-Turn Rule
id: 0147-http2-goaway-chunked-per-file-subagent-turns
skill: foreman
situation: `Foreman Wave 1 Execute Seat` (`c05fc0ff`) dropped mid-turn with `http2: server sent GOAWAY and closed the connection; debug="server_shutting_down"` while `run-live.mjs` waited on `execute:w1` (`req-6df76fb3`).
context: `C:\dev\Skill Foundry\skills\anvil\.foreman\ipc\req-6df76fb3-dd38-48da-b778-2b6f18d15d1b.json` and `host-ipc` seat execution.
observation: In step 23, `c05fc0ff` generated `22,619` output/thinking tokens in a single 6-minute HTTP/2 stream designing all 5 Wave 1 files before writing any code to disk, leaving a 4.5-minute open stream vulnerable to upstream rolling-deploy `GOAWAY`. Because `host-ipc` decouples the Node orchestrator (`run-live.mjs`) from subagent transport, `run-live.mjs` survived intact.
outcome: friction - refreshed `hb-<id>.json` + `seat-heartbeat-execute-w1.json` and spawned a fresh recovery seat with a strict one-file-per-turn (`<=400` lines, `<60s` stream) rule so rolling HTTP/2 `GOAWAY` events cannot abort multi-minute turns.
provenance: genuine-execution - Anvil v4 Foreman Wave 1 recovery (`2026-11-17T19:35-07:00`).
