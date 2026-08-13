---
id: 0089-replacement-must-name-the-deletion
skill: crucible@2026-08-13
situation: >
  A plan introduces a NEW surface intended to replace an existing one, and specifies
  every wave of building the new — but never specifies the wave that DELETES the old.
  The old surface stays in the tree, keeps running, and wins.
context: >
  Anchor steward-chamber campaign (12 waves, 2026-08-09 → 08-11, all GREEN, gate
  1135/1135, cross-family adversarial review 0 blockers). The campaign's entire
  purpose was replacing a fragmented steward interface with one M1 flow surface.
  Discovered 2026-08-13 by John opening the product and saying it looked unchanged.
observation: >
  The plan's phases ran substrate → painted slice → rail → talk → close → audit →
  tile retirement. It specified the M1 slice (W6 "painted M1 vertical slice",
  W7 "verbatim M1 mount + DOM-diff kill gate"), the interactive surfaces on top
  (W8-W11), and the retirement of the bottom run TILES behind a signed parity gate
  (C11, W12). It never specified replacing `_ecgRenderChamber` — the v0 chamber
  dialogue that occupies the same screen region.

  The live code paints the M1 slice, then hydrates the v0 chamber, then calls
  `_ecgSealDropSlice()` — deleting M1 from the document. The comment reads
  "the interactive chamber has hydrated — the W6 slice yields". The W6 pattern
  (deterministic-first paint yields to the interactive surface) is sound; it
  silently assumed the interactive surface would BE M1. Nobody wrote that wave,
  so the yield became a rollback to July code, on every open, for the campaign's
  entire life.

  Crucially the campaign DID have this discipline — for tiles. C11 gated tile
  retirement on a signed affordance-parity map, and W12 built the inventory, the
  gate and the refusal-by-name. The exact same reasoning was never applied to the
  chamber the tiles sit beside. The plan knew "removing an old surface needs a
  parity gate" and applied it to the smaller of the two replacements.

  Why no gate caught it: C9's DOM diff asserts the slice's MARKUP matches the
  hash-pinned mockup. It never asserts the slice is still in the document after
  hydration. Correct markup on a doomed element passes. The <2s open budget
  measures the paint that is discarded. Every criterion was satisfied by an element
  that does not survive to steady state.
lesson: >
  (1) A PLAN THAT INTRODUCES A REPLACEMENT MUST NAME THE DELETION AS A DELIVERABLE.
  "Build X" and "X supersedes Y" are two claims; only the first was in the plan.
  Stage 2 should refuse a plan where a new surface, module or route is described as
  replacing an existing one and no wave deletes the existing one. The deletion is
  not cleanup to be done later — later never arrives, and meanwhile the old code is
  not inert, it is COMPETING.

  (2) CO-EXISTENCE IS A DECISION, NOT A DEFAULT. If both are meant to live (a
  fallback, a flag, a migration window), the plan must say so, say for how long,
  and name the removal wave. Unstated coexistence resolves at runtime by whichever
  code path happens to run last — an ordering nobody designed.

  (3) THE ACCEPTANCE ORACLE MUST BE THE STEADY STATE. For any placeholder→hydrate
  handoff, the criterion is not "the new surface renders" but "the new surface is
  what remains, and the old is absent". Write it as a test that asserts BOTH:
  new-present AND old-absent. Markup fidelity on an element that gets removed
  proves nothing, and will pass every review.

  (4) APPLY A PARITY GATE TO EVERY REPLACEMENT, NOT THE MEMORABLE ONE. This plan
  invented an excellent mechanism — inventory every affordance, map each to an
  equivalent or a signed loss, gate deletion on the signature — and used it on the
  tiles while the larger replacement beside them had no gate at all. When Stage 1
  identifies a superseded thing, every superseded thing inherits the gate.

  (5) A CI GUARD SHOULD MAKE THE RETURN OF DELETED CODE A NAMED FAILURE. Deletion
  without a guard is reversible by accident. The replacement wave should land a test
  that fails by symbol name if the replaced surface reappears.
outcome: >
  Cause identified and journaled (Ecgberht 0083, 6b195c0). A three-wave remediation
  plan is written (Anchor planning/chamber-m1-replace-2026-08-13): inventory + a
  steady-state kill gate landed RED, re-home interactivity onto M1, then DELETE v0
  behind a CI replacement guard. Note the shape: the remediation needs three waves
  because the deletion cannot precede the parity proof — cost the original plan
  would have paid once, cheaply, had it named the deletion at Stage 2.
provenance: genuine-execution
---

# 0089 — a plan that replaces a surface must name the deletion

Twelve waves built a new steward chamber. None of them removed the old one. The
old one is still what the user sees.

The failure is not in the building — the new surface is real, verbatim to its signed
mockup, and paints in under two seconds. The failure is that "replace" was never
written down as a deliverable. The plan said build M1; it never said delete v0. So
v0 stayed, kept its call site, hydrated after M1, and removed M1 from the document
on every single open. For the entire life of the campaign the product showed the
pre-campaign surface, and every gate agreed it was fine.

What makes this worth a journal rather than a bug report is that the plan already
contained the cure. C11 gated *tile* retirement on a signed affordance-parity map —
inventory every capability, map each to an equivalent or a named loss, refuse
deletion until John signs. That is exactly the right instrument. It was pointed at
the bottom tiles and not at the chamber those tiles sit beside, which was the larger
replacement by far.

So the Stage-2 rule is narrow and mechanical: **if the plan says a new thing
supersedes an old thing, some wave must delete the old thing, and the acceptance
test must assert the old thing is absent.** Not "the new thing renders" — that was
true here throughout, and meant nothing.
