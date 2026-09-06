# 0112 — Grok's headless turn cap silently degraded every review (and the elegance adversary)

**Date:** 2026-09-05 · **Run:** Anchor reports-links build (execute/fix Claude, review + adversary Grok)

## What happened

Wave 1 went GREEN at the gate, then the log said:

    review: ALL 1 transport-failed but gate GREEN — review:degraded
      (reviewer 0 call rejected (trio seat verification_fail_closed: review:w1#0))

and the wave CONVERGED as review:degraded. The elegance adversary (the shark seat, also Grok) hit the
same retry. Grok's own session transcripts under `~/.grok/sessions/<project>/` showed why: each review
session ends after about six assistant turns with a mid-investigation sentence ("I'll check which
page actually owns the deliverables pane…") and no final JSON. Headless `grok -p` stops at a default
turn cap; the driver passed no `--max-turns`, so a reviewer that reads files never got to answer. Its
last prose line was the whole reply, schema-nonconforming twice, verification failed closed — and the
engine, honestly, said "review:degraded" and moved on. Three waves would have shipped un-reviewed by
the second family while the log stayed GREEN.

## The fix (drivers/grok-cli.mjs)

- `--max-turns` is always passed (`GROK_CLI_MAX_TURNS`, default 40).
- NOT grok's `--json-schema`. It was tried first: the live smoke returned a conforming object — but on
  the resumed run the reviewer answered "not answerable" in 8 seconds with 0 tool calls, and a second
  smoke ("read VERSION and put its contents in note") answered `"I'll read VERSION now…"` without
  reading it. Under that flag the model emits the structured object on its FIRST turn and never touches
  its tools. Without the flag and with the cap, the same prompt used the file tool (2 turns) and returned
  the JSON glued after one narration line, which the seam's parser already handles. The schema stays
  the prompt-suffix + parse contract; the turn cap is the whole fix.
- The receipt now carries `stop_reason` and `num_turns`, so a cap hit is visible on the record.

Tests: `drivers/test/grok-cli-flags.test.mjs` (argv captured through an injected process runner);
drivers suite 204/204.

## The steward's call on the run

Killed the run at the wave-1 checkpoint (`intra_wave_step=review` after the GREEN gate), fixed the
driver, resumed with `--resume --clear-halt`: wave 1 re-enters at review, so it gets a REAL
cross-family review and adversary before GO, then waves 2–3.

## Owed

- The GREEN line in EXECUTION-LOG.md must carry `review:degraded` when it was (already on the list).
- A seat that fails verification twice in one run should HALT the run, not degrade every wave.

## Addendum (same evening): the second cause, found in grok's own event log

With the turn cap in place a reviewer STILL dropped on wave 1's third review. `~/.grok/sessions/<project>/
<session>/events.jsonl` ended every failed review the same way:

    permission_requested run_terminal_command → permission_resolved decision: cancelled →
    turn_ended outcome: cancelled, cancellation_category: permission_cancelled

The reviewer ran 26 turns and 95 tools, 94 asks auto-allowed, then one chained / redirected PowerShell
command (`… 2>$null ; if (Test-Path …) { … } else { … }`) needed an approval, headless mode cancelled
it, and grok ended the turn with no answer — the envelope says `stopReason: "cancelled"` and its text is
one narration line. Reproduced on demand with that command shape in plan AND dontAsk modes; plain
single commands (pytest, git log, python -c) never ask. So the first failures of the day were most
likely this class too, not the turn cap alone.

Fixes (drivers): a verification seat's prompt opens with the read-only constraint
(`GROK_HEADLESS_READONLY_NOTE`); the receipt carries `turn_cancelled`; the shared schema retry says
"turn was CANCELLED (a tool ask cannot be answered headless)" instead of "schema-nonconforming", re-prompts
with the constraint, and a second cancel fails closed with an error that says so. Tests:
`drivers/test/cli-schema-cancelled.test.mjs`; drivers suite 210/210.

Owed: grok exposes no "deny and continue" for headless asks; if a future grok adds one, prefer it to the
prompt rule.
