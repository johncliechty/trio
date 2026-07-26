# 0089 — P2: --attest-wave-proven + gate-scoped inventory (2026-07-25)

1. **`--attest-wave-proven`** (F-AT-1: 0043/0044/0045, 0074) — the sanctioned finish
   for a verifiably-GREEN wave the vacuous-guard cannot see. `attestWaveProven`
   (project-engine): requires a halted checkpoint, a proven ledger whose files all
   live on disk, and a GENUINELY GREEN gate re-run by the orchestrator AT ATTEST TIME
   (TIMEOUT/vacuous/RED refuse — attest never overrides the gate). Writes
   `.foreman/wave-N-attested.json` naming the human operator, advances the checkpoint
   (GO; done on terminal). CLI: `--attest-wave-proven` in run-live (exits; --resume
   continues). Retires the hand-edit-the-checkpoint move the auto-mode classifier
   rightly refused.
2. **Gate-scoped inventory** (0035's monorepo half): `gateScopePaths(command, root)`
   derives the path scope a plan-declared wave gate actually selects; `inventory()`
   accepts `{scopePaths}`; invBefore/§5-invNow/vacuous-invNow are scoped CONSISTENTLY
   when the wave declares a scoped gate — no more 2597-vs-29 comparisons. npm/yarn
   runners derive no scope (script names, not paths).

Tests: +3 (attest GO/refusals incl. RED-gate refusal; scope derivation). Suite 168/5
(the 5 = the same pre-existing set, confirmed at HEAD).

provenance: genuine-execution (direct-fix session, tests green)
