# 0046 — RBS2418 longevity thesis (Ecgberht L1, Heavy)

- **id:** 0046
- **skill:** researchPrime (Heavy, ENGINE mode)
- **situation:** Ecgberht campaign step L1. Settle whether an oral ENPP1 inhibitor is defensible as a LONGEVITY
  asset on two theses (cancer prevention via cGAMP/STING; CPPD arthritis via joint PPi). Output feeds an economic
  model shown to sovereign investors. Standing instruction: try to kill both theses.
- **context:** Import spike GO (26 symbols). Plan gate hash-bound (planHash b81b4fb4…, tier=high) but APPROVE was
  recorded against commissioning scope, not a human turn — stamped as such. 5 branch seats + 3 adversarial sharks.
- **observation:**
  1. **The single highest-value moves were my own primary fetches, not the seats.** Text-extracting Nature Aging's
     supplementary PDF (PyMuPDF, after WebFetch returned binary) yielded Supp Table 2 — the cancer-eradication WTP
     that no seat found. Semantic Scholar's `openAccessPdf`/PMC-ID field routed around a 403 wall that had blocked
     four other attempts and closed the run's top open item. **When a publisher 403s, resolve the PMC ID via the
     S2 graph API before declaring UNVERIFIED.**
  2. **WebSearch budget (200) was exhausted mid-run by parallel seats.** Five concurrent seats each searching
     aggressively drained the shared session budget; late discovery had to run on registry/REST APIs only. On Heavy
     multi-seat runs, budget the search quota across seats explicitly at launch.
  3. **The kill instruction produced its own bias.** Reviewers caught me grading pro-thesis claims from a paper
     CORROBORATED while grading the anti-thesis claim from *the same paper* CLAIMED, stamping conclusion-serving
     universal negatives OBSERVED, and picking the PAF exposure that flattered the refutation. Asymmetric rule
     application in the direction of the pre-reached conclusion — in both directions at once.
  4. **`OBSERVED (absence)` is an off-ladder rung I invented mid-run and assigned only to negatives that helped.**
     Two independent reviewers flagged it as the cleanest structural attack surface. Added an explicit
     ABSENT-FROM-SEARCH rung below CLAIMED.
  5. **The honesty guard did its job.** Three reviewers with different *angles* but one model family →
     `singleFamily:true, mitigated:false`. Angle diversity is not lineage diversity; a Heavy run needs a real
     cross-model seat and this one did not have one.
- **outcome:** worked (with an honest non-convergence). Round 1 DRY, dryStreak 1/3, 39 unresolved high-severity,
  NOT converged; Judge REVISE-AND-PROCEED; G9 debate fired on a genuine OBSERVED-vs-OBSERVED PPi conflict and
  returned UNRESOLVED BY DESIGN rather than fabricating a resolution. Both theses materially reshaped: prevention
  thesis unsupported, arthritis thesis survives ~20× smaller than framed, headline economic figure shown to be a
  category error (US-only WTP/VSL, not global GDP).
- **provenance:** genuine-execution
