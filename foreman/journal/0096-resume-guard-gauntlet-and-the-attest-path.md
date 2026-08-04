- `id`: 0096-resume-guard-gauntlet-and-the-attest-path
- `skill`: foreman@steward-v3-heavy (grok execute/fix · claude-fable-5 review)
- `situation`: Resuming a build after out-of-band repo surgery (a corrective package
  landed 6 commits between Foreman runs), where the wave being resumed had its
  deliverable ALREADY on disk.
- `context`: Ecgberht steward build, waves 5→6 of 22, 2026-08-03. John's words:
  *"This seems like a thrash, like a waste of time induced by foreman misbehaving,
  true? Why am I wasting my time and tokens on this."*
- `observation`: **Mostly NOT Foreman misbehaving — mostly the operator giving it an
  incoherent instruction.** Every guard fired correctly; the cost came from learning
  their contract by trial. Five things a future operator should know BEFORE resuming:

  1. **`current_wave` is the LAST COMPLETED wave.** Setting it to 5 to "re-prove wave
     5" resumes at wave **6**. To re-execute wave N, set `current_wave = N-1`. Caught
     from the resume banner (`continuing from wave 6/22`) and killed in ~1 minute, but
     it had already started spending.
  2. **A wave whose deliverable already exists CANNOT be re-proven by re-execution.**
     It changes no source, the suite is already green, and the vacuous-GREEN guard
     correctly refuses: *"an already-green suite proves nothing about this wave's
     deliverable."* This is the machine enforcing "a green suite is not a gate result".
  3. **The sanctioned finish for that case is `--attest-wave-proven`**, which is NOT a
     bypass: it RE-RUNS THE REAL GATE (orchestrator-owned), verifies every file in the
     proven ledger exists on disk, then writes the attestation. It requires a valid
     `.foreman/wave-N-proven.json` to exist first — and Foreman's own blocker text
     names this path, so READ THE BLOCKER before improvising.
  4. **The proven-ledger field is `files`.** An older ledger recoverable from git
     history uses `changed`, which attest reports as *"the proven ledger lists no
     files"* — a schema mismatch that reads like an empty-wave error.
  5. **Do NOT restore a deleted proven ledger from git history without checking WHOSE
     it is.** The recoverable copy here belonged to a different, earlier effort
     (different deliverables, different test count). Restoring it would have FORGED the
     proof — the precise failure class the surrounding correction existed to remove.

  **The resume-guard gauntlet** (each correct, each costing a cycle): `HEAD advanced
  past the checkpoint AND the tree is dirty` → `HEAD is multiple commits ahead …
  resolve manually (§8)` → `unexpected uncommitted changes diverge from the
  checkpoint`. The lesson is not that the guards are wrong — under the old launcher
  `--force` steamrolled all three — but that **repo surgery between runs costs one
  guard cycle per unsynced thing**. Sync the checkpoint and commit the tree BEFORE
  invoking resume, not iteratively.
- `outcome`: friction (≈1 operator-hour + ~$1.76 of halted runs) — resolved: wave 5
  attested GO by a real orchestrator gate re-run, build advanced to wave 6
- `provenance`: genuine-execution

## Lesson (one line)

**Before resuming after out-of-band commits: set `current_wave = N-1`, commit
everything, and if the wave's deliverable already exists, go straight to a source-only
`files` ledger + `--attest-wave-proven` — the guards are right, and improvising against
them is what costs the hour.**
