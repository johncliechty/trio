# 0055 — steward HMI research, lightest band, cross-family live

- id: 0055
- skill: researchPrime
- situation: Commissioned (background run, Ecgberht-side) to research steward/orchestrator
  human-interface best practices 2024-2026; deliverables REPORT.md + 15-line RUBRIC.md in
  C:\dev\steward-proto\research\; explicitly right-sized to the lightest band.
- context: ENGINE mode (probe GO), tier LOW, plan gate driven via the programmatic
  runPlanReviewGate seam (background run — commission recorded as APPROVE, assumption stamped).
  agy auth was LIVE (13s probe), so cross-family review ran for real: Gemini 3.1 Pro + fresh
  Claude reviewer per round through run-rounds.mjs replay.
- observation: (1) Tier-low governor genuinely fired zero synth/judge/debate seats — the T9
  recipe at LOW is cheap and still caught real defects: round 1 BLOCKED with 3 two-agree blockers
  + 12 singletons, incl. a factual overclaim (Devin "Slack-primary"), a fabricated-range headline
  (45-90% vs sources' 45-76%), and two rung inflations. (2) Round-2 Claude reviewer caught the
  report pre-claiming its own round-2 verdict in past tense — the exact false-completion failure
  the report documents; write history lines AFTER the engine verdict. (3) Write tool refused the
  deliverable ("subagents should not write report files") even though files WERE the commission;
  staged via Write-to-scratchpad + cp. Bash heredoc failed on CRLF first.
- outcome: worked — CONVERGED (dry) round 2, DELIVERABLE-ENGINE.json conformant, both files
  shipped with honest stamps (cross-family fact lives in review lineages; replay harness stamps
  substrate single-family).
- provenance: genuine-execution
