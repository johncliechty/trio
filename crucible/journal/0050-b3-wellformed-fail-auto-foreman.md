---
id: 0050-b3-wellformed-fail-auto-foreman
skill: crucible@2026-07-22
situation: stage2-cap-wellformed-fail-and-object-object-draft
context: >
  Track B3 jumper bands LITE Stage-2 + launcher auto-Foreman
  C:\dev\plans\2026-07-22-portfolio-world-class\B3-jumper-bands 2026-07-22
  Program F019. Corroborates 0039/0047-track-b2/0048.
observation: >
  Stage-2 Shark DRY (0 formal, 20 findings), Judge NOT_CONVERGED, not-lockable;
  revise JSON fail → retry → 10 changes; round-cap. Well-formedness gate FAIL
  (exit 3); real emit only under _unapproved-cap-draft (~11k plan). Root
  IMPLEMENTATION-PLAN-DRAFT.md again 15-byte [object Object] (draft serialization).
  Launcher still auto-accepted drafts, promoted recovered IMPLEMENTATION-PLAN.md,
  wrote foreman.config.json, exit 0; Foreman started W1/6 with --reviewers 1.
  Sleep: (1) fix Stage-2 draftToText / emit so root never String(object);
  (2) well-formedness FAIL must refuse auto-Foreman (exit non-zero, no promote);
  (3) optional human gate when Judge NOT_CONVERGED even if Shark DRY.
outcome: friction
provenance: genuine-execution
---

Sleep cluster (highest priority for portfolio LITE path): object-serialization +
auto-handoff past well-formedness FAIL. Seen A + B1 + B2 + B3. Session recovery is
workaround only — engine must fail closed.
