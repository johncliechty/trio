# JUDGE RULING — round 1 (context-free)

## Per-finding
- F-1 UPHELD: 2 independent origins, CORROBORATED-by-opinion, 0 OBSERVED. Sits below R2's code reads.
- F-2 UPHELD: hazard = parallel MUTATION of a shared under-specified DECISION surface, not "coding". Both reviewers converge (>=2-agree).
- F-3 OVERTURNED as a GATE: disjoint-write-set is post-hoc (write-set is an execution OUTPUT); worktree isolation names machinery that DOESN'T EXIST. Concept survives as a DEFINITION of safety; not checkable ex-ante for write-work.
- F-4 UPHELD-WITH-MODIFICATION: Branch 2 PROMOTED to OBSERVED-safe. Branch 1 OVERTURNED to OUT (no merge machinery; relocates conflict). Branch 3 OVERTURNED to TRAP (boolean gate can't rank; breaks immutability baseline). Branch 4 OUT (upheld).
- F-5 UPHELD-WITH-MODIFICATION: frozen plan/trusted gate/configurable fan-out TRUE; "worktree-capable hygiene" FALSE (one linear branch, per-file staging, no merge).

## Conflict resolved
R1 (theoretical: tally-ordering could break >=2-agree) vs R2 (OBSERVED: collectFindings keys by content id + reviewer Set -> order-independent). WINNER: R2 decisively. OBSERVED > CLAIMED. Concurrent reviewers do NOT break >=2-agree.

## Per-recommendation
- Rec 1 concurrent reviewers: SHIP. OBSERVED-safe. Condition: reviewers stay strictly read-only; merge keys on content-stable ids. Caveat: LOW value (REVIEW not the bottleneck).
- Rec 2 disjoint-write-set + worktree: DO-NOT-SHIP. Post-hoc gate + absent machinery.
- Rec 3 speculative fan-out: DO-NOT-SHIP. Boolean gate can't rank; breaks immutability; per-subscription quota.
- Rec 4 keep pipelining out: SHIP (uncontested).
- Rec 5 reword rule: SHIP-IF-CONTAINED. Keep an UNCONDITIONAL bright line (Schelling fence), not a menu of opt-in relaxations.

## AXIS answered
YES exactly one mechanically-checkable relaxation, via a DIFFERENT mechanism than proposed: Branch 2 qualifies by READ-ONLY-BY-CONSTRUCTION (the work class has NO write-set, so nothing to conflict on; merge provably order-independent). Every relaxation that lets two units WRITE re-enters the conflict zone and fails "mechanically checkable" (only available check = post-hoc write-set; only available gate = boolean GO, can't adjudicate semantic decision-consistency). Boundary is REAL but NARROW: safe-and-gateable exactly where parallel units are read-only-by-construction.

## NEW finding (convergence test -> warrants 1 more round)
N-1: the relaxation's economic ceiling is set by QUOTA TOPOLOGY, not code topology. Any EXECUTE-parallel relaxation spends from ONE shared per-subscription window -> N coders serialize on quota + drain N× faster; the "cut wall-clock" half of the AXIS win-condition is UNMEETABLE for write-work on this harness REGARDLESS of conflict-safety. Distinct conclusion neither doc drew. Open Q for round 2: does read-only REVIEW fan-out draw from the same window? Is any work class both write-producing AND off the critical quota path?
