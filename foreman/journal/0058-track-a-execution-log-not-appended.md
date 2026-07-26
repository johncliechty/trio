---
id: 0058-track-a-execution-log-not-appended
skill: foreman@2026-07-22
situation: execution-log-not-appended-during-live-run
context: >
  Track A run-live A-verify-substrate 2026-07-22; status log showed W1–W3 GO
observation: >
  _foreman-status.log recorded wave GO/HALT lines; EXECUTION-LOG.md still showed
  "no waves built yet" for most of the run. Session cadence used status log as
  truth; human EXECUTION-LOG lagged. Candidate: run-live should append a GREEN/HALT
  stanza to docs.execution_log per wave converge (or document that .foreman/
  wave-*-proven.json is the only machine truth).
outcome: friction
provenance: genuine-execution
---

Sleep cluster: observability — status log vs EXECUTION-LOG divergence mid-run.
