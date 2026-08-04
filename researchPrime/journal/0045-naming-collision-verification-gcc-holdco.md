# 0045 — Naming collision verification: the registries that decide are the ones you cannot reach

- **id:** 0045-naming-collision-verification-gcc-holdco
- **skill:** researchPrime@2026-07-11
- **situation:** High-stakes availability/collision verification for candidate names, where the decisive
  evidence lives in trademark and entity registries.
- **context:** Axmra Holding Company, Crucible Workstream C — naming a $45B GCC/US multi-sector holdco.
- **observation:** ENGINE mode bound cleanly (`runImportSpike` go:true, 26 symbols); the plan gate was
  hash-bound (`planHash=2987d2db…`) but its readline prompts do not consume a piped multi-line answer —
  gate 2 EOFs to ABORT — so the gate had to be driven programmatically via `runPlanReviewGate` with
  supplied decisions. Three LIVE governed rounds converged DRY (3/3), `cross_model:true`, substrate
  `[claude, grok]`, unresolvedHigh 0; round 1's Judge upheld all 9 adversarial findings and its reasons
  were substantive, not procedural. The methodological lesson is the sharp one: **every primary registry
  that would have settled the question was closed** — USPTO TSDR now 401s without an API key, TMview
  returned empty, the DIFC public register 403'd, EUIPO and Saudi SAIP were unreachable — while
  aggregator mirrors (Trademarkia, TrademarkElite) were freely readable and *look* like corroboration.
  The GATE-1 discipline earned its keep here: two mirrors of one USPTO feed are one origin, not two, and
  the honest rung was CLAIMED-VIA-MIRROR. UK Companies House was the only primary registry that answered,
  and it produced the run's single hardest fact. Note also that the Judge seat resolved to the drafter
  family (`cross_model:false` on that seat) even though the round substrate was cross-family.
- **outcome:** worked — converged honestly, and the deliverable's most valuable output was the explicit
  "what could NOT be verified" table rather than any positive clearance finding.
- **provenance:** genuine-execution
