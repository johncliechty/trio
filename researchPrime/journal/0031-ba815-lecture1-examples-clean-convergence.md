# 0031-ba815-lecture1-examples-clean-convergence

- **id:** 0031-ba815-lecture1-examples-clean-convergence
- **skill:** researchPrime@2026-08-15
- **situation:** Scoped example-hunt (2–3 slides of content, medium stakes) with a hard four-criterion
  ADOPT bar, run through the full engine path: plan gate → fresh execution → governed rounds.
- **context:** BA 815 revamp, `C:\dev\MBA Teaching AI` — Lecture 1 business examples + Stanford
  seroprevalence verification. Run dir `BA 815/Fall 2026/research/rp-lecture1-examples/run`.
- **observation:** Three mechanism lessons.
  (1) **The plan-gate CLI cannot be driven by piped stdin** — readline answers gate 1 then hits EOF and
  exits silently without writing `governance.json`, and `run-rounds.mjs` then refuses to execute
  ("Execution blocked: governance.json missing"). The working operator path: import `plan-gate.mjs` and
  call `runPlanReviewGate(inputs, { runDir, promptGate1, promptGate2 })` programmatically, relaying the
  user's transcript APPROVE. The injectable prompts are the intended seam; the CLI is TTY-only.
  (2) **Disjoint single-reviewer findings tally ZERO AXIS findings** (G3 needs ≥2 reviewers agreeing on a
  claim_id), so a round of real-but-unique findings registers as DRY with `unresolvedHigh` tracked
  separately, and — important — **live Gemini seats never fire on a zero-AXIS round**, so
  RESEARCHPRIME_LIVE_ROUND=1 produced a single-family run anyway (`cross_model:false`, stamped honestly).
  If cross-family review is wanted, reviewers must overlap on the same claims.
  (3) **The CLEAN path did its job**: round-1 findings were adjudicated with real fixes (two new
  verifications — Digest died 1938, FDR 60.8% certified; one recorded decision on an inverse-form
  criterion; three scope pins), then four consecutive genuinely-empty rounds converged CLEAN in 5 rounds
  total, ~1 min each since skipped rounds spawn no seats. The anti-fake-dryness guard (empty ≠ dry)
  forced the honest route rather than letting me manufacture a dry streak.
  Deliverable: 2 ADOPTs (polling arc, Bing A/B), 1 ADAPT (Nielsen), Stanford verified with two
  corrections to a deck slide already taught for years (N=3,330 not 3,324; "random sample" oversell).
- **outcome:** worked (engine CLEAN convergence; single-family reviews honestly stamped; facts verified
  against primary sources in Phase 2)
- **provenance:** genuine-execution
