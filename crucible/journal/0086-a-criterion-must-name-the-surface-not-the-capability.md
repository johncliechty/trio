- `id`: 0086-a-criterion-must-name-the-surface-not-the-capability
- `skill`: crucible@steward-lifecycle-2026-07-31 (FULL · Heavy · cross-family)
- `situation`: a success criterion states a user capability without naming the surface the user reaches it through
- `context`: Ecgberht steward North Star v5. Criterion 1 and criterion 14 both passed;
  the user then could not do the thing either criterion describes.
- `observation`:

  **SC1 reads: "A spoken description produces a PROPOSED multi-stage scaffolding (coarse
  steps + Oranges annotations), batch-confirmed; zero chat turns persisted."** Every
  clause is satisfied by the engine and proven by T-HOST-0 — which reaches the capability
  by importing `proposeScaffolding` and calling it. The criterion never said WHERE the
  spoken description is spoken, so the build satisfied it at the only layer it named: the
  function.

  The user speaks into the seal chamber. The chamber compiles utterances through a closed
  ELEVEN-act table which has no scaffolding act, and the bridge behind it exposes
  `--speak/--recall/--stand-up-confirm/--not-now` and no scaffold command. So the sentence
  "a spoken description produces a proposed scaffolding" is true of the engine and false
  of the product, and the criterion cannot tell those apart.

  **This is the same defect as 0085 one turn further out.** There, a criterion abstracted
  named actors into a COUNT ("at least two skills") and the build proved the two cheapest.
  Here, a criterion abstracts the SURFACE into a capability ("a spoken description
  produces…") and the build proved it at the cheapest surface — a function call. In both
  cases the criterion was satisfiable in a way that left the North Star's actual sentence
  unmet, and in both cases Stage 2 had every fact needed to notice.

  **The fix is a Stage-2 rule, and it is small.** For every criterion of the form "a user
  can X", the criterion text must name the ENTRY SURFACE and the acceptance test must
  start there:

  > SC1 (repaired): *Typing a project description INTO THE SEAL CHAMBER — i.e. through
  > the same bridge/act path Anchor calls — produces a proposed multi-stage scaffolding…
  > Proven by a test that spawns the bridge with argv, not by one that imports the
  > compiler.*

  Sibling of the hardening law (0080/0081): there, a plan that ASSERTS a property must
  EMIT a mechanical gate for it. Here, a plan that CLAIMS a user capability must NAME the
  surface and emit a walkthrough at that surface. A capability with no named surface is
  prose, exactly like a durability claim with no concurrency test.
- `outcome`: friction — plan converged, build went green, two criteria were formally met
  and practically unmet; found by the user in first real use
- `provenance`: genuine-execution

## Lesson (one line)

**Write every user-facing criterion as "through SURFACE S, the user can X", and require
its acceptance test to enter at S — a criterion that names only the capability will be
satisfied at whatever layer is cheapest to test, which is never the one the user
touches.**
