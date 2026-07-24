# 0083 — Sleep residuals vs 2026-07-24 canonical onboard (not new mystery)

- **id:** 0083
- **skill:** foreman
- **situation:** Operator asked: were yesterday’s sleep fixes for Foreman/Crucible already supposed to stop the flakes on the canonical onboard build? Why all day if we just slept?
- **context:** Sleep F-H 0072/0075 (process lifetime); 0076 packages 1–6 (vacuous clear-halt, ledger); earlier T10 review transport_failed. Live build 2026-07-24 all-grok LITE 8 waves.
- **observation:**
  ## Not new — already in journals

  | Failure we hit today | Already logged | Sleep status |
  |----------------------|----------------|--------------|
  | Silent mid-wave death / die after GREEN gate before review | **0072** F036–F045 cluster (B7) | **Partial fix 0075** — fail-loud + resume seed + stamp review after GREEN |
  | EPIPE broken pipe write → process exit | Same death *class*; forensics now name it | **Not fully closed** — `emit()` still does bare `process.stdout.write` (no try/catch) |
  | Vacuous-GREEN after resume / parallel land | **0010, 0015, 0076–0079** family | **Intentional hard guard**; clear-halt refuse unless force; proven ledger partial |
  | Reviewer unparseable JSON | **0004, 0005** tidy polish; T10 | **Partial** — transport_failed degrade if *some* reviewers ok; **ALL** fail still HALTs |
  | Full-suite gate cost / wallclock | **0001/0078** share-anchor gate | Investigated; wave-scoped gate still residual |
  | Stage-2 silent death / force emit | Crucible **0001, 0014, 0022, 0069** | Force-emit residual; process death shared with F-H |

  ## What sleep *did* fix (and we used)
  - Deaths no longer empty-stderr mystery: process-lifetime → last-crash / FATAL line (we saw `EPIPE`).
  - Resume can re-enter gate/review after GREEN (when checkpoint stamps correctly).
  - Vacuous clear-halt alone refused (forced us to land source / --force) — **by design**, not a regression.

  ## What sleep *did not* claim to fix
  - Parent shell / redirected stdout dying and killing emit via EPIPE.
  - Host SIGKILL / reaper with no JS exception.
  - ALL reviewers unparseable → still transport HALT (strict when reviewerCount=1).
  - Vacuous-GREEN “empty execute GO” — deliberately **not** weakened (0079).

  ## Why not “all fixed before this build”
  1. Sleep closed **packages that unit-test**, with **residuals labeled** (0075 honesty: external kill not eliminated; 0081: live multi-wave demo still residual).
  2. EPIPE-on-stdout is a **one-line hardening miss** relative to F-H intent (“never crash on logging”) — file append is safe; **stdout.write is not**.
  3. Same-family grok review + 1 reviewer maximizes “ALL transport_failed” path.
  4. Building a large new surface under thrashing process lifetime multiplies restarts × full 200+ test gates = wall-clock day.

  ## Fix effort estimate (engine, not product)
  | Item | Effort | Effect |
  |------|--------|--------|
  | Wrap `emit`/all stdout writes in try/catch; never exit on EPIPE | **0.5–1 day** | Stops most “GREEN then dead” when parent pipe closes |
  | Detached launch default + heartbeat “waiting on agent Nm” | **1 day** | Operator stop-relaunch thrash |
  | Review: ALL transport_failed + GREEN gate → degraded GO (strict flag for terminal) | **0.5–1 day** | Stops review-JSON HALT loop on 1-seat same-family |
  | Auto proven-ledger on GREEN when import graph hits new modules | **1–2 days** | Less vacuous after parallel land / resume |
  | Wave-scoped default gate | **2–3 days** | Cuts gate wall-clock 5–10× on multi-wave |

  **P0 bundle (EPIPE + degraded review + heartbeat):** about **2–3 focused days** for usable relief on this host. Not a multi-week rewrite. Should be a **formal Foundry improve**, not mid-run freestyle (ban-on-ad-hoc patching).

- **outcome:** friction (known residuals; EPIPE logging gap explicit)
- **provenance:** genuine-execution
