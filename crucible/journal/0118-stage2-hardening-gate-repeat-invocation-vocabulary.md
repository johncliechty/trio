# 0118 - Stage-2 Hardening Gate Requires Explicit `repeat-invocation test` Vocabulary When Plan Claims Idempotence
id: 0118-stage2-hardening-gate-repeat-invocation-vocabulary
skill: crucible
situation: Finalizing Stage-2 `writeDocTrio` in `runMatrixFastTrack` after `Claude Opus 5.5 (High)` passed `matrix:delta-verify` (`resolved: true`) on `anchor-steward-cockpit-cave-elegance-2026-11-17`.
context: `C:\dev\trio\crucible\bin\stage2.mjs` (`enforceHardeningGate`, journal 0080 mechanical property obligations).
observation: `matrix:revise` used the adjective `idempotent` in Wave 2 ("idempotent WRITE_LOCK/.bak persistence"), which triggered the `idempotence` claim detector (`/idempotent/i`), while phrasing the test as "covering ... idempotent WRITE_LOCK/.bak persistence" rather than using the literal mechanical gate token `"repeat-invocation test"` — halting `writeDocTrio` at zero-LLM serialization after all 7 LLM calls succeeded.
outcome: worked - preserved all 7 verified Matrix-Fast-Track artifacts, added explicit `"repeat-invocation test"`, `"concurrency test"`, `"escape-attempt test"`, and `"refusal path"` obligations to the Wave 1–2 `doneWhen` contracts, and verified `writeDocTrio` + `Chekhov` + `locate-plan.mjs` exit `0`.
provenance: genuine-execution - `task-4265` (`2026-11-17T19:59:43-07:00`).
