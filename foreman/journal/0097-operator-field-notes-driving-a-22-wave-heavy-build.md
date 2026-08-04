- `id`: 0097-operator-field-notes-driving-a-22-wave-heavy-build
- `skill`: foreman@steward-v3-heavy (grok-4.5 execute/fix · claude-fable-5 review)
- `situation`: An operator supervising a long Heavy build wave-by-wave, resolving each
  HALT by hand. Six things cost real time; each is cheap once known.
- `context`: Ecgberht steward build, waves 5→12 of 22, 2026-08-03. Sibling to 0095
  (thrash root cause) and 0096 (resume-guard gauntlet).
- `observation`:

  **1. The gate artifact's TAP block reports ONE LANE.** `wave-N-gate.json` showed
  `tap: {tests: 768, pass: 768, fail: 0}` while `gate_class: RED` — the failure was in
  the auth-on lane, which TAP never captured. The fix agent's guidance IS the gate
  artifact, so it was handed evidence saying *there is nothing to fix* on a red gate.
  It converged anyway, but it had to spelunk raw stdout to do it. Anyone reading the
  summary alone concludes the wave is green when it is not.

  **2. The proven-ledger field is `files`.** An older ledger recoverable from git
  history uses `changed`; attest then reports *"the proven ledger lists no files"*,
  which reads like an empty-wave error rather than a schema mismatch.

  **3. Fix agents relax assertions to RANGES.** Wave 10's fix turned
  `assert.equal(ROADMAP_EVENT_KINDS_VERSION, 1)` into `assert.ok(… >= 1)` — passes for
  ANY future version and silently absorbs an accidental bump. Re-pin to the CURRENT
  value (`=== 2`) so every bump stays deliberate. Watch for `equal → ok(>=)`,
  `deepEqual → includes`, and exact counts becoming `>= n` in any fix diff.

  **4. After committing a wave's work to clear a test-immutability HALT, CHECK THE
  GATE FIRST.** If it is already green, the wave has nothing left to exercise and
  resuming vacuous-HALTs by construction — go straight to `--attest-wave-proven`. I
  documented this in 0096 for Wave 5 and then walked into it again at Wave 10, because
  Wave 6 had happened to still have real failures after the commit and lulled me.

  **5. On a NAME COLLISION, the PROVEN wave keeps the name.** Wave 11 introduced
  `recomputeProposalHash` (commission: `{skill, seat, depth_cell, estimate}`) colliding
  with Wave 9's (scaffolding: `{goal, steps[]}`). Both legitimate. My first fix gave
  the plain name to the new one and broke two tests in an already-PROVEN wave.
  Renaming under a proven wave silently invalidates its proof — the in-flight wave
  takes the explicit alias.

  **6. A duplicate-export guard CANNOT be a test.** Three run-stopping
  `syntax-smoke HALT: Duplicate export of …` in `engine/index.mjs` (waves 7, 9, 11).
  I added `test/wop-index-export-hygiene.test.mjs` to turn them into a RED gate — but
  a duplicate export is a SyntaxError, so the barrel never parses and no test can run.
  Syntax-smoke necessarily catches it first. The guard still earns its place for the
  LOADABLE cases: it caught the barrel exporting the FIXTURE `batchConfirmScaffolding`
  (different signature to production) and the fixture copy of
  `DEFAULT_ORANGES_PROMPTS`. Prevention for the SyntaxError class has to live in the
  execute step, not the suite.
- `outcome`: worked (waves 5–11 proven; 12 running) with ~2 operator-hours of HALT
  handling
- `provenance`: genuine-execution

## Lesson (one line)

**Every HALT in this build was correct, and every one was hiding something a
green-at-any-cost fix would have kept — a proof that never ran, a fixture shipped as
the API, an assertion relaxed to always-true; budget the operator time and read the
blocker text before improvising.**
