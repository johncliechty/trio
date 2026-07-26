---
id: 0007-track-b1-residuals-friction
skill: researchPrime@2026-07-22
situation: portfolio-world-class-track-b1-wave5-residual-journal
context: B-researchprime-bands Foreman W5 · hermetic suite GREEN · NS criterion 6
observation: >
  Track B1 North Star closes process-depth honesty on live intake + run-rounds
  (locked maxRounds/includeAdjudication, CLI maxRounds-only, fail-closed unlocked
  headless, LITE leaner than FULL, no direct governance import on Gate-1 path).
  The following out-of-scope items are intentionally NOT fixed under B1 — journaled
  as FRICTION residuals so they are never silently claimed GREEN:

  1) governor bypass — formal-governor / stakes-governor paths that can still
     thin or bypass band ceremony outside resolveBandRoundBudget are residual;
     B1 only hardens the band-budget + intake-extension path.

  2) resume re-pay — run-rounds resume semantics may re-pay a partial round on
     mid-round HALT; durability is on-disk round protocol, not zero-cost resume.
     Not in B1 NS; do not claim free resume.

  3) Track A path-smoke gaps outside B1 — Track A engine_path census /
     substrate path-smoke gaps beyond the W1 inheritance pins remain residual;
     B1 does not re-prove Track A (NS non-goal).

  4) dual-suite quirks — B-researchprime-bands package suite (Foreman test-command)
     and researchPrime/test/** are separate; GREEN on B1 hermetic suite does not
     re-certify the full RP dual suite. Quirks/cross-suite drift stay residual.
outcome: friction
provenance: genuine-execution
---

Portfolio FRICTION residual census for Track B1 close-out (Foreman W5).
NS criteria 1–5 proven by hermetic suite under Foreman; criterion 6 = suite GREEN
+ this explicit residual journal. Do not treat residuals as fixed.
