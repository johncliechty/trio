# LEDGER A — local evidence + code architecture (agent 1)

Cited source LOCATED: C:\dev\_archive\research1-out\code-execution-organizer-20260531\01-report.md
(decoy: the ...T120000Z sibling is a design-spec, NOT the report.)

## Evidence items
- EI-1 "most coding tasks involve fewer truly parallelizable tasks than research"
  — rung CLAIMED (report stamps CORROBORATED, generous). Origin: Anthropic multi-agent post.
  Critical: it's an ASIDE in a research-system writeup, run on a research eval, NOT a coding benchmark. 0 OBSERVED code data.
- EI-2 "Actions carry implicit decisions; conflicting decisions carry bad results"
  — rung CLAIMED. Origin: Cognition "Don't Build Multi-Agents", Principle 2. Recommends single-threaded linear agent.
- EI-3 Independence tally: TWO genuinely independent origins (Anthropic + Cognition, opposite priors, no cross-cite).
  NOT a bandwagon at origin level. BUT both are opinion/principle, 0 OBSERVED parallel-code-writing data. Ceiling = CORROBORATED-by-opinion.
- EI-4 READ-ONLY parallelism carve-out — rung CORROBORATED, STRONGER than the prohibition. BOTH sources affirmatively endorse
  parallel read-only work (Anthropic's own 90.2% system is parallel on research; Claude Code subagents "not writing code").

## Verdict
Rule is honestly grounded for the SHARED-MUTATION case; OVER-GENERALIZED for the independent-unit case.
SKILL.md "coding is the least-parallelizable task" flattens Anthropic's hedged comparative.
Parallelizing genuinely-independent non-conflicting code units = UNVERIFIED (never studied), NOT REFUTED.

## Code touch-points
- Hard-coded sequential: cross-wave loop (project-engine.mjs:267, ascending-contiguous assertion :272-277, truth-gated advance :347);
  REVIEW loop (wave-engine.mjs:861 for-await); EXECUTE (:797); FIX (:923). No Promise.all/parallel() in execution path.
- Already configurable: REVIEWER_COUNT via --reviewers (run-project.mjs:124), threaded to reviewerCount. Only the SEQUENTIAL DISPATCH is fixed.
- Branch A concurrent reviewers: ONE change at wave-engine.mjs:859-863 (for-await -> Promise.all). Reviewers already independent+read-only. Evidence-blessed, lowest risk.
- Branch B fan-out EXECUTE: wave-engine.mjs:795-799 + test-snapshot + git. Needs per-coder worktree isolation + merge stage (does not exist). Highest risk; evidence cautions; UNVERIFIED for non-overlapping file sets.
- Branch C cross-wave pipelining: project-engine.mjs:267-323, relax :272-277 + :347. Collides with truth-gated-advance invariant; needs isolated worktrees. Not addressed by evidence at all.
