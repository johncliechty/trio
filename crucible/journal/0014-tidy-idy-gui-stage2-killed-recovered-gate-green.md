---
id: 0014-tidy-idy-gui-stage2-killed-recovered-gate-green
skill: crucible
---

- **id:** 0014-tidy-idy-gui-stage2-killed-recovered-gate-green
- **skill:** crucible
- **situation:** Stage-2 (wave decomposition) of the Tidy-Idy GUI brownfield run, cross-family 5:1 (Gemini 3.1 Pro High Sharks+Judge, Claude steering), driven headless in the background with the 10-min status cadence.
- **context:** outputDir C:/dev/plans/2026-07-tidy-idy-gui; routes-fix in the launcher (buildLiveCrucibleAgent returns {agent,tracker} only — routes passed EXPLICITLY to runStage2); engine fix return {agent,tracker,routes} already committed to trio main (a530925).
- **observation:** The background task was externally KILLED mid-round-4 (3 Shark rounds done, log froze at round 4). Because the kill pre-empted the natural cap-HALT emit step, no IMPLEMENTATION-PLAN.md / foreman.config.json was written — but artifacts-stage2/BEST-DRAFT.md held the complete round-3-refined 10-wave plan (0 consensus blockers; all 11 findings agreement=1, folded as refinements). Recovered it → IMPLEMENTATION-PLAN.md, hand-authored foreman.config.json (docs: INTENT/IMPLEMENTATION-PLAN/LOG) + empty LOG.md, and the real Foreman locate-plan.mjs gate then passed exit 0 (10 waves parsed, test-command resolved, docs via config).
- **outcome:** worked
- **provenance:** genuine-execution
- **lesson:** A killed Stage-2 is recoverable to a Foreman-ready state from BEST-DRAFT.md alone — the missing pieces are only the two emit artifacts (config + log), which are mechanical to reconstruct and then verifiable by spawning the real well-formedness gate. See [[0010-judge-route-samemodel-fallback]] for the routes-fix this run depended on.
