# 0094 — a LITE run for a ~60-line change: seven elements in, none parked; the plan's shape was already known from a 20-minute read

**Date:** 2026-09-05
**Effort:** C:\dev\Anchor\planning\chatgpt-terminal-2026-09-05 (ChatGPT as a first-class Terminal engine in Anchor)
**Seats:** drafter Claude, Sharks/Judge Grok (attested via JSON since 2026-09-04). LITE band auto-applied.
**Asked by John (2026-09-05):** "elegant and not overbuilt … do an independent review of the plan and effort and journal about what Crucible and Foreman are doing … put out the rabbit catcher."

## What Crucible did

- Stage 1 LITE brainstorm (2.5 min): 7 ideas, 5 assumptions, 3 failure modes. **Triage integrated all 7 and parked 0** —
  the batch triage in the LITE band has no Rabbit-Catcher pass of its own; every idea that "serves a criterion" is
  integrated, and every one of these did serve a criterion I had written that morning (RC-1's warning: a record
  authored by the proposer is not an independent need).
- Phased plan (3.5 min): **4 phases, 23 near-term specifics** — for a change whose whole surface is one deleted guard,
  one widened set, one capability status, one Doctor flag, one accounting condition, and the tests that pinned the
  old truth (REVIEW-FABLE-2026-09-05.md §1).
- Shark round on Grok (in flight at the time of writing); Stage 2 would have decomposed 5 waves as it did for the
  literature-review build two days earlier.

## What the Rabbit-Catcher said about the seven (REVIEW-FABLE §2)

KEEP 2 (the gate + truth tables; the tests), CUT 3 (a per-backend launch-argv TABLE for one backend; a generalized
`usage_unmeasured_segments` SCHEMA where extending the existing flag's condition suffices; a seed-timing gate whose
"datum" was my own risk-table assumption and which the code contradicts), HOLD 1 (`--no-alt-screen` / sandbox flags —
no one has seen the render break; trigger = the on-screen proof), and 1 reshaped (a "sign-off wave" with a
live-spawning `importorskip` test in the suite — the exact hazard that once leaked 8,816 sessions — becomes the proof
I run by hand under the verification law).

## The lesson (a mechanism, not an instruction)

1. **The LITE band needs the battery at triage, not only at plan approval.** Part II says the FULL battery runs at
   plan approval; but by then a LITE run has already spent the round. Owed: `stage1` triage in LITE runs RC-1/RC-2
   per idea with the North Star's criteria marked by author (user-ratified vs proposer-written), and parks anything
   whose only need is a criterion the proposer wrote.
2. **A "size" signal Crucible ignores:** the baseline context named every file:line the change touches. When the
   intake can enumerate the edits, the plan is the edit list; Crucible should say "this is a one-wave change" and
   stop, the way triage says "DEFAULTED — could not size" when it cannot.
3. **Foreman for one wave is the orchestrator's cost without its product.** Its two products — an independent gate
   and a cross-family review — are a pytest command and a Grok read of the diff. (foreman journal 0110.)

## Outcome

The cut plan (one wave) went to a Grok adversarial review before anything was built; the build followed the cut
plan, not the four phases. The Crucible artifacts stay on disk as the record of what the ceremony produced.
