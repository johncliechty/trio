---
id: 0085-sleep-index-epipe-review-degrade-2026-07-24
skill: foreman@2026-07-24
situation: sleep-index-p0-epipe-and-review-degrade-after-canonical-onboard
context: >
  Canonical onboard product DONE. Day-long thrash root-caused to EPIPE emit
  + ALL transport_failed HALT on GREEN gate. Direct fix (not self-heal via broken engines).
observation: >
  **P0 CLOSED (code + unit + origin/main f672302):**
    · **0082** — flake analysis + full backlog
    · **0083** — sleep residual honesty (EPIPE + ALL-fail not closed by 0075)
    · **0084** — code + tests
    · Foundry mirror: docs/sleep/2026-07-24-foreman-epipe-review-degrade-p0.md

  **Still open (do not re-open closed P0):**
    · Heartbeat mid-agent (P0 UX residual)
    · Vacuous resume / proven ledger auto-write (P0 partial from 0076)
    · Wave-scoped gates (P1 speed)
    · Crucible Stage-2 silence (crucible 0075)

  **Rule:** re-vendor share packages after this commit before external handoff —
  prior clean-ship pinned d355809 without these fixes.
outcome: fixed
provenance: genuine-execution
---

P0 EPIPE + review:degraded GO landed and pushed. Next sleep candidate is Crucible Stage-2 durability / heartbeat, not re-litigating emit.
