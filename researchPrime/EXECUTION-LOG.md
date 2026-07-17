# Execution Log

> NOTE (2026-07-16): the Wave 1–9 entries originally written here were lost in the accidental
> `git clean -fd` on `foreman/run` (git=false ⇒ generated files untracked); the code itself was fully
> reconstructed from the session transcripts (see `../foreman/journal/0013-wave10-test-immutability-halt.md`).
> Waves 1–9 remain proven by their orchestrator gate records (`.foreman/wave-1-gate.json` …
> `wave-9-gate.json`, all GREEN).

## Wave 11 — Verification + dogfood (acceptance gate; every criterion a real assertion)

**Status:** IMPLEMENTED (execute step of the resumed run; the orchestrator gate `node --test test/`
is the ground truth and runs after this entry lands).

**Process note:** the wave-11 sources were substantively authored in the pre-resume session and
carried in the working tree (git=false ⇒ uncommitted); this execute pass verified every acceptance
import/shape against the real `bin/` sources, repaired one stale header comment in
`test/acceptance.test.mjs` (it still described the lineage enum as pending/all-placeholder, while
`lineage-enum.json` was committed 2026-06-10 and the file's own crit-5 test asserts
`committed:true`), and wrote this auditable entry.

**Process note (execute pass 2, 2026-07-16):** re-verified every acceptance import against the real
`bin/` exports (all resolve; `bin/rho-ledger.mjs`'s NUL byte is the intentional literal in
`pairKey`'s join separator, matching its "NUL join" comment — `node --check` passes). Removed ONE
gamed line from the wave-11 source `bin/dogfood.mjs`: an UNUSED `import { loadGate } from
'./gate-loader.mjs'` annotated "satisfy static call-graph check" — no such check exists in this
repo, the import contradicts dogfood's documented contract (predicates from `bin/round.mjs` +
thresholds from the pre-registration ONLY) and I6 (no gamed gates), and `gate-loader.mjs` remains
legitimately covered via its real consumer `bin/run-rounds.mjs:58`. NOTE for the orchestrator /
reviewer: four IDENTICAL injected imports remain in NON-wave-11 files — `bin/governor.mjs:39`,
`test/round.test.mjs:51`, `test/output-conformance.test.mjs:33`, `test/live-round-agent.test.mjs:38`
— left untouched here (outside wave-11 scope; they appear to originate from a parallel plan's run
in this working tree and are functionally harmless but should be cleaned by their owning waves).

### What was built (done-when → evidence)

1. **Every acceptance criterion 1–7 is a discrete `node --test` assertion reading committed
   thresholds + the baseline-by-hash** — `test/acceptance.test.mjs`:
   - Pre-flight: `validatePreregistration()` committed + all 8 thresholds (G/X_pct/C_min/N/K/M/T/N_min)
     present, and the on-disk fixture still reproduces the frozen Wave-3 baseline hash
     (`67792c6f…f4221d`, pinned; regeneration ⇒ RED).
   - **crit-1** (3 tests): G1-attributed closure of the CLOSABLE (non-CBS) single-pass gap ≥ G;
     the residual to full closure is EXACTLY the CBS class (no hidden shortfall); CBS < C_min is
     carried as a stamped measured CEILING (I1/I2) and the C_min floor is shown to BITE a claimed
     sub-floor closure. Default mode claims no cross-lineage origin (`cross_model:false`, I3).
   - **crit-2**: a low-stakes governed round fires ZERO high-tier sub-agents (overhead 0% ≤ X),
     with a high-stakes positive control proving the meter is not stuck.
   - **crit-3**: Oranges foresight drops EXACTLY the planted path-defect branches (equality
     assertion) each with a counterfactual cost; a no-op pass is stamped `no foresight value added`
     and crit-3 NOT satisfied.
   - **crit-4**: a zero-AXIS round is skipped even at HIGH stakes (zero high-tier calls), AND the
     pre-existing Waves-1–10 rigor suite is re-run in a fresh child runner and asserted GREEN,
     0 fail, > 100 passes (no-regression, non-vacuous).
   - **crit-5 / I3**: attested-distinct lineages add +1 each; same-lineage adds 0; off-enum caps at
     one shared bucket; degraded mode forces `cross_model:false` and conforms (honesty stamp).
   - **crit-6**: every owned trio-core module resolves via #imports AND package exports to ONE
     in-repo path; every upstream trio module resolves to ONE path OUTSIDE the repo (reuse-not-fork).
   - **I6**: every declared-low-but-irreversible fixture probe adjudicates tier ≥ medium with the
     override recorded; an honest low/reversible item stays low (no over-fire).
   - **I4**: the G7 audit throws on a pointer-less raise in BOTH modes and the ladder does not move.
   - **crit-7 / I8** (4 tests): same-lineage origins invariant under a full ρ̂ sweep; MONOTONE-SAFETY
     (`requiredQuorum(ρ̂) ≥ static floor` for every ρ̂ incl. degenerate, and non-decreasing); the ρ̂
     estimator round-trips a seeded ρ=0.5 within committed T with the censored-lower-bound stamp and
     N_min cold-start fallback; ledger-reproducibility replay — same (inputs + ledger-hash) ⇒
     identical verdict, changed ledger ⇒ changed hash, ledger-disabled default mode pure-of-inputs.

