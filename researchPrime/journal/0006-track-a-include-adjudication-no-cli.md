---
id: 0006-track-a-include-adjudication-no-cli
skill: researchPrime@2026-07-22
situation: portfolio-world-class-track-a-wave4-plan-amend
context: A-verify-substrate Foreman W4 · resolveBandRoundBudget · run-rounds
observation: >
  Frozen plan GWT claimed CLI override for both maxRounds and includeAdjudication.
  Live resolveBandRoundBudget only honors explicit maxRounds (--max-rounds /
  RESEARCHPRIME_MAX_ROUNDS); includeAdjudication always from extension knobs or default
  true — no CLI flag. Foreman build-time probe HALTed PLAN-AMENDMENT (honest). Plan
  amended to match live API; do not invent CLI surface mid-run. Adding --include-adjudication
  would be a real product change (Foundry cycle), not a green-wash.
outcome: friction
provenance: genuine-execution
---

Portfolio FRICTION-JOURNAL F006. Phase 2a band-thin (0005) still valid; this is plan/API honesty.
