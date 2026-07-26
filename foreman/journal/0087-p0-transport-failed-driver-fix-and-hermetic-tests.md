# 0087 — P0: unparseable reviewer JSON now transport_failed in ALL drivers; stub-pinned dispatch stops live-session test leak (2026-07-25)

From the 2026-07-25 journal-hardening review: journal 0004-tidy claimed the driver-side
`transport_failed` mapping landed "same day" — **it had not**; all five drivers still
returned bare `{answerable:'no'}` on parse-failure-after-retry, which the §4.7 ambiguity
gate catches FIRST as a hard HALT, making T10a/T10a-bis degrade unreachable for the
dominant live failure shape (re-fired 2026-07-24 in 0080/0081-ecgberht, one day after
0084 declared the class P0-CLOSED).

**Fix (additive, cross-consumer-safe):** the parse-failure abstain in
`drivers/{grok-cli,claude,gemini-cli,index,_seam}.mjs` now returns
`{ answerable:'no', transport_failed:true, ... }`. Foreman's transport check runs BEFORE
the ambiguity gate and drops/degrades the seat; `answerable:'no'` is retained so
Crucible's shark quorum still counts the seat as UNANSWERED (the 0004/0005 fake-dry
guard is untouched — verified, shark-tank suite 17/0). A genuinely-parsed "no" carries
no transport flag and still ambiguity-HALTs (pinned). New engine test in
`test/wave-engine.test.mjs` pins the exact end-to-end shape; driver tests assert the flag.

**Bonus P0 (usage-leak class, 07-14):** the 2026-07-22 prefs-precedence change made
`runAgent` route by `~/.anchor/model_prefs.json` BEFORE considering a test's injected
stub — stubbed driver tests were spawning REAL billable CLI sessions (observed live:
"Hi — what do you want to work on?" answering a stub test). Fix: an injected stub
transport (`runClaude`/`runGemini`/`runGrokCli`) now PINS its matching backend in
`drivers/index.mjs` ahead of prefs; plus the stale `TRIO_DRIVER_<ROLE>` test now
neutralizes host prefs explicitly. Drivers suite: 289/0 in 0.6s (was 100+s with live
spawns and 5 failures).

Still open (pre-existing, confirmed at HEAD): foreman full-suite fails — lock-lifecycle
(POSITIVE), live/stale-committing abort, preflight explicit-files, F3 anti-drift — the
documented outside-sleep-family set.

provenance: genuine-execution (direct-fix session, tests green)
