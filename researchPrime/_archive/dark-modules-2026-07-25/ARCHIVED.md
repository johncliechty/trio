# ARCHIVED 2026-07-25 — dark modules (zero production importers)

From the 2026-07-25 journal-hardening review (researchPrime §3):

- **governance-record.mjs** — a snake_case DUPLICATE governance schema/validator
  (`schema_version` vs the live `governance.mjs`'s `schemaVersion`); `gate-loader.mjs`
  and `two-gate.mjs` import the camelCase one; this module validated nothing that was
  ever written, and its authoritative-sounding `researchPrimeExtensionValidator` was a
  trap for hand-authored records (loadGate rejects what it accepts).
- ~~facet-coverage.mjs~~ — RESTORED to bin/ same day: zero importers HERE, but the
  lit-review dual-suite fence asserts its presence — it is the STAGED researchPrime
  seam for the planned 2D breadth-scoping effort (see the 2026-07-21 handoff doc).
  Allowlisted in test/bin-reachability.test.mjs with that reason.
- **calibrate-shadow.mjs** — shadow-calibration CLI, test-only importer; the LIVE
  calibration path is `rho-ledger.mjs`'s `calibrationVerdict`, wired into `run-rounds`
  since the 2026-07-25 T9 closure.

Also the origin of the confusion these fed: bin/ carries TWO overlapping wave-numbering
programs (see `bin/WAVE-NUMBERING.md`). Reachability is now machine-checked by
`test/bin-reachability.test.mjs` — restore any of these only by wiring them into a
canonical path AND allowlisting there.
