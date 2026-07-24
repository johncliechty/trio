# 0082 — Canonical onboard build flakes + Foreman improvement backlog

- **id:** 0082
- **skill:** foreman
- **situation:** Live Foreman LITE build of Canonical SKILLS_ROOT + Package A/B onboard on `C:\dev\Anchor` (2026-07-24). Plan 8 waves; product finished GREEN (249 share_ tests) but wall-clock spanned much of a day with repeated engine deaths, vacuous-GREEN thrash, and review-seat JSON HALTs.
- **context:** Seating prefs coding=review=grok (`cross_model:false`). Gate: `python -m pytest tests/ -k share_ -v`. Launch via go.ps1/PTY and later ProcessStartInfo/cmd bat. Parallel session work re-proved gates and landed missing Package B after ops advances.
- **observation:**
  ## What was flaky (and is it LITE?)

  | Failure mode | Fixable? | Caused by LITE? | Notes |
  |--------------|----------|-----------------|-------|
  | **EPIPE / silent process death** after gate (esp. entering review) | **Yes** | **No** | Node writing status to a closed stdout pipe when parent shell/redirect dies. Parent process management bug, not LITE ceremony. |
  | **Review JSON unparseable** (grok-cli labeled as review seat) → ambiguity HALT | **Yes** | **Partially aggravated** | Same-family review + flaky JSON envelope; LITE still requires review; transport_failed path should degrade more reliably when *all* reviewers fail. |
  | **Vacuous-GREEN** after resume (empty hash-diff though code on disk) | **Yes** | **No** | Known class (journals 0076–0079); proven-ledger / prior-attempt credit still brittle on untracked files + resume-at-gate. |
  | **Wrong test-command** (`tests/test_share_` collects 0) | **Yes** | **No** | Plan/locate-plan hygiene; LITE does not invent the string. |
  | **Syntax error in generated tests** → RED then EPIPE before FIX | **Yes** | **Indirect** | Execute quality; LITE shorter Shark/review on *plan* does not cause execute bugs, but fewer review rounds on plan can miss bad acceptance wiring. |
  | **Long silent execute** (minutes with no log) | **Yes (UX)** | **No** | Agent call has no heartbeat to status log; looks "dead" until it returns or dies. |
  | **Day-long wall clock** | **Partially** | **Partially** | LITE still runs real execute+gate+review per wave. Deaths × resume × full 200+ test gates × human/session relaunch dominate time more than Shark roundCap. |

  ## Root causes (ranked)
  1. **Process lifecycle / logging:** Foreman must not depend on a live parent pipe; always append to a durable log file with error-tolerant writes.
  2. **Review transport envelope:** Reviewer must return parseable JSON or ABSTAIN without HALT when gate is GREEN and agreement cannot form.
  3. **Resume/vacuous interaction:** Untracked deliverables + resume-at-gate look like no-op waves; proven ledger should auto-write after any GREEN that imported new modules.
  4. **Gate cost:** Running entire `share_` suite every wave (~20–40s × many resumes) multiplies thrash cost.
  5. **Status silence during agent calls:** No mid-execute heartbeat → operators relaunch too early or too late.

  ## Recommendations (actionable backlog)

  ### P0 — reliability (stop multi-hour thrash)
  1. **Durable log only:** `run-live` / `go.ps1` always append to `_foreman-status.log` + `_foreman-output.log` with try/catch on write; never treat EPIPE as fatal uncaughtException.
  2. **Detached-by-default launch:** go.ps1 uses a true detached child (no inherited pipe); document the one launch command that survives session close.
  3. **Heartbeat every N seconds** during execute/review agent calls (even if agent silent): touch heartbeat.json + one status line.
  4. **Review transport fail-soft:** if all reviewers transport_failed/unparseable and gate GREEN with 0 open ≥2 BLOCKERs → GO with stamp `review:degraded` (not HALT). Optional strict mode for terminal waves.
  5. **Auto wave-N-proven.json** after GREEN when import graph shows new product modules under test reachability.

  ### P1 — speed
  6. **Wave-scoped gates:** default gate = tests that import files changed this wave (or plan-declared `gate-command` per wave); full suite only on terminal wave / nightly.
  7. **Cached collect:** avoid re-collecting 2900 tests each wave when filter is stable.
  8. **LITE execute budget:** optional shorter execute prompts + "land tests that import new module" checklist in execute system prompt.
  9. **Do not re-run full execute** on resume when step=gate/review and hash of wave sources unchanged.

  ### P2 — operator UX
  10. **Checkpoint honesty when process dies:** watcher sets status=halted + pending_action=dead-process if lock pid gone.
  11. **One-line "why it looks stuck"** in status table: e.g. `waiting on agent:execute 12m`.
  12. **Clear HALT taxonomy in chat:** vacuous vs RED gate vs review-parse vs dead-process (different recoveries).
  13. **go.ps1 --doctor:** validate test-command collects >0 tests before wave 1.

  ### P3 — quality of generated code
  14. **Pre-gate syntax/import smoke** on changed files (1s) before full pytest.
  15. **Execute acceptance checklist** in prompt: "new module X must be imported by test_Y".
  16. **Ban absolute host paths** in generated onboard strings (already burned us on AGENTS pointers).

  ## Was LITE the wrong choice?
  - **LITE was fine for planning ceremony** (fewer Shark rounds) given a locked architecture plan.
  - **LITE did not cause EPIPE, vacuous thrash, or wrong pytest path.**
  - LITE **did not** make execute free: 8 real waves × full suite still multi-hour even when healthy.
  - FULL would likely have been *slower* on planning and similar on execute thrash.

  ## Time budget honesty
  A healthy 8-wave share surface with ~200 tests should be hours, not a full day, if: durable process, fail-soft review, wave-scoped gates, no silent death. Most of the day was **relaunch / vacuous / review-parse / EPIPE**, not pure coding.

- **outcome:** friction
- **provenance:** genuine-execution
