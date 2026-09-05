# 0097 — RC-8, the wave-count question, added to the Stage-2 elegance pass

**Date:** 2026-09-05 · **Asked by John:** "Add the wave-count check (RC-8) to the stage-2 pass"

## Why

The first dogfood of the engine-level elegance pass (the Anchor reports-links plan, journal 0095) judged
28 wave deliverables — keep 25, hold 3, cut 0 — and let SEVEN waves for three real changes through
unchallenged. The battery judged elements; nothing asked whether each wave was a change a reviewer would
want to see alone. The steward merged the waves by hand (parser+renderers, registrar+hooks, shell+link).

## What is built

- `drivers/elegance-pass.mjs` `runWaveCountCheck`: the steering seat proposes merges of ADJACENT waves
  that are one change (a parser without its renderer, a module without its hooks, a backend that exists
  only for one link, a wave whose gate needs the next wave to be tested); the adversary (the other
  family) disputes; a MAJOR/BLOCKER dispute drops the merge. Malformed merges (non-adjacent, overlapping,
  out of range) are dropped before the adversary sees them. RC-8 text joins `RC_BATTERY`.
- `crucible/bin/elegance-hooks.mjs` `applyWaveMerges` (pure: deliverables and scenarios concatenated,
  done-when joined, numbering and the serial dependency chain rewritten) and `runWaveCountPass` (asks,
  applies only the undisputed merges, writes `ELEGANCE-RC8-stage2.md` + json, says "every wave stands
  alone" aloud when nothing merges); `waveCountSection` rides the Shark draft.
- `stage2.mjs`: phase `stage2-wave-count` right after the element pass, before hardening and the Sharks.
- `Skill Foundry/ELEGANCE.md` Part II carries RC-8 (the canonical text); `crucible/SKILL.md` says it.

Tests: `drivers/test/elegance-pass-rc8.test.mjs`, `crucible/test/elegance-rc8.test.mjs`.

## What it does not do

It never splits a wave, and it merges only adjacent waves. A decomposition whose one-change halves are
not adjacent is the decomposer's defect, and the Sharks still see the whole list.
