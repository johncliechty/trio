---
id: 0101-gate-command-must-be-a-test-runner-not-an-audit-script
skill: foreman@2026-08-11
situation: A Crucible-handed plan declares its ground-truth gate as a bespoke checker script rather than a test runner
context: collapse-deck build (C:\dev\plans\2026-08-11-collapse-deck\deck) — 7-wave PowerPoint build, Standard tier
observation: >
  Wave 1 executed WELL (validator green on 78 ledger entries, smoke deck round-tripping,
  audit passing) and then HALTed vacuous-GREEN: the plan's declared testCommand was
  `python audit_deck.py`, which prints "GATE x: PASS" and exits 0 but emits no
  tests/pass/fail counts, so the ground-truth gate correctly refused to certify the wave.
  The HALT was RIGHT and cost one wave (~$6.26 subscription-equivalent, 61k output tokens)
  to discover something Stage 2 could have caught for free. Two fixes, both cheap:
  (1) CRUCIBLE-SIDE — Stage 2 should validate that the declared testCommand is a recognized
  runner (pytest/node --test/go test/…) or that the plan ships an adapter emitting counts;
  a bespoke "audit script" as testCommand is a plan defect, catchable by locate-plan or a
  Stage-2 lint, not at build time. (2) FOREMAN-SIDE — the vacuous-GREEN halt message is
  good but could name the fix concretely ("wrap the checker in pytest so counts are
  emitted"), since that is nearly always the remedy.
  Resolution here: the audit logic was kept and re-exposed as real pytest tests
  (test_deck.py, 22 tests) with audit_deck.py retained as the human-readable report —
  gate then emitted true counts. Worth noting the discipline paid off downstream: those
  real tests immediately caught three genuine honesty defects (declared invariants that
  existed only inside chart images, never in parsed slide text) and a builder/audit
  truncation-constant divergence.
outcome: friction
provenance: genuine-execution
---
