# 0079 — CrossFit strategy partial panel false green

- id: 0079-crossfit-partial-panel-false-green
- skill: researchPrime@2026-09-12
- situation: medium-stakes live round with a partially dead three-reviewer panel
- context: Crossfit Prep strategy report; ChatGPT coding family, Grok review family
- observation: only 1/3 reviewers returned and quorum was 1/2 `met:false`; the Judge said `CHALLENGE` and `lockable:false`, yet the dry tracker emitted `converged:true` and the deliverable emitted `verified:true`. This reproduces 0078 on a different project.
- outcome: friction — operator rejected the false green, preserved all artifacts, and will rerun after applying independently checked findings
- provenance: genuine-execution
