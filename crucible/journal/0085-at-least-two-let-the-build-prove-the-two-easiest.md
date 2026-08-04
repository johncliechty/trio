- `id`: 0085-at-least-two-let-the-build-prove-the-two-easiest
- `skill`: crucible@steward-lifecycle-2026-07-31 (FULL · Heavy · cross-family)
- `situation`: Writing a success criterion with a NUMERIC threshold over a SET, when the
  North Star's own statement depends on specific members of that set.
- `context`: Ecgberht steward, North Star v5, criterion 6. Built by Foreman across 22
  waves; the gate went GREEN and SC6 recorded `FEASIBLE`.
- `observation`:

  **SC6 read "One campaign exercises AT LEAST TWO different commissioned skills." The
  build satisfied it with researchPrime + Jumper. Crucible and Foreman — the two skills
  the entire capability is FOR — are both recorded `executor_proven: false`.**

  The North Star statement one paragraph above says the steward "COMMISSIONS
  researchPrime / Gandalf / Crucible / Foreman for stage work", and the user's target
  capability is literally *describe a project → commission a PLAN (Crucible) → say start
  → Foreman executes*. The criterion that was supposed to prove that path instead proved
  the two members that were cheapest to execute. `artifacts/commissionable-skills.json`
  is admirably honest about it — Crucible and Foreman both carry
  `excluded_reason: "executor_not_proven"` and `halt_class: REQUIRES-TRIO-CHANGE` — but
  the SC6 verdict above it reads a bare `FEASIBLE`, and that is the line the gate checks.

  Two failure modes fused here, and both belong in the Stage-2 hardening pass:

  1. **A cardinality threshold over a heterogeneous set is a LOOPHOLE, not a criterion.**
     "At least two of {A,B,C,D,E}" quietly authorizes the build to pick the two with the
     shortest path. When members differ in difficulty AND in importance, the criterion
     must NAME the load-bearing ones: "exercises Crucible AND Foreman" — or, if that is
     genuinely out of reach this cycle, say so in the criterion and let the number cover
     only the remainder.
  2. **The blocker was KNOWN AT PLAN TIME and did not reach the criterion.** The halt
     inventory (built in Wave 5) already classed the gated PLAN/BUILD lane
     (`job_runner.py:574-578`, "inherently FRAGILE — best-effort continuation, not
     guaranteed") as `REQUIRES-TRIO-CHANGE`, and absorbed that class into *any skill whose
     commission path rides a gated lane* — i.e. exactly Crucible and Foreman. The plan
     therefore contained, in a different artifact, the fact that its headline capability
     could not be proven. Nothing forced those two artifacts to be read against each
     other.

  This is the sibling of the hardening law (0080/0081): there, a plan asserted a property
  and shipped it as prose. Here, a plan asserted a CAPABILITY and shipped a criterion
  that a substitute could satisfy. Same defect, one level up.
- `outcome`: friction — plan converged, build went GREEN, and the criterion did not
  cover the capability the North Star exists for; found in post-build review, not by the
  gate
- `provenance`: genuine-execution

## Lesson (one line)

**If the North Star statement names specific actors, a criterion may not abstract them
into a COUNT — name the load-bearing members, and cross-check every "at least N"
criterion against the known-blocker inventory before Stage 2 closes, because the build
will always prove the cheapest N.**
