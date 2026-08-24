---
id: 0052
skill: researchPrime
situation: John asked for an easy-to-understand illustrated explainer of what happens when a deep neural network "collapses" during calibration/training, plus a PDF.
context: Full engine run, tier low, plan-gated (APPROVE in chat, hash-bound via runPlanReviewGate). 4 isolated research agents (77→78-claim ledger), 3 OBSERVED numpy demos (divergence→NaN@193, dead-ReLU 100%/3%, real GAN mode collapse 1/8→6/8), 6 governed rounds with 2 Gemini (agy) + 1 Claude fresh seats per round.
observation: >
  (1) plan-gate.mjs CLI hangs on piped stdin (Gate-2 readline never resolves, exit 0, no
  governance.json) — drove runPlanReviewGate programmatically with prompt overrides instead.
  (2) Reviewer-template bug: traces_to_north_star as boolean true demoted ALL findings
  (tallyFindings requires string 'yes') → false zero-AXIS DRY round; caught via round-result
  inspection, normalized, re-run. Prompts must mandate the string form.
  (3) agy seats returned fenced ```json despite no-fence instruction (~2/12 calls) — strip on
  assembly. One agy seat had a no-look infra failure (couldn't see target files); retry with
  explicit absolute paths in the prompt succeeded.
  (4) Round 5 caught a fabricated quote INSIDE ledger B16's own round-3 correction note
  (phrase absent from the BigGAN primary, inherited from the research agent's
  paraphrase-in-quote-marks) — cross-model citation seats that fetch primaries verbatim are
  the single highest-value reviewer angle.
  (5) At tier low the engine attests cross_model=false (no adjudication seats routed through
  the live tracker) even when reviewer cognition is genuinely cross-family — the honest
  framing is operator-observation vs engine-attestation, kept distinct in all deliverables.
  (6) Rounds 1-3 each produced a real agreed blocker; rounds 4-6 dry → converged. Engine's
  ≥2-agree + claim-id identity gates worked as designed once input format was right.
outcome: worked
provenance: genuine-execution
---
Deliverables: illustrated artifact (claude.ai/code/artifact/caaa0a5d-9879-402e-90d3-f182b56c4bb2),
PDF, full/exec/agent reports, 78-claim ledger, DELIVERABLE-ENGINE.json — all in
C:\dev\plans\2026-08-10-researchprime-nn-collapse.
