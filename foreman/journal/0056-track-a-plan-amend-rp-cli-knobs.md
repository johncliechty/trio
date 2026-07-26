---
id: 0056-track-a-plan-amend-rp-cli-knobs
skill: foreman@2026-07-22
situation: plan-amendment-halt-falsified-cli-surface
context: >
  Track A Wave 4 "researchPrime Gate-1 extension + run-rounds"
  live trio researchPrime bin, 2026-07-22
observation: >
  Frozen plan claimed CLI override for maxRounds AND includeAdjudication.
  Live run-rounds + intake resolveBandRoundBudget: only maxRounds has explicit
  CLI/env (--max-rounds / RESEARCHPRIME_MAX_ROUNDS); includeAdjudication always
  from extension knobs or default true — no CLI flag. Wave smoke already documented
  real contract; frozen GWT still claimed dual CLI. Foreman PLAN-AMENDMENT HALT.
  Session amended plan; resume. Immediately after re-execute with plan-only touch,
  vacuous-GREEN HALT fired (wave changed only IMPLEMENTATION-PLAN.md) — see 0057.
  Candidate: after plan-amend clear-halt, re-entry must re-prove gate without
  counting plan-doc-only execute as wave proof (known 0045/0046 family).
outcome: friction
provenance: genuine-execution
---

Sleep cluster: plan-amend for over-claimed CLI/API; chain into vacuous-GREEN on resume.
