# 0062 — Partition Bayesian ANOVA survey: the pre-registered falsifier actually fired

- **id:** 0062
- **skill:** researchPrime
- **provenance:** genuine-execution

## situation

High-stakes literature survey for the `Math Review` campaign: is a partition approach to Bayesian
ANOVA (posterior over all Bell(K) partitions of level means), generalised to joint/conditional
groupings over multi-factor cells, novel enough for JASA? Tier `high`, ENGINE mode, plan gate
recorded against John's on-disk roadmap receipt for step `m2-survey-the-field`.

## context

Phase-1 pre-registered an explicit falsification test with three clauses: a published work that
(i) partitions the CELLS of a factorial design, (ii) computes a posterior over that space, and
(iii) reports conditional grouping statements. Four branches delegated; the lead kept the decisive
prior-art branch.

## observation

1. **The falsifier fired on two of three clauses.** The Rashomon Partitions line (arXiv:2404.02141,
   v5 Jun 2026 + companion arXiv:2606.02589) does (i) and (ii). Had the plan not pre-registered
   clause-level falsification, the honest answer would likely have collapsed into a vague
   "partially novel." Clause-level pre-registration is what produced a usable verdict instead.
2. **Computation beat reading, twice.** Implementing a competitor's Definition 5 (permissibility)
   and enumerating it exhaustively proved that their conditional-grouping object is *degenerate by
   construction* — a far sharper claim than any amount of close reading of their prose. Likewise
   the "log-linear term deletion reaches exactly 2^p partitions" theorem.
3. **A wrong intermediate nearly shipped.** My first reachability check computed rank from an
   unpivoted QR diagonal — unsound — and returned 5 instead of 8 for a 2×2×2 design, which would
   have *falsely refuted* a correct inherited theorem. Redoing it with SVD projectors fixed it. The
   wrong intermediate is reported in the deliverable rather than discarded.
4. **Independent replication happened by accident and was worth a lot.** One delegated branch
   reported three times in independent contexts, converging on the same verdict and independently
   catching the same mis-citation. That converted a key finding from CLAIMED to CORROBORATED at
   zero extra cost — an argument for deliberately duplicating one decisive branch on high-stakes
   runs.
5. **One branch never returned.** The Bayes-factor-ANOVA branch silently failed. The section was
   written by the lead from Crossref-verified metadata, and the deliverable says so explicitly
   rather than papering over it.
6. Crossref API batch verification (~80 DOIs) caught real errors that had propagated into a
   published preprint's reference list — including a DOI attributed to the wrong paper entirely.

## outcome

worked — deliverable is a 114k-char graded survey plus a one-page exec summary, with a plainly
stated negative finding (two of three novelty claims already taken) and a precise, defensible
residual. Phase-3 adversarial rounds were NOT run; the deliverable is stamped accordingly rather
than claiming convergence it did not earn.

## lesson

Pre-register falsification **clause by clause**, not as a single yes/no — a partial hit is the
common case and is only usable if the clauses were separable in advance. And on any high-stakes
combinatorial claim, implement the competitor's definition and count it; prose reading cannot
distinguish "they did not do it" from "their model forbids it."
