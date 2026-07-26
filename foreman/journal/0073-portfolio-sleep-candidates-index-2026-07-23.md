---
id: 0073-portfolio-sleep-candidates-index-2026-07-23
skill: foreman@2026-07-23
situation: portfolio-world-class-sleep-feed-index-refresh
context: >
  Program C:\dev\plans\2026-07-22-portfolio-world-class through B7 W4 resume
  (2026-07-22 night + 2026-07-23 morning). Supersedes index snapshot 0065 with
  B3–B7 closeouts and new P0 death cluster. Program FRICTION F001–F039.
observation: >
  Canonical Foreman sleep tickets (genuine-execution) — priority order for next
  Foundry sleep/improvement round:

  **P0 — F-H silent mid-wave process death (NEW):** 0072 · F036–F039 · B7 W4.
  run-live dies with empty stderr after banner and/or after GREEN gate before
  review; checkpoint stuck; orphan lock; zero-byte mid-write on crash. Blocks
  formal DONE even when product gate is 19/19 GREEN.

  **P1 — F-C vacuous-GREEN / gate-not-bound:** 0057, 0066 (B3 SC5), family 0045/0046.
  **P1 — F-F Windows `node --test test/` under-gate:** every portfolio pair uses
  explicit file lists as workaround; Stage-2 must not emit dir globs (0038/0039/0047).
  **P2 — F-A dual HALT shapes (headless unlock):** 0055.
  **P2 — F-B plan-amend RP CLI fiction (includeAdjudication):** 0056.
  **P2 — F-D EXECUTION-LOG lag (status log is SoT):** 0058 / program F007.
  **P2 — F-E governance import direct vs transitive:** 0060, 0061.
  **P2 — F-G recovered unapproved-cap-draft handoff (session promote):** 0064 + all
  B* Stage-2 [object Object] pairs — root cause is Crucible emit; Foreman gets
  garbage plan if session does not promote.

  Closeouts (worked): 0059 A, 0062 B1, 0063 B2, 0067 B3, 0069 B4, 0070 B5, 0071 B6.
  B7 formal DONE blocked by F-H (0072) as of 2026-07-23 ~06:51 despite GREEN gate.

  Permanent engine fixes only via Foundry sleep — no mid-run freelancing of
  foreman/bin. Operator may --resume and promote plans; may not patch run-live.
outcome: friction
provenance: genuine-execution
---

Next sleep round should open with **0072 (F-H process death)** then vacuous-GREEN
and Windows test-command. Pair with crucible journal 0063 sleep index for the
Stage-1/2 serialization + auto-approve cluster.
