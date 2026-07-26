---
id: 0015-tidy-idy-gui-amendment-d-standalone-launch-verified
skill: crucible
---

- **id:** 0015-tidy-idy-gui-amendment-d-standalone-launch-verified
- **skill:** crucible
- **situation:** Post-approval plan amendment (Amendment D): John asked whether the Tidy-Idy GUI plan built an Anchor-integrated tool or a standalone one, and directed re-homing the launch to a standalone `tidy-idy <folder>` (CLI/cowork, any folder) with Anchor's button as a thin caller.
- **context:** Vetted 10-wave plan already gate-green. Amendment touched only the launch seam: North Star (Amdt 2), Wave 5 re-scope, Wave 6 transport phrase, master-plan Amendment D. Verified with ONE focused cross-family Shark round (3× Gemini 3.1 Pro High, refute-prompted) against the re-scoped Wave 5 + invariants, via verify-amendment-d.mjs (routes-fix in).
- **observation:** Round verdict was mechanically DRY (0 BLOCKERs — no two Sharks' findings normalized to the same topic-id), BUT all three Sharks INDEPENDENTLY converged on the same 3 real holes: (1) concurrency blindness — a standalone CLI run bypasses job_runner so Foreman/Gandalf could mutate mid-scan (R1); (2) CLI token bootstrap undefined for a bare browser-open; (3) zombie panel server + permanent lock on tab-close; plus investigator-tile vs "zero dependency" tension. The topic-normalizer under-counted semantically-identical cross-Shark findings, so DRY understated real convergence.
- **outcome:** worked
- **provenance:** genuine-execution
- **lesson:** A DRY tally is NOT automatically "ship it" — when 3 fresh-context Sharks each hit the same substantive holes under distinct topic-ids, honest practice is to FOLD (cross-agent lockfile authority + Foreman/Gandalf consult it; stale-PID-aware self-terminating server; specified loopback single-use-nonce CLI opener with token still off-disk; environment-adaptive openers), not wave through on the mechanical count. Re-gated exit 0. See [[0014-tidy-idy-gui-stage2-killed-recovered-gate-green]].
