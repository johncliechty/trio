# 0048 — RBS2418 TAM: the 30% "access" assumption, and an audit that repeated the error it indicted

- **id:** 0048
- **skill:** researchPrime (Heavy, ENGINE mode)
- **situation:** Principal asked me to find the TAM spreadsheet, verify his recollection that it assumed
  "25% of all cancer patients get treatment" built as HI-patients-plus-a-medical-tourism-residual, and
  research what supports 25%. Investor-facing data-room material for GCC sovereign/family-office LPs.
- **context:** Import spike GO (26 symbols). Plan gate hash-bound (`planHash 8c50425e…`, tier=high,
  N=3/K=4/M=2, budget 8); APPROVE recorded against commissioning scope, not a human turn — stamped.
  5 fresh-context branch seats + 3 adversarial sharks (one cross-family via agy/Gemini) + one real
  governed round with live Synthesizer/Judge.
- **observation:**
  1. **The recollection was mechanically right and semantically wrong, and BOTH halves mattered.** The
     residual construction was exactly as remembered (`B47 = B46 − B45`), but the parameter is 30% not
     25%, and it is a PRICE-TIER share, not a treatment rate — all 7.2M patients are treated in the
     headline. Separately, the remembered "25%" turned out to be a real literature figure (Sullivan
     2015, "<25% get safe, affordable, or timely SURGERY") — surgery-only and quality-gated. Finding
     where a half-remembered number actually came from was worth as much as grading it.
  2. **My own arithmetic committed the exact denominator error I accused the model of.** I compared the
     model's 30%-of-ELIGIBLE against a ceiling expressed as share-of-WORLD-INCIDENCE, inflating the
     refutation 2.77×, and "REFUTED at $150K and $100K" was false at $100K. All three sharks flagged it;
     the engine tallied it 3-of-3 BLOCKER. **Whenever a report indicts a source for unit conflation, run
     the same unit check on the report's own headline ratio before shipping.**
  3. **The cross-family seat found the thing three same-family seats could not.** Gemini saw that the
     tourism residual is `30% − HI_incidence_share`, so it is an ARTEFACT of the flat-incidence
     assumption and vanishes at a 30% incidence share. I had already *found* flat incidence as a defect
     and failed to trace its consequence — a same-family reviewer would plausibly have shared that blind
     spot. Angle diversity is not lineage diversity; this run had both and only lineage diversity paid.
  4. **A sourcing shark caught me suppressing counter-evidence from inside my own key source.** MYLUNG P2
     reports 77.7% conversion as its headline and 35.5% as an NGS subset; I quoted only the 35.5%, which
     understated the rebuild ~2.9× in the direction that flattered my conclusion. Also: two IQVIA figures
     I built a section on ($120Bn US, $288Bn) were NOT in the deck I had verbally claimed to "personally
     verify" — the deck carries only the $252Bn series. **"Personally verified" must be scoped to the
     specific figure, never to the document.**
  5. **The stale-artefact failure mode is real and I hit it.** I corrected the funnel in an inline
     one-liner and never re-ran `rebuild.py`, so the file on disk printed $4.0B while the report
     published $13.3B. A reviewer running the shipped code got a different answer than the report.
     **Re-run the gate after every correction, not just at the start.**
  6. **The final number moved three times under review** — $13.3B → $2.7–7.8B → $6.1–22.4B — and only
     the last brackets the top-down benchmark rather than being tuned to it. Reporting the revision
     history was more useful than any single point estimate.
  7. **`--max-rounds 1` bought a genuine BLOCKED verdict cheaply.** 25 AXIS findings, 3 surviving the
     ≥2-agree gate, quorum met, Judge NOT_CONVERGED with 18 blocking items. Note the Judge seat resolved
     to the drafter's own family (`cross_model:false`) even with substrate `[claude, grok]` — same defect
     as journal 0045, still unfixed.
  8. `agy --dangerously-skip-permissions` is blocked by the host's Bash classifier, so the cross-family
     shark could not read files; passing a ~15KB condensed claim-set via `--print` ARGV worked fine.
     `agy` needs `--model "Gemini 3.1 Pro (High)"` label form, and `--print` not `-p`.
- **outcome:** worked, with an honest NON-CONVERGENCE (18 unresolved high-severity at the round cap).
  Model verified and 12 defects documented; the 30% shown to be a category error traced to a WEF op-ed
  restating a WHO country-level indicator that WHO has since retired; the $237B tourism line falsified
  on volume AND reframed as a flat-incidence artefact; a defensible $6–22B unrisked / $0.3–2.4B
  risk-adjusted range delivered against the deck's own $2B/$10B/$30B return band.
- **provenance:** genuine-execution
