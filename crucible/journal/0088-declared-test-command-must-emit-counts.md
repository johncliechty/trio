---
id: 0088-declared-test-command-must-emit-counts
skill: crucible@2026-08-11
situation: Stage-2 emits a plan whose declared testCommand is not a real test runner
context: collapse-deck (C:\dev\plans\2026-08-11-collapse-deck) — Stage 2 LITE handoff to Foreman
observation: >
  Stage 2 declared `python audit_deck.py` as the gate. Foreman's ground-truth gate refuses
  vacuous GREEN (exit 0 with no test counts), so the build HALTed at wave 1 after real work
  had already been done — a plan defect discovered at build cost rather than plan cost.
  The hardening law already forces "a property asserted must emit a mechanical gate"; this
  is its sibling: THE DECLARED GATE MUST BE MACHINE-COUNTABLE. Proposed Stage-2 check
  (cheap, pure): if testCommand does not match a known runner (pytest / node --test /
  go test / cargo test / jest / …), require the plan to name the adapter that emits
  counts, else HALT at emit time. This would have cost zero and saved a wave.
  Also confirms 0087's thesis from the other side: the expensive failures in this pipeline
  were CONFIGURATION defects (tier inherited Heavy, gate not a runner), not reasoning
  defects — the planning content itself was strong and survived unchanged into the build.
outcome: friction
provenance: genuine-execution
---
