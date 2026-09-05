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
- When a seat asks for a schema, the call carries grok's own `--json-schema <schema>`: the model is
  constrained to the shape, so the envelope's `text` IS the requested JSON, not the last line of an
  investigation. A live smoke with the review schema returned a conforming object with `modelUsage`
  attesting `grok-4.6-build` and `stopReason: end_turn`.
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
