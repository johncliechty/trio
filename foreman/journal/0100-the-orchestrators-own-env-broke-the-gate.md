# 0100 — the orchestrator's own env broke the gate, and two guards fired on the human's fix

- **id:** 0100
- **skill:** foreman
- **situation:** E1 rolling-cash-planner build, Family-Finances, 7 waves LITE/standard. Three run attempts, wave 1 only.
- **context:** Project has a standing safety rule — agents must use a working-copy `LEDGER_DB`, never the live DB (a prior incident wrote NULL over 464 rows). So the launcher shell exported `LEDGER_DB=<working copy>`.
- **provenance:** genuine-execution
- **outcome:** friction (wave 1 reached GREEN 244/244; halted twice on guards, both correctly)

## Observations

**1. A plan-declared gate containing a shell glob is unrunnable.** The plan declared
`pytest tests/test_plan_*.py tests/test_month_totals*.py`. The engine spawns without a shell, so pytest
got the literal glob, exited 4, and wave 1 halted vacuous-GREEN — while the wave's code was correct and
its tests passed under bash. `-Doctor` diagnoses this in one second and should be run BEFORE the first
launch, not after the first halt. Fix was a plan amendment to a glob-free `pytest tests/`.

**2. The orchestrator's exported env silently redefined what the suite validates.** The engine passes
`process.env` to the gate. Four SSOT modules in this repo resolve their DB *at import time* with
`LEDGER_DB` outranking their frozen snapshots, and their golden pins (e.g. April-2026 chart expenses ==
41591.67) are traceable only to that frozen lineage. So a working-copy `LEDGER_DB` — exported to satisfy
the project's own safety rule — made the suite validate live-lineage data and go RED on an unrelated pin.
**The safety rule and the gate's determinism were in direct conflict, and nothing surfaced that.** The fix
agent found it in ~6 minutes of reading and fixed it at the right layer: a `tests/conftest.py` that scrubs
an *inherited* `LEDGER_DB` before collection, loudly, leaving production resolution and per-test env
management untouched.

**3. `--clear-halt`'s refusal is a regex on the halt text, not a check on landed source.** The message
says "land import-tested source … then --resume", so I committed the wave's source and retried. Refused
again — `clearHaltedCheckpoint` only tests `/vacuous-GREEN/i` against `pending_action`. The wording reads
like a precondition the engine verifies; it is advice. `--force` is the only path once the precondition is
genuinely met. Worth rewording, or worth actually checking for landed source.

**4. test-immutability fired on the correct fix.** FIX may only change non-test code. The fix agent's
`conftest.py` is test *infrastructure*, not a test, and it weakened nothing — but the guard can't tell
"made the suite hermetic" from "added a test that games the gate", so it halted for a human. That is the
guard working, and it caught the right class of thing; it just cannot classify within it. A FIX-added
`conftest.py`/fixture file may deserve its own halt sub-type rather than the generic test-edit one.

**5. `go.ps1` has no `-Force`, and `run-live.mjs --help` starts a live run.** `--help` isn't handled, so
a help probe acquired the lock and began wave 1 with the wrong reviewer count and no `LEDGER_DB` — i.e.
the probe itself violated the project's safety rule. I killed it inside a minute and the live DB tripwires
held, but an unrecognised flag should not be a silent build launch.

## Outcome

Wave 1 GREEN (244/244) on iteration 1; run halted awaiting human authorization of the `conftest.py`.
2 agent calls, ~$8.83 subscription-equivalent, ~14 min. Live DB untouched across all three attempts
(tripwires 8896 rows / 16 NULL / 163 rules verified after each).

## Lesson

Run `-Doctor` before the first launch. And when a project has a standing env-based safety rule, check
whether the test suite reads that same variable — here the rule that protects the database was the thing
that broke the gate, and only a careful sub-agent surfaced it.
