# 0105 — the 27-red suite root-caused: 183/183 green (2026-08-25)

Follow-up to 0104's finding. A read-only investigator formed ranked hypotheses from code;
each was then tested live. Five causes, three of them REAL ENGINE/HARNESS defects:

1. **ENGINE BUG (the big one, ~11 tests + every real wave touching a short-named file):**
   `delta-coverage-gate.mjs tokensFor` dropped all name tokens <4 chars, and a zero-token
   surface was UNCONDITIONALLY uncovered — `src/f1.js` could never pass the gate even with a
   test literally importing it (confirmed by direct call: covered f1.js → pass:false). A
   false BLOCKER in production, not just red fixtures. Fix: zero tokens fall back to the
   whole stem; uncovered-with-no-test still blocks (both directions verified).
2. **F2-9 CONTRACT VIOLATION (~10 tests):** the gate read only IN-WAVE test files, so a wave
   that CHANGES a source covered by a PRE-EXISTING unchanged test blocked — violating the
   suite's own pinned contract ("changes and covers ⇒ GO"; 0091's law targets surfaces with
   no test ANYWHERE). Fix: bounded repo-test rescue at the wave-engine callsite (≤200 test
   files, ≤64KB each, same token rule via the now-exported tokensFor); every rescue is
   RECORDED in the persisted delta verdict — never silent.
3. **Lock-lifecycle test wrote its planted lock ONE LEVEL TOO HIGH** (test resolved
   `../../..` = C:\dev; the engine resolves bin/../.. = the trio root) — verifyResumeGate
   never saw it. Fix: the test derives the path the engine's way.
4. **Preflight self-scan trap:** `preflightTestCommand` with no projectDir defaulted to cwd
   (the live repo) and tripped on gate-preflight.test.mjs's OWN `'../../../outside/…'`
   fixture literals. Fix: hermetic tmpdir fixture + explicit projectDir.
5. **Stale regex:** `[taxonomy:ambiguity] HALT` (intended 2026-07-25 hardening) vs the old
   `/ambiguity HALT/` expectation. Test updated, taxonomy named.

Result: foreman **183/183**; researchPrime's cross-suite fence now also green (**198/198**).
The docs' "suite green" claim is TRUE again for the first time in weeks. Lesson (rule 6, for
the suite itself): a suite nobody runs end-to-end is a STATUS claim, not a gate — the
elegance-review S-bundle was the first full run in long enough that five independent rots
had accumulated. provenance: genuine-execution.