2. **The dogfood self-run proves the dry + suspiciously-dry predicates** — `bin/dogfood.mjs`
   (`runDogfood`): drives the REAL Wave-7 loop (`orchestrateRound`, `makeConvergenceTracker`,
   `isDryRound`/`isEmptyRound`, `assessConvergenceHonesty`) with a hermetic scripted agent seam and
   thresholds READ from the pre-registration (`loopThresholds`, I6 — the module chooses no number).
   Self-run A converges after N consecutive NON-EMPTY dry rounds (I7 — no padding); self-run B
   (high stakes, dry in < K, > M unresolved BLOCKER, single-family substrate) fires the
   probe-or-dissent and emits the `UN-MITIGABLE` shared-blind-spot stamp with `mitigated:false`
   (I1 — never a mitigation claim). Asserted end-to-end by the ACCEPTANCE dogfood test.

### Coverage

`test/acceptance.test.mjs` — 18 tests, every done-when clause of Wave 11 a concrete assertion;
"Given any criterion 1–7 fails its assertion, Then the failing gate is reported" holds because each
criterion IS its assertion (no prose-satisfied criterion, no vacuous GREEN).

## Wave 10 — Deliverable integration + honest degraded mode

**Status:** IMPLEMENTED and gate-covered (orchestrator gate `node --test test/`: 194/194 GREEN,
`.foreman/wave-10-gate.json`).

**Process note (why this entry is landing in fix iter 2):** the wave-10 EXECUTE agent in the resumed
run died on a transport error before making any tool call (`_foreman-status.log:34` — class
error-result, 0 tools, 0 output tokens), so it never wrote this log entry. The implementation itself
landed across the pre-HALT wave-10 work and the transcript recovery; this entry records the evidence
so the wave's done-when is auditable.

### What was built (done-when → evidence)

1. **Deliverables carry round history, Judge verdict, convergence proof, ρ̂ + learned-quorum state,
   and the separate Synthesizer Brief** — `bin/deliverable.mjs`:
   - `assembleDeliverable()` emits `round_history` (via `deriveRoundHistory`), `judge_verdict` (the
     same object the round's G4 Judge produced), `convergence_proof` (the Wave-7 tracker's final
     state), `calibration` + `rho_hat` (the Wave-9 `calibrationVerdict`, carried in BOTH modes because
     default-mode calibration is pure-of-inputs), and `synthesizer_brief` (via
     `buildSynthesizerBrief`, stamped `decides:false` — steers, never decides; crit-6).
   - Integration seam (not an orphan module): `bin/run-rounds.mjs` imports `assembleDeliverable` and,
     on convergence, writes the assembled deliverable to `DELIVERABLE-ENGINE.json`
     (`bin/run-rounds.mjs:41,176,185`).

2. **Non-engine runs are HONEST** — a degraded deliverable carries the literal
   `HONESTY_STAMP` = "schema conforms; adversarial verification did NOT run", force-sets
   `cross_model:false` (I3), and nulls the verification-only sections rather than faking them.
   All three user surfaces (`full` / `executive` / `agent-implementation`, via `renderSurface` /
   `renderAllSurfaces`) lead with the stamp.

3. **`test/output-conformance.test.mjs` passes AND asserts "parity" appears in no prose-mode user
   surface** — `containsForbiddenProse()` is the whole-word, case-insensitive detector; the
   conformance gate `checkOutputConformance()` additionally REJECTS a stamp-less or
   cross_model-claiming degraded deliverable and an engine deliverable missing any required section
   or whose Synthesizer Brief decides (non-vacuous: the gate can fail).

### Coverage (frozen tests, unmodified)

`test/output-conformance.test.mjs` — 10 assertions, all GREEN in the wave-10 orchestrator gate:
the engine deliverable is assembled from REAL upstream outputs (`orchestrateRound`,
`makeConvergenceTracker`, `calibrationVerdict`), not hand-built section-name stubs; an estimated ρ̂
flows through and only ever tightens (MONOTONE-SAFE); the degraded stamp/cross_model/parity clauses
are each a discrete assertion; both rejection paths of the conformance gate are exercised.
