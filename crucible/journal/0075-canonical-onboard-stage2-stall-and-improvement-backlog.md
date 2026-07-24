# 0075 — Canonical onboard Stage-2 stalls + Crucible improvement backlog

- **id:** 0075
- **skill:** crucible
- **situation:** Crucible LITE for Canonical SKILLS_ROOT + A/B onboard (2026-07-24). Stage-1 produced Master Plan under round cap (human-lockable). Stage-2 wave decomp + Shark r1 completed then **silent death mid-challenge**; Implementation Plan force-synthesized for human approval.
- **context:** Live agent seating grok/grok, `cross_model:false`. Large locked Master Plan (~42k chars) embedded into Stage-2 context. Launch via PTY + later relaunches.
- **observation:**
  ## Flakes observed
  1. **Silent death after band stamp / mid-challenge** — process exit without HALT artifact; operator cannot tell crash vs long agent call.
  2. **No mid-stage heartbeat** during long agent calls (same class as Foreman).
  3. **LITE cap + Judge NOT_CONVERGED** → human-lockable draft is correct, but status UX under-communicates "cap HALT with draft" vs "crashed".
  4. **Force-synthesize path** after crash is ad-hoc (session wrote IMPLEMENTATION-PLAN.md); should be a first-class `force-emit-stage2` after N silent minutes or process death with artifacts present.

  ## LITE contribution
  - LITE `roundCap=1` + 2 sharks is intentional; NOT_CONVERGED at cap is expected often.
  - Silent death is **not** LITE-specific.
  - Huge North-Star+Master-Plan paste into Stage-2 may increase agent latency / failure rate (context bloat) — more relevant than LITE vs FULL Shark count.

  ## Recommendations
  1. **Durable stage logs + heartbeat** during every agent call (mirror Foreman P0).
  2. **Process-death → HALT.json** with last step and artifact paths (never silent).
  3. **Stage-2 input budget:** pass plan path + criteria, not full 40k embedded NS+architecture twice.
  4. **Auto force-emit** on cap or crash when BEST-DRAFT / wave decomp exists; label `human-lockable`.
  5. **Status table plain ASCII** default (unicode arrows garble on some hosts — observed in operator chat).
  6. **LITE honest ETA:** "planning 20–60m; if silent >15m check process" in Stage launch banner.
  7. **Cross-link to Foreman:** when handoff emits, stamp recommended gate-command that collects >0 tests (doctor).

- **outcome:** friction
- **provenance:** genuine-execution
