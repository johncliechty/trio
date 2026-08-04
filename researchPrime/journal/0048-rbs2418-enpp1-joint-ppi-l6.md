# 0048 — RBS2418 A3: does ENPP1 inhibition lower JOINT PPi (L6)

- **id:** 0048
- **skill:** researchPrime (HEAVY, engine mode, tier=high)
- **situation:** Narrow/deep run on one link (A3) of a live investment thesis. A prior attempt at the identical
  question passed the plan gate and died on a billing limit before writing anything — fresh start ordered.
- **context:** 5 fresh-context evidence seats (real isolation, frontier on every seat) + operator primary
  fetches; then 3 cross-model `gemini-3.1-pro-high` reviewers via agy against the written deliverable.
- **observation:**
  1. **Writing the deliverable BEFORE Phase 3 was the right call** given a known billing-death failure mode.
     The artifact existed before any adversarial spend. Recommend this ordering whenever a prior run died.
  2. **The commissioned crux was mis-specified, and settling it relocated the risk rather than removing it.**
     "Does ANKH export PPi or ATP" resolved favourably (ATP) — but that only closes the *export* node; the
     bypass reappeared at the *converter* node, which nobody had named. Worth generalising: settling a crux
     often moves it one step, and the run should be asked to look for where.
  3. **Summarising fetch layers inverted a load-bearing directional claim TWICE** (the GWAS risk-allele
     direction), caught independently by the operator's verbatim fetch and by a seat. Two near-misses on the
     single most important claim. Seats also self-caught two OBSERVED-grade errors that entered via parallel
     sweeps folded in without personal reading. **The grading ladder degrades silently when a seat delegates.**
  4. **Cross-model review earned its cost.** 20 findings, 16 applied. It caught a flat self-contradiction
     between the document's own corrections section and its assumption table, an origin double-count against
     the document's own rule, and two over-absolute verdicts — in *both* directions. One reviewer finding was
     wrong and was rejected on adjudication after a second reviewer affirmed the opposite; that conflict was
     the most useful single exchange in the round.
  5. **Session WebSearch budget (200/200) was exhausted before the first seat call**, silently, and every seat
     hit it. Absence claims across the whole run are therefore weak for grey literature. **A pre-flight
     budget check should be part of Step 0** — a run whose main product is absence claims cannot afford to
     discover this at the end.
- **outcome:** worked (with a named limit — one adversarial round, not a converged engine loop; the ≥2-agree
  tally was operator-adjudicated rather than run through `tallyFindings`, and all three reviewers shared the
  gemini lineage so same-lineage agreement added zero GATE-1 origins).
- **provenance:** genuine-execution
