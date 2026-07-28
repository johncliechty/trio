# 0093 — 19 GREEN waves, ZERO commits, and an EXECUTION-LOG that says "no waves built yet"

- **id**: 0093-nineteen-green-waves-zero-commits
- **date**: 2026-07-28
- **run**: Ecgberht steward data tracking & indexing, `C:\dev\Ecgberht\planning\steward-tracking-2026-07\stage2\` (grok-driven Crucible → Foreman, 19 waves)
- **outcome**: **the build genuinely succeeded** — 671 tests green (up from a 247 baseline), all 19 waves GO, terminal wave gate exit 0. This journal is about the *bookkeeping* around a real success, not a failed build.

## What went right (record it, so the fixes below are not mistaken for a bad run)

- All 19 waves reached GO; the full hermetic suite runs green on Windows.
- Wave 19's deliverables are genuinely present (`steward doctor` in `engine/verbs.mjs`, `test/w5x-class-symmetry-audit.test.mjs`, `test/w5x-decision-ledger-lint.test.mjs`, zero remaining `UNIMPLEMENTED` stubs).
- The attestation path behaved correctly: each `--attest-wave-proven` **re-ran the orchestrator-owned gate** rather than overriding it (`attest: re-running the gate for wave N (orchestrator-owned; must be genuinely GREEN)`). No forged GREEN.

## FINDINGS

### F1 — `last_commit: null` after 19 GREEN waves (P0)

`foreman-checkpoint.json` ends with `status: done`, `last_verdict: GO`, and
**`last_commit: null`**. Nothing was committed. At review time the tree carried
**22 modified + 74 untracked files** — the entire delivered subsystem
(`engine/append-log.mjs`, `engine/portfolio/`, `engine/encoding.mjs`, 424 new
tests) sitting uncommitted.

SKILL.md §9 promises "dedicated work branch, **commit-only-on-GO**". Nineteen GOs
produced zero commits. The work is real and green and **one `git checkout .` from
gone** — in a repo that, until 2026-07-27, had no version control at all.

This is the most consequential kind of silent failure: everything reports success
and the durability guarantee simply did not run.

### F2 — EXECUTION-LOG.md still reads "no waves built yet" (P0, same root)

After 19 GREEN waves the emitted log says verbatim:

```
_(no waves built yet — Foreman appends a GREEN/HALT entry per wave)_
```

SKILL.md states "**EXECUTION-LOG.md is orchestrator-appended on every GO** (one
GREEN line per wave, committed with the wave) — downstream agents can trust it for
prerequisites." A downstream agent trusting it here would conclude nothing was
built. F1 and F2 are almost certainly the same missing post-GO step.

### F3 — 8 of 19 waves needed manual attestation (P1)

`_attest-w12.log` … `_attest-w19.log` — waves 12 through 19 each required a human
`--attest-wave-proven`. The attest path re-ran the gate and got genuine GREEN each
time, so the *evidence* was sound; the *guard* could not see it. A run that needs
eight human interventions to close is not autonomous, and the pattern (an unbroken
tail, w12→w19) says the vacuous-GREEN guard systematically stopped recognising
deliverables once the suite grew — not eight independent flukes.

### F4 — A stale root checkpoint shadows the real one (P1)

`C:\dev\Ecgberht\foreman-checkpoint.json` (dated **Jul 24**, `total_waves: 6`,
`plan_path: C:\dev\Ecgberht\IMPLEMENTATION-PLAN.md`) is a leftover from an
unrelated earlier build, sitting in the repo root beside a *different*
`IMPLEMENTATION-PLAN.md` (6 waves, Jul 25). The live run's real state lives at
`planning/steward-tracking-2026-07/stage2/foreman-checkpoint.json` (19 waves).

Anyone — human or agent — inspecting "the checkpoint" at the project root reads a
stale run and concludes the wrong plan was built. It cost me a wrong conclusion
during this review before timestamps corrected it. Foreman should either namespace
its checkpoint to the plan it belongs to, or refuse to start when a root checkpoint
points at a different `plan_path` than the one being built.

### F5 — An open BLOCKER the ground-truth gate refutes (P2)

`open_findings` carries
`{"id": ".foreman/wave-19-gate.json:1+wave-not-implemented", "severity": "BLOCKER"}`
while **that exact gate file** records `"exit_code": 0, "green": true,
"gate_class": "GREEN"`. §5 says the orchestrator-run gate dominates reviewer
claims. A reviewer finding whose own cited artifact contradicts it should be
auto-dismissed at judge time, not carried into the final checkpoint where it reads
as unfinished work.

## STANDING RULES

1. **A GO that does not commit is not a GO.** Verify the commit landed (a real SHA
   in `last_commit`) before advancing; a GO with `last_commit: null` HALTs.
2. **EXECUTION-LOG append is part of the GO transaction**, not a side effect — if
   the append did not happen, the wave is not done.
3. **Attestation is telemetry.** Count it. Two or more attested waves in a run
   should print a warning; a contiguous run of them is a guard defect and should be
   reported as one, not absorbed silently.
4. **Refuse to start against a foreign checkpoint** — if a checkpoint's `plan_path`
   differs from the plan being built, HALT and say which two plans are in play.
5. **The gate refutes the reviewer.** A finding citing a gate artifact that reports
   GREEN is dismissed at judge time with a note, never carried as a BLOCKER.

- **provenance**: genuine-execution (post-run review, 2026-07-28). Build verified green independently: `node scripts/run-all-tests.mjs` → 671/671.
