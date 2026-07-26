---
id: 0055-track-a-plan-amend-dual-halt-shapes
skill: foreman@2026-07-22
situation: plan-amendment-halt-falsified-gwt-api-probe
context: >
  Track A A-verify-substrate Wave 2 "Crucible Stage-0 depth lock path"
  after W1 GREEN, 2026-07-22
observation: >
  Build-time probe of live already_wired API: resolveStage0TriageLock({headless:true})
  throws TriageHeadlessHaltError code=TRIAGE_HEADLESS_UNLOCKED with halt_for_human/
  pending_action undefined (matchesUnlockedHaltContract===false). assessComplexity
  still carries frozen HALT shape (halt_for_human + confirm-complexity-band).
  Frozen plan GWT assumed ONE unlocked/headless field shape for every path.
  Foreman correctly PLAN-AMENDMENT-PROPOSAL HALT (no silent replan). Session applied
  dual-surface GWT to IMPLEMENTATION-PLAN, --resume --clear-halt; W2 re-proved GREEN
  19/19. Candidate: keep plan-amend honesty; optional later Foundry change to stamp
  halt fields on headless unlock errors only via formal cycle — not mid-run.
outcome: friction
provenance: genuine-execution
---

Sleep cluster: PLAN-AMENDMENT when frozen GWT ≠ live API (fail-closed shapes).
Corroborates 0009-class plan-amend halts; probe-before-green is load-bearing.
