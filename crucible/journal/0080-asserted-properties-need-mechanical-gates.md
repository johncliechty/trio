# 0080 — A plan that ASSERTS a property must emit a mechanical gate for it (the steward's "append-only" was prose)

- **id**: 0080-asserted-properties-need-mechanical-gates
- **date**: 2026-07-27
- **run**: post-hoc hardening review of the Ecgberht steward (Crucible-planned, Foreman-built) against `C:\dev\Anchor` branch `v1.2`
- **situation**: The steward shipped 8 HTTP routes, 13 functions and ~670 lines of Python + JS. The wiring was correct — every route reached a handler, every handler was routed, every endpoint the UI called existed, every route was token-authed, traversal containment was right, and the Node bridge failed honestly rather than open. Then a hardening pass found **six real defects and zero tests**. This is the same shape as journal 0079: the plan *said* the right thing and nothing *forced* it.

- **the defect class that survived planning** — every one of the six is "an asserted property was implemented as prose":

  1. **"Strip is append-only; receipts are never lost."** `engine/write-authority.mjs` enforces this *logically* — it rejects silent in-place rewrite of `STRIP_PROTECTED_FIELDS`. But the storage layer underneath is a bare `fs.writeFileSync` on `strip.json`: **no atomic temp+rename, no lock file, no git commit**, and the whole flow is read-modify-write. Two concurrent acts silently drop one set of receipts; a write interrupted mid-flight truncates the ledger. Worse, Anchor's own bridge wrapper calls `subprocess.run(..., timeout=20)`, which **kills the child on timeout** — so the platform can kill a write in progress. The append-only guarantee is a *validation* rule sitting on storage that can lose data.
  2. **"The steward never invents; unknown is spoken as unknown."** `_ecgberht_portfolio_roots()` was `except Exception: pass; return []`, so a registry read that BLEW UP was rendered to the user as the cheerful "no active R&D project folders to steward", and the ambient badge painted **queue 0** — which reads as *nothing needs you*. The one surface whose entire purpose is honest signal was the surface that lied under failure.
  3. **Closed-verb argument passing.** Roots go to the engine as a single `--roots a;b;c` string with no delimiter guard; a semicolon is legal in a Windows directory name, so one such project silently splits into two bogus roots.
  4. **Unbounded resource on a shared thread** — the artifact route read whole files into memory with no cap.
  5. **A blank `folder_path`** reached the bridge as `--project ""`, spawning Node to work on nothing.
  6. **A fixed-rate 90s `setInterval`** polling an endpoint that *spawns a Node subprocess* — every open tab spawning a process forever, at full rate even while failing. Same family as the zombie-hunter 74-cycle restart storm this repo had already been burned by.

- **root cause (planning-side)**: Stage 2 acceptance criteria described *behaviour under success* ("the chamber renders the view model", "acts are closed"). None of them named a **failure state** or a **durability property** as a testable artifact. A reviewer could pass every wave without ever asking "what does this render when the registry is unreadable?" or "what happens if two of these run at once?". Honesty and durability were treated as design intentions rather than as acceptance criteria.

- **STANDING RULE for future Crucible runs (adopt at Stage 2 emit)**: when a plan asserts a **property** — append-only, never-lost, idempotent, atomic, single-writer, honest-under-failure, bounded — Stage 2 MUST emit that property as a **mechanical gate**, exactly as journal 0079 requires for approved mockups:

  1. **Durability claims are storage claims.** "Append-only" / "never lost" / "single writer" ⇒ the plan must require atomic write (temp + fsync + rename), a lock or a documented single-writer serialization, and a **concurrency test** (two writers, assert nothing is dropped). A module that merely *validates* append-only does not *provide* it — say which layer provides it.
  2. **Every surface gets a failure-state table.** For each endpoint: dependency-missing, dependency-slow/killed, dependency-returns-garbage, backing-store-unreadable, empty-but-valid. Each row names the status code and the user-visible text. "Unknown" and "empty" MUST be different rows — collapsing them is the single most common honesty defect in this codebase (see also the Anchor summarizer blank-vs-ungroundable finding, 2026-07-26).
  3. **Any value crossing a process boundary as a delimited string** needs a delimiter guard in the plan (reject/escape/drop-and-report), not just in review.
  4. **Any client-side poller against an endpoint that spawns a process** must be planned with visibility gating + failure backoff. Fixed-rate polling of a spawning endpoint is a standing BLOCKER finding.
  5. **Sharks should attack the plan for "property asserted, no gate emitted"** as a standard finding class — the sibling of 0079's "mockup referenced but not enforced".

- **note on scope**: this is *not* a claim that the steward was badly built. The wiring was clean on arrival and better than expected. The point is narrower and worse: **nothing kept it that way, and the properties the design was proudest of were the ones with no mechanism behind them.** Both defects this repo hit the same week were "correct once, then silently rotted" — a required file missing from a deny-by-default manifest (public v1.1.0 could not start at all), and a 10-minute status cadence that was documented and never armed.

- **provenance**: genuine-execution (hardening review, 2026-07-27; fixes landed on `C:\dev\Anchor` `v1.2` @ 7e59dcc with 18 new tests)
