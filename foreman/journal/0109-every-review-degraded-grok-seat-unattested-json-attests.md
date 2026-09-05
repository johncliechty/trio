# 0109 — every wave's review was thrown away: the Grok reviewer ran 8–16 minutes per wave, then the seat contract rejected it as unattested; Grok's JSON output attests the model

**Date:** 2026-09-04
**Project:** C:\dev\Skill Foundry\skills\literature-review (run 4 of journal 0108; 5/5 waves GO, 558 tests)
**Class:** review:degraded on EVERY wave — the build has no independent review, and the log says CONVERGED.

## What happened

Routing was `execute=claude · review=grok-cli · fix=claude` (execute pinned to Claude after the codex seat
produced nothing; the reviewer went cross-family to Grok because codex refuses verification roles). On every
wave the reviewer call ran to completion (8–16 minutes; wave 3 even got the strict schema re-prompt), and then
`dispatchWithFailover` rejected it: `verification_fail_closed` / `served_unattested` — "verification requires
attested served family and model". The grok-cli driver reads `--output-format plain` and stamps
`model_served: null, model_attested: false` by construction. Foreman's T10a-bis rule then dropped the
reviewer and proceeded on the GREEN gate (`review:degraded`, §5 ground truth). Five times. ~$43 of
subscription-equivalent work, none of it reviewed.

Two defects, one honesty gap:

1. **The contract judges the seat AFTER the call.** An unattestable verifier should be refused at dispatch
   (seconds), not after a 16-minute review. `chatgpt-cli` already does this up front
   (`unattested_verification_model`); grok-cli did not.
2. **Grok CAN attest.** `grok -p … --output-format json` returns `{ text, modelUsage: { "<served model>": … },
   usage, total_cost_usd, … }` — the served model is right there (`grok-4.6-build` on the probe). The driver
   simply never asked for it.
3. **"CONVERGED: gate GREEN and no verified blocking finding"** reads as a verdict. It is a gate result. The
   execution log's GREEN lines say "iter 0" and nothing about the review having been dropped.

## The fix (this entry)

- grok-cli driver: `--output-format json`; parse `text` for the reply and `modelUsage` for the served model →
  `model_served`, `model_attested: true`, `family_attested: true`, `degraded: false` when exactly one served
  model is reported (or it matches the request); plain/unparseable output falls back to the old unattested
  stamp. Verification seats on Grok now pass the contract honestly — the rule is unchanged.
- The seat contract's rule stays "attested family AND model for verification". Nothing was loosened.

## Owed

- Refuse an unattestable verifier at dispatch, before the call (a driver capability flag the contract can read).
- The wave GREEN line in EXECUTION-LOG.md must carry `review:degraded` when it applies; "CONVERGED" must not be
  printed when no reviewer verified anything — say "gate GREEN, review dropped".
- The literature-review build's adversarial read (Gandalf on the built skill) — launched after this fix.
