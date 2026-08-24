# 0051 — BA 815 assessment-structure decision support (engine, live cross-model)

- id: 0051
- skill: researchPrime
- situation: Anchor commission (steward directive, John-approved) — decision-support facts+options
  for BA 815's 2026 assessment structure: PSU/Smeal policy on recording/AI-assessment/FERPA audio,
  the SDR route (7 names, zero types), a priced 2-vs-3 sittings table, and a one-page weight
  recommendation + participation rubric. Commission brief wrapper named the already-delivered
  deep-read step; disk check confirmed delivery, directive executed instead — no heavy re-run.
- context: ENGINE mode (import spike GO), agy present; plan gate driven non-interactively via the
  ApprovalProvider policyGrant seam (commission standing approval, planHash b627e6f9) — the
  documented plan-gate → run-rounds happy path worked end-to-end. 3 fresh-context research agents
  (policy/FERPA · AI policy · SDR), then 9 reviewer seats over 4 governed rounds via
  bin/run-rounds.mjs, RESEARCHPRIME_LIVE_ROUND=1 (Judge/Synthesizer live on second family).
- observation: (1) tallyFindings demotes any finding whose traces_to_north_star is not the literal
  string 'yes' — booleans silently zero the round ("SKIPPED zero-AXIS"); cost one wasted round
  invocation, caught by reading round-1-result.json, fixed by resetting RUN-STATE and re-running.
  Input-shape doc in run-rounds.mjs doesn't say this; the dogfood does. (2) Live cross-model rounds
  + fresh reviewer seats caught real defects the drafter could not see: an overstated policy modal
  (47-20 "should"→"is due"), a self-refuting parenthetical (Copilot-only vs the cited page's own
  tool table), and the institutional-reader seat found the GCAC-802 graduate bridge + ESL/venue
  exposures — genuinely decision-changing. (3) Convergence: round 1 BLOCKED(5) → rounds 2–4 DRY →
  converged dry, unresolvedHigh 0, output-conformance OK.
- outcome: worked
- provenance: genuine-execution
- artifacts: research/ASSESS-DECISION-PAGE.md · ASSESS-POLICY-FACTS.md · ASSESS-AGENT-IMPL.md ·
  engine proof in research/rp-assess-a00e50e9/ (MBA-Teaching-AI worktree a00e50e9)
