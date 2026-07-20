---
id: 0003
skill: researchPrime
---

- **situation**: John asked to wire the existing (built-but-dormant) two-gate machinery into the live flow so the Phase-1 plan is reported to the user one-shot for approve/edit before execution.
- **context**: `bin/two-gate.mjs` Gate-2 hardcoded `planMatrix()` (a generic 4-row boilerplate keyed only on the objective) — NOT the rich Phase-1 plan (`runPhase1`: AXIS/branches/stakes/foresight). `runTwoGateMachine` was referenced only by tests, never by a runtime entrypoint.
- **observation**: made the Gate-2 plan artifact injectable via `buildPlan` (default = planMatrix, so all wave5/7/8 tests stay green); added `bin/plan-gate.mjs` (`buildResearchPlan` + `runPlanReviewGate` + interactive CLI) binding the real Phase-1 plan through the human gate; added SKILL.md "PLAN REVIEW GATE" section (APPROVE/EDIT/ABORT, Node=hash-bound engine gate, no-Node=prose). Gotcha: `adjudicateStakes` axes are `declared_stakes/reversibility/blast_radius/magnitude` (NOT impact/blastRadius) — wrong keys silently adjudicate `low`; fixed the doc example.
- **outcome**: worked — new suite `test/plan-review-gate.test.mjs` 4/4 green; wave5 back-compat 6/6; end-to-end smoke produced hash-bound `governance.json` with the rich plan (AXIS set, no matrix); only pre-existing cross-repo `trio-green` meta-gate still red (sibling Crucible/Foreman trees, unrelated).
- **provenance**: genuine-execution
