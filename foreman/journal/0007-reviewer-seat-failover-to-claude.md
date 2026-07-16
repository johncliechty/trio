# 0007 — Reviewer seat failover: gemini → claude (operator decision, John 2026-07-16)

**What happened:** the researchPrime 13-wave build HALTED at wave 1/13 at 10:05 —
"review transport HALT: ALL 1 reviewer(s) unreachable/unparseable". Root cause: the agy CLI
changed its output behavior; Foreman's committed `drivers/driver-gemini.mjs` (stream-json frame
parser) can no longer parse replies. This is the same failure that motivated the hand-rolled
transcript-scraping rewrite reverted on 2026-07-16 (sibling-reply misattribution + >32KB argv +
lost `model_served` attestation — see journal 0003 and the 2026-07-15 portfolio review).

**Operator failover (per C:\dev\AGENTS.md §3, locked 2026-07-16):** re-invoke with
`TRIO_DRIVER_REVIEW=claude` (env-level operator choice, NOT an engine patch) so the build
continues on the available family. Consequence, stamped honestly: reviewer waves run same-family
(`cross_model: false`) until the permanent fix lands.

**Permanent fix (queued, front of the repair plan):** Item C of
`C:\dev\plans\2026-07-16-trio-foundry-repair-addendum\CRUCIBLE-INTAKE-ADDENDUM.md` — route
Foreman's Gemini seat through the canonical agy-dispatch seam (never-hand-roll rule), with driver
tests (today no test imports the driver). Flip the seat back to gemini when it lands.
