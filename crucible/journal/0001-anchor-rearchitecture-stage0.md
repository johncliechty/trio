# 0001 — anchor-rearchitecture-stage0

- id: 0001
- skill: crucible
- situation: Stage-0 (Intake & Framing) only, brownfield, for the Anchor re-architecture
  (Butler substrate) at C:\dev\Anchor; HALT at the North-Star lock per protocol.
- context: 18,441-line anchor_gui.py monolith; four pillars (frontend extraction, route
  table + declarative auth, event-log spine, supervisor split) from the 2026-07 review's
  Task 8; hard constraints stdlib-only / NSSM :8777 / incremental.
- observation: Tiered ingest via one Explore sub-agent (line-level archaeology of the
  monolith) + direct reads of paths/job_runner/terminal_session/CLAUDE.md worked well —
  all four pillars grounded Confirmed, 4 genuine Gaps surfaced (ConPTY-across-processes,
  GET-page browser auth, event taxonomy, healthcheck seam). Triage recommended FULL with
  an in-pipeline spike wave rather than SPIKE-FIRST. Engine not run (protocol-driven
  in-session Stage 0); artifacts written to
  C:\dev\Anchor\planning\crucible-rearchitecture-2026-07\.
- outcome: worked
- provenance: genuine-execution
