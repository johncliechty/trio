# Item F Phase 1a Capture Artifacts

## researchPrime Checkpoint State
- Checkpoint file path: `C:/dev/trio/researchPrime/foreman-checkpoint.json`
- Captured state: wave 1/13, HALTED on Item C, zero commits, resumable.
- John's time-boxed decision date: 2026-07-21 (assumed 3-day timebox for resume/abandon/descope decision).

## Coupling Spike Go/No-Go Artifact
- **Target:** `researchPrime/bin/governor.mjs`, `researchPrime/bin/two-gate.mjs`, `researchPrime/IMPLEMENTATION-PLAN.md`
- **Result:** GO. The coupling is within budget. No researchPrime edits are required.

## Pinned Reuse-Target Commit Hash
- `4bd0114553b73c2a7b91d6315cdd88ef9261cad2` (Phase 3 provenance header target).

## Repo-Fact Verification Sweep
- **literature-review:** Branch B (no enforceable engine lock path found) → Disposition: UNRESOLVED-PENDING-JOHN (fourth-slot SCOPE HALT raised).
- **tidy-idy:** Two call sites verified.
- **legal-beagle / financial-analyst:** Current code verified (ENGINE-GATED).
- **zombie-hunter:** Deterministic model-free auth path verified.

## Dependency Manifest
- `trio-core/` dependencies, `crucible-lib.mjs`, `foreman` utilities present and unmodified.
- No imported modules overlap with researchPrime HALT state.

## Core+Extension Conformance Test
- Checked `output-conformance.test.mjs` and `wave5-two-gate.test.mjs`.
- The dropped core+extension conformance test is **ABSENT**.
- **Action:** Scoped follow-up logged for Phase 9a.
