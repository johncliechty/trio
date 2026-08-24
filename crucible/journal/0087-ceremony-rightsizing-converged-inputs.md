---
id: 0087-ceremony-rightsizing-converged-inputs
skill: crucible@2026-08-11
situation: Depth/band selection when the pipeline's INPUTS are already adversarially converged (researchPrime ledger + Jumper-vetted design) and the artifact is low-stakes/reversible
context: collapse-deck run (C:\dev\plans\2026-08-11-collapse-deck) — 17-slide teaching deck; John challenged total pipeline wall-clock/cost mid-Stage-1
observation: >
  Three compounding causes made a ~45-70min-engine task feel like a multi-hour effort.
  (1) RIGHT-SIZING ANCHOR BIAS: operator recommended FULL because the user invoked the
  skills BY NAME ("a Crucible foreman run"), though the task signals (converged evidence,
  vetted design, fixed scope, reversible artifact) all pointed LITE. Invocation vocabulary
  is not a depth signal; task signals are. (2) INTAKE SCHEMA MISMATCH: assessComplexity
  was fed operator-invented field names; every signal parsed as unknown (emptyIntake:true)
  so triage defaulted FULL — the default-to-rigor worked as designed, but the operator
  should pass the real schema or use the stage0 protocol end-to-end. (3) SIGNAL DENSITY:
  Stage-1 shark round 1 on this artifact class returned 42 findings → only 1 ≥2-agree
  BLOCKER (~2% agreement density) at ~10min/round of frontier seats. For artifact-
  generation plans over converged inputs, the marginal defect yield of extra shark rounds
  is low; the HARDENING/AUDIT GATE (mechanical, nearly free) carries most of the honesty
  value. Wall-clock was additionally dominated by serial phase ordering (Jumper 36min
  fully before Stage 0) and human-gate + relay latency (~1.75h waiting between gates),
  which is not engine time and should be attributed honestly when a run "feels slow".
  Heuristic for next time: converged upstream evidence + fixed scope + reversible
  deliverable ⇒ recommend LITE and say why; reserve FULL for unconverged/high-stakes/
  irreversible work where round-1 blocker density is expected to be high.
outcome: friction
provenance: genuine-execution
---
