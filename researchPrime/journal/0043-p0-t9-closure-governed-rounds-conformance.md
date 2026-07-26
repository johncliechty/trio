# 0043 — P0: T9 closure — run-rounds governed, output-conformance gated, calibration carried, plan-gate contract real (2026-07-25)

The 2026-07-25 journal-hardening review confirmed T9 worse than the 07-15/07-23 flags:
the canonical path computed+logged the governor tier but gated nothing (judge+synthesizer
hard-true at every tier; SKILL.md:94 false), never evaluated the crit-4 zero-AXIS skip,
hard-nulled the ρ/calibration slot (every engine deliverable failed its own
`checkOutputConformance` — which no bin/ module ever called), and the documented
plan-gate → run-rounds handoff crashed on the two-gate `{hash:'mock-hash'}` placeholder
(journal 0004, open since 07-19).

**Fixes (all call-site wiring of already-built, already-tested code):**
1. `run-rounds.mjs` routes rounds through `runGovernedRound` (governor.mjs) — tier now
   really gates Synthesizer/Judge/debate; zero-AXIS rounds SKIP with zero high-tier
   calls; the band's LITE `includeAdjudication` knob rides as a new tighten-only
   `includeDebate` override (can force debate off, never on — governor ceiling intact).
2. `checkOutputConformance` runs BEFORE `DELIVERABLE-ENGINE.json` is written; violation
   ⇒ HALT-RECORD + HaltError (never ship an unconformant deliverable).
3. The calibration slot carries the real Wave-9 `calibrationVerdict` (default mode —
   pure of the final round's reviewers, no ledger file needed).
4. `deliverable.mjs`: an engine deliverable whose Judge was HONESTLY absent (governor
   exclusion at low tier / crit-4 skip) carries an explicit `{excluded:true, by, reason}`
   stamp — null stays a contract violation for any other reason.
5. `plan-gate.mjs` (`runPlanReviewGate`) locks the REAL `deriveGovernorContract` output
   (provenance.inputsHash mirrored to `.hash`); `run-rounds` also defends against legacy
   placeholder records by deriving from round-1 input with a loud log (no more
   `thresholds.N` crash).

**Tests:** new `test/run-rounds-governed.test.mjs` (5 pins: low=zero-calls, high=positive
control, crit-4 skip, conformance+calibration, legacy-record no-crash). One STALE lint
repaired (`wave2.test.mjs` — cap may flow via the Track-B1 band resolver with the locked
contract as fallback; the lint's no-cap-decisions-outside-governed-outputs intent kept).
Suite: 202 pass / 1 fail — the fail is the pre-existing trio-green foreman-suite cascade
(reproduces at HEAD).

Residual (unchanged): `gateOneQuorum` still receives no `rhoHat` (learned quorum cannot
tighten in production) — P1; dark modules (`governance-record.mjs` snake_case twin,
`facet-coverage.mjs`, `calibrate-shadow.mjs`, wave-numbering collision) — P2.

provenance: genuine-execution (direct-fix session, tests green)
