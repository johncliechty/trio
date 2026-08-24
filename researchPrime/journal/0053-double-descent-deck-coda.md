---
id: 0053
skill: researchPrime
---

**situation** — John challenged a teaching deck's slides and asked whether the LLM
"error goes down, up, then down again" story he half-remembered is real, and to
bring it in as slides if it holds.

**context** — ENGINE mode bound (import spike go:true, 26 trio modules). Plan gate
driven for real: triage defaulted Heavy/FULL on unset scope; recommended Standard
and John approved. governance.json hash-bound at planHash=472c6092.

**observation** — Two things worth keeping. (1) The engine's round loop recorded
both rounds as `SKIPPED (zero-AXIS, crit-4)` with `substrateFamilies=["claude"]`
even though round 2 carried a `lineage: "gemini"` review — so the round bookkeeping
never produced a Judge verdict and never registered the cross-family lineage. The
real adversarial value came from calling agy directly, outside the round protocol.
(2) That direct cross-family pass (Gemini 3.1 Pro High, 47s) returned a finding that
was PARTLY right: it asserted the double-descent peak is absent without label noise;
primary-source adjudication showed the peak exists but is often only a plateau
without noise. The draft claim was an overclaim in a way I had not seen, and the
narrowed F6 is materially better. Single-lineage self-review would not have caught it.

**outcome** — worked (deliverable: ledger-F.json, 12 claims, 2 slides shipped)
**provenance** — genuine-execution
