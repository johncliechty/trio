# 0091 — A wave that adds a SURFACE and ships zero tests must be a BLOCKER, not a nit

- **id**: 0091-a-new-surface-with-zero-tests-must-be-a-blocker
- **date**: 2026-07-27
- **run**: post-hoc hardening review of the Ecgberht steward (Crucible-planned, Foreman-built) against `C:\dev\Anchor` branch `v1.2`
- **situation**: The steward build went GREEN. It delivered **8 HTTP routes, 13 Python functions, ~300 lines of handler code and ~372 lines of JS — with not one test file mentioning it.** A later hardening pass found six real defects. Every other subsystem in that repo carries a stub gate; this one carried none, and the build gates never noticed, because nothing in the gate asked "does this new surface have a gate?".

- **what a green build did NOT catch** (all six found later, by reading):
  - a swallowed exception rendering a **broken registry as an empty portfolio**, and an ambient badge painting **queue 0** (= "nothing needs you") when the truth was "unknown";
  - `strip.json` — the append-only receipt ledger — written with a bare `fs.writeFileSync`: **no atomic temp+rename, no lock, read-modify-write**, so concurrent acts silently drop receipts. Compounded by the caller: Anchor's bridge uses `subprocess.run(timeout=20)`, which **kills the child on timeout**, i.e. the platform can kill a write mid-flight;
  - roots passed as one `--roots a;b;c` string with no delimiter guard (a semicolon is legal in a Windows directory name);
  - an unbounded `read_bytes()` on a shared server thread;
  - a blank `folder_path` reaching the engine as `--project ""`;
  - a fixed-rate 90s `setInterval` polling an endpoint that **spawns a Node subprocess** — every open tab spawning a process forever, at full rate even while failing. This repo had *already* been burned by exactly this shape (the zombie-hunter 74-cycle restart storm).

- **root cause (build-side)**: Foreman's wave acceptance measured "the deliverable exists and the suite is green". A wave that adds a surface but adds no tests trivially satisfies both: the existing suite stays green *precisely because* the new code is untested. **Test-coverage of the delta was never a gate**, so "0 tests for 670 new lines" and "full coverage" produced the same verdict.

- **STANDING RULE for future Foreman runs**:
  1. **Delta-coverage gate.** A wave that adds an HTTP route, a handler, a CLI verb, or a persistence path MUST add a test that names it. Zero tests touching the new surface ⇒ **BLOCKER**, phrased as a coverage-of-the-delta check, not a global percentage (a global % is gameable and stays green while a whole subsystem is bare).
  2. **The stub-gate convention is a build artifact, not a courtesy.** In a repo that has stub gates (`tests/test_<subsystem>_<wave>.py`), a new subsystem without one is an incomplete wave. Check the repo's own convention and enforce it.
  3. **Wire-up assertions are cheap and catch rot.** Every-route-reaches-a-handler, every-handler-is-routed, every-endpoint-the-UI-calls-exists, every-route-is-authed. These are static-text assertions needing no server boot — ~5 tests that would have permanently protected this surface. Emit them by default for any wave adding routes.
  4. **Failure-path tests, not just happy-path.** For each new surface: dependency missing, dependency killed/timed out, backing store unreadable, empty-but-valid. Assert the *status code and the user-visible text*, because the recurring defect here is not a crash — it is a **confident wrong answer** ("no projects", "queue 0") where the truth was "unknown".
  5. **A poller against a spawning endpoint** ships with visibility gating + backoff, or it does not ship.

- **the honest framing**: the build was not sloppy — the wiring was correct on arrival, and better than expected. The failure is that **a green Foreman run currently cannot distinguish "this works and is protected" from "this happens to work today"**. Until delta-coverage is a gate, GREEN means the first and reads like the second.

- **provenance**: genuine-execution (hardening review, 2026-07-27). Fixes + the missing stub gate landed on `C:\dev\Anchor` `v1.2` @ 7e59dcc — 18 tests pinning both the wiring structure and the honesty properties. See crucible journal 0080 for the planning-side rule.
