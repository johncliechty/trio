---
id: 0004-aramco-comparison-2026-07-19
skill: researchPrime
---

**situation:** Vet financials for an Axmra investor one-pager + deck comparing an RBS2418-based global pharma
to Saudi Aramco (companion to an existing ADNOC piece); also re-vet the ADNOC data and add global
oncology / immuno-oncology market sizing.

**context:** ENGINE mode (import spike go:true, 26 crossed symbols). Plan gate run for real; tier=high.
3 parallel web-research branches, then 3 fresh-context adversarial reviewers, a governed round, then a
round-2 pass against the BUILT artifacts.

**observation:**
- `plan-gate.mjs` writes `lockedGovernorOutput: {hash:"mock-hash"}` — a placeholder with no
  `thresholds`/`roundBudget`. `run-rounds.mjs` then dies with `Cannot read properties of undefined (reading 'N')`.
  But `governance.mjs.validate()` REQUIRES `lockedGovernorOutput.hash`, so nulling it to fall through to
  `deriveGovernorContract()` fails validation instead. The two are unreconciled. Workaround: build a real
  `deriveGovernorContract()` output AND copy `provenance.inputsHash` into a `.hash` field. Genuine engine
  defect, not operator error. Full writeup in the run dir's ENGINE-NOTE.md.
- PowerShell `ConvertTo-Json` wraps arrays as `{value:[...],Count:n}`; the round loader accepts the object then
  fails with `(rv.findings || []).map is not a function`. Author round inputs in Node.
- Round inputs must be BOM-free or `JSON.parse` throws. PS 5.1 `Out-File -Encoding utf8` writes a BOM.
- The single-family honesty guard fired correctly and usefully: 3 same-lineage reviewers produced the
  UN-MITIGABLE shared-blind-spot stamp. Carried onto the deliverable rather than hidden.
- ADVERSARIAL FINDINGS THEMSELVES NEED VERIFICATION BEFORE ADOPTION. A reviewer asserted as a blocker, with
  confidence, that no pharma had ever crossed $1T and the record was ~$800-900B. A verification branch REFUTED
  it: Eli Lilly is at ~$1.11T (Jul 2026), first crossing Nov 2025. Adopting that blocker unchecked would have
  printed a false claim in investor material. Verification also caught both valuation multiples being stale
  (4.5x/15.0x -> 4.84x/17.0x) and a vendor share-count error (stockanalysis 891.74M vs the 10-Q's 941,741,406).
- ROUND 2 AGAINST THE BUILT ARTIFACT was the highest-yield step: 14 defects in deliverables that had already
  passed round 1. Three were serious — a printed multiple that does not divide (314.9/65.0 = 4.84, printed as
  "= 4.85x"), a revenue-% column computed off $415.8B while its own table displayed $445.7B beside it, and a
  causal claim stated backwards (I wrote the ADNOC cap rose "driven mainly by" a Fertiglobe restatement that
  actually FELL and partly offset a rise elsewhere). Reviewing the plan is not reviewing the artifact.
- The round-1 fixes introduced their own regressions, which round 2 caught: a "conservative basis" label that
  was conservative for the margin but anti-conservative for the scale column, and disclosures that landed in
  the HTML but not on the slides — which travel as standalone artifacts and needed their own copy.

**outcome:** worked

**provenance:** genuine-execution
