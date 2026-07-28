# 0081 — Wire hardening-gate into Stage 2 emit (dogfood of 0080)

- **id**: 0081-wire-hardening-gate-stage2-emit
- **date**: 2026-07-27
- **situation**: Steward-tracking Crucible Stage 2 was supposed to dogfood journal 0080
  (`checkPropertyGates` + `renderPropertyGateChecklist`). The gate module and tests
  existed; `stage2.mjs` never imported them. The Stage-2 run reached human-lockable
  without ever running the gate — so a plan that *asserts* durability/honesty could
  still sit at approval with no mechanical checklist forced into the emit path.
- **why**: Same failure class as 0080 itself — "law documented in SKILL.md, not
  enforced by the engine." First real dogfood of the law must close the wire gap
  or the dogfood is fake.
- **action**:
  1. Added `bin/apply-hardening-to-plan.mjs` — detect claims, inject checklist +
     obligation vocabulary, re-check.
  2. `writeDocTrio` now **fail-closed**: injects + runs `checkPropertyGates`
     (`addsSurface:true`); writes `hardening-gate-result.json`; HALTs emit with
     `pending_action=hardening-gate-failed` if still not pass.
  3. Draft path (post-render + post-shark) injects checklist so Sharks/humans see
     obligations before approval; emit path is the hard gate.
  4. Applied the gate to the live steward-tracking IMPLEMENTATION-PLAN-FOR-APPROVAL.md
     and fixed it until pass.
- **outcome**: worked — writeDocTrio fail-closed; steward-tracking plan injected +
  checkPropertyGates **pass:true** (4 claims: durability, idempotence, boundedness,
  containment; failure-state vocabulary present). hardening-gate unit tests 9/9 green.
- **provenance**: genuine-execution
