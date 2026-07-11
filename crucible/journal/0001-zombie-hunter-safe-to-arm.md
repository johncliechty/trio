---
id: 0001-zombie-hunter-safe-to-arm
skill: crucible@2026-07-05
---

- **id:** 0001-zombie-hunter-safe-to-arm
- **skill:** crucible (regular / TRIO_TIER=standard, Opus-4.8 seats)
- **situation:** brownfield hardening plan from an adversarial (Gandalf-Heavy) review — turn Anchor's disarmed zombie-hunter into a safe-to-arm reaper.
- **context:** C:\dev\Anchor zombie-hunter subsystem; 9 findings + a cross-model Gandalf read as intake.
- **observation:** Stages 0 (North Star + brownfield ingest) and 1 (Master Plan) converged well — Stage 1 in 3 rounds. The Shark-Tank loop genuinely deepened the plan (freeze-first ladder, positive-liveness kill predicate, control-plane integrity). Stage 2's loop did NOT converge: the same-model fresh-context Judge held NOT_CONVERGED across 4 dry rounds (findings oscillated 22→17→20, not monotone) and hit the roundCap=5 HALT. RECOVERED by calling the exported Stage-2 emit path directly (decomposeIntoWaves → renderImplementationPlan → writeDocTrio → runHandoffGate) — bypassing the non-converging loop but keeping Foreman's locate-plan well-formedness gate. Result: 10 waves, gate PASS (exit 0).
- **outcome:** worked (with friction: Stage-2 same-model self-judge could not converge; the round-cap HALTs rather than emitting a best-draft, so a manual emit recovery was needed — a candidate lesson: Stage 2 should offer a "cap → emit best draft for user approval" path, or a cross-model Judge to break the same-model deadlock).
- **provenance:** genuine-execution (live Opus-4.8 sub-agents; real locate-plan gate; live agy present but Sharks ran on the default Claude substrate).
