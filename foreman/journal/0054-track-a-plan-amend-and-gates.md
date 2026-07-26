---
id: 0054-track-a-plan-amend-and-gates
skill: foreman@2026-07-22
situation: portfolio-world-class-track-a-foreman
context: A-verify-substrate LITE 6-wave build · plan amendments · Windows host
observation: >
  (1) locate-plan HALT on test-command `node --test test/` (Windows Node known-broken);
  fixed with explicit test file list + scaffolds. (2) Wave 2 PLAN-AMENDMENT: headless
  resolveStage0TriageLock throws TRIAGE_HEADLESS_UNLOCKED without halt_for_human fields
  while assessComplexity has full HALT shape — dual fail-closed surfaces; session amended
  plan GWT, --resume --clear-halt, W2 GREEN. (3) Wave 4 PLAN-AMENDMENT: includeAdjudication
  has no CLI; only maxRounds is CLI/env overridable — plan over-claimed dual CLI override;
  amended + resume. (4) EXECUTION-LOG stayed empty while _foreman-status.log was truth —
  observability friction. Honest HALTs (no silent replan) are working as designed.
outcome: friction
provenance: genuine-execution
---

Portfolio FRICTION-JOURNAL F004–F007. Waves 1–3 GO before W4 amend; gate counts grew 12→19→27→35.
