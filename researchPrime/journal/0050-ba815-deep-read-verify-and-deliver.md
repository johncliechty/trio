---
id: 0050
skill: researchPrime
situation: Commissioned (Anchor/Ecgberht unattended session) for roadmap step "Deep read of the drop
  (Gandalf heavy)" on the BA 815 revamp project — after TWO Gandalf commissions completed full verdicts
  on disk but went quiet without handing back.
context: Chose verify-and-deliver over re-read — B1 mtime census proved the drop unchanged, then every hard
  number independently re-derived from primary sources (docx/pptx XML, grade CSVs) all-stdlib; prior verdict
  audited, 6 quantitative claims corrected, none conclusion-changing. Plan gate driven programmatically
  (runPlanReviewGate + approvalProvider = commission standing approval) because the CLI readline dies on
  piped-stdin EOF at Gate 2. Engine loop: round 1 BLOCKED on a real MAJOR (stale effort labels vs live
  roadmap ids) with LIVE judge/synth on a second family via agy; fixed; rounds 2-5 empty -> CLEAN.
observation: (1) tallyFindings demotes traces_to_north_star:true (boolean) — it requires the STRING 'yes';
  cost one wasted skipped round + a probe to diagnose. SKILL.md's schema line doesn't say this.
  (2) The T8 CLEAN path worked exactly as designed: a post-fix defect-free draft converged in 4 empty
  rounds without filler nits. (3) Verify-and-deliver of an existing quiet verdict is a legitimate, cheap
  researchPrime shape — the steward's double-spend hazard note was the deciding evidence.
outcome: worked
provenance: genuine-execution
---
Deliverables: research/DEEP-READ-VERDICT.md + EXEC-SUMMARY + AGENT-IMPL in the project worktree;
DELIVERABLE-ENGINE.json (clean, cross_model:true, claude+grok) in research/rp-deep-read-432a9f4e/.
