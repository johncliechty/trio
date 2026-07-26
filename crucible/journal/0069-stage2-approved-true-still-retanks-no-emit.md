# 0069 — Stage-2 approved=true re-tanks and never emits (share-anchor)

- **id:** 0069
- **skill:** crucible
- **situation:** Share Anchor+Skills Stage-2 FULL; John authorized auto-approve + jump to Foreman (2026-07-23).
- **context:** `launch-stage2.mjs` on human-lockable re-called `runStage2({ approved: true })`. Engine still runs full decompose + Shark Tank; human-lockable throws *before* `writeDocTrio` / handoff even when `approved=true`.
- **observation:** First pass 9 waves, 2× dry human-lockable. Auto-approve re-entered; 11 waves re-decomp; 2× dry human-lockable again; `IMPLEMENTATION-PLAN.md` / `foreman.config.json` never written. Only draft + HALT-STAGE2. Same-family grok Judge NOT_CONVERGED sustains human-lockable loop.
- **outcome:** friction
- **provenance:** genuine-execution
- **workaround:** `force-emit-handoff.mjs` — `normalizeWaves` + `writeDocTrio` + `runHandoffGate` from `wave-decomposition.json` after human-lockable (John go-build).
- **fix candidate:** When `approved=true`, skip Shark Tank (or treat human-lockable as emit path); pass approved into loop so human-lockable becomes emit-and-return not throw-without-docs.
