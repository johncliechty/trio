---
id: 0039-track-a-best-draft-object-serialization
skill: crucible@2026-07-22
situation: stage1-cap-handoff-draft-serialization
context: >
  Portfolio Track A verify-substrate LITE
  (C:\dev\plans\2026-07-22-portfolio-world-class\A-verify-substrate)
  launch-crucible-lite.mjs Stage-1/2 handoff 2026-07-22
observation: >
  On stage1-round-cap, e.best_draft is an object (or non-string). Session launcher
  wrote String(e.best_draft) → MASTER-PLAN.md body "[object Object]" (15 bytes).
  Stage-2 then received a garbage masterPlan until artifacts/BEST-DRAFT.md (engine-
  persisted prose, ~11KB) was copied. IMPLEMENTATION-PLAN at project root also got
  the same bug on Stage-2 path until _unapproved-cap-draft/IMPLEMENTATION-PLAN.md
  was promoted. Candidate Foundry fix: stage1/stage2 persist helpers must always
  emit markdown string paths; any external launcher must use draft.markdown|text|
  BEST-DRAFT.md never String(object). Corroborates class of handoff-artifact honesty.
outcome: friction
provenance: genuine-execution
---

Sleep cluster: handoff artifact serialization. Engine already writes BEST-DRAFT.md —
public handoff must prefer that over String(cap error bag).
