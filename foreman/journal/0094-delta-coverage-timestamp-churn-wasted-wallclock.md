# 0094 — Delta-coverage + timestamp-only artifact churn wasted an hour and made Foreman look clumsy

- **id**: 0094-delta-coverage-timestamp-churn-wasted-wallclock
- **date**: 2026-08-03
- **skill**: foreman
- **run**: Ecgberht steward campaign orchestration v3 Heavy  
  `C:\dev\Ecgberht` (plan: `planning/steward-handoff-v3/IMPLEMENTATION-PLAN.md`, 22 waves)  
  branch `foreman/steward-v3-heavy`, coding=grok / review=claude
- **situation**: Wave 4 BUILD-E (handback contract + Anchor executor + G4) after W1–W3 genuine GO
- **outcome**: friction (multiple HALT/resume cycles on a non-product defect; real work was green)
- **provenance**: genuine-execution

## What actually went wrong (not a failed product wave)

Wave 4's **orchestrator gate was GREEN** (708 then 718 tests pass). Lean review produced **0 agreed BLOCKER/MAJOR**. G4 anti-stub evidence eventually landed as `artifacts/g4-verdict.json` **PASS** (trio cmdline + receipt-validate + pid/create_time).

The run still HALTed **twice** on:

```
delta-coverage HALT: artifacts/fix-item-ledger.json (persistence) — no test naming them
```

That cost roughly **two extra full execute→gate→review cycles** (~30–45+ minutes of wall clock, plus review tokens) for a **timestamp-only rewrite** of a Wave-3 ledger. To the principal it reads as: "the system is broken / amateur," even when the suite is green and the real deliverable is fine.

## Root cause chain (three interacting defects)

### F1 — Timestamp-only artifact churn looks like a new surface (P0)

`artifacts/fix-item-ledger.json` is a **Wave-3** durable ledger (schema `ecgberht-fix-item-ledger-v0`). Wave 4 re-ran audit paths that **rewrote the same items with new `recorded_at` / `updated_at` stamps**.

Diff was only timestamps — no new items, no new semantics. Delta-coverage still classifies any path matching `ledger` as a **persistence surface** (journal 0091 / `SURFACE_SIGNALS`). So a no-op re-stamp is treated as "new surface this wave."

**Standing rule:** Durable JSON that is not this wave's deliverable must not be rewritten for "freshness." Writes must be **content-stable** (skip write if items/schema unchanged; or write under a wave-scoped path; or exclude regenerated audit outputs from the delta set).

### F2 — Delta-coverage only counts **in-wave changed tests** (P0, operator-invisible)

`wave-engine.mjs` builds `testMentions` only from **changed test files** in the wave's git delta (`checkDeltaCoverage({ changedFiles, testMentions })`). Filename-token overlap also only considers **test files in that same delta**.

So:

1. Operator adds `test/w4-fix-item-ledger-surface.test.mjs` that correctly names the ledger.
2. Operator **commits** it (correct hygiene).
3. Next resume: the test is **not** in `changedFiles` (already committed).
4. Wave re-stamps the ledger → still in `changedFiles`.
5. Delta-coverage fails **again** with the same message.

The recommend string says "add a test that NAMES each new surface" — we did; the guard cannot see a committed test. That is the clumsy loop: human follows the instruction, run fails the same way, wall clock burns.

**Standing rule (engine):** Delta-coverage must also scan **wave-numbered tests already in the tree** (`test/w{N}-*.test.mjs` / `test/w{N}_*.test.mjs` for current wave N), not only the delta. Or: once a surface path is named by any test file matching the wave prefix, credit it.

### F3 — Project-root mismatch earlier made vacuous-GREEN look like the same class of clown (related, same run family)

Earlier in the same effort, projectDir was `planning/steward-handoff-v3` while tests/sources lived at Ecgberht root → vacuous-GREEN despite real imports. Fixed by moving project root to `C:\dev\Ecgberht`. Same customer experience: green suite, opaque HALT, resume theater.

**Standing rule:** For monorepos, Foreman projectDir must be the **git / suite root**, with plan/docs as relative paths under it — never a nested handoff folder that cannot see `test/`.

## Cost (why journal this hard)

| Waste | Approximate |
|--------|-------------|
| Extra W4 execute cycles | 2 full (~5–11 min each) |
| Extra review seats | 2 lean reviews after green gates |
| Operator / session thrash | clear-halt --force, re-commit, schtasks re-launch, status cadence confusion |
| Principal trust | "Foreman can't finish a green wave" |

None of that advanced criteria. G4 and handback work was already largely present.

## Remediation applied on this run (tactical)

1. Restored `artifacts/fix-item-ledger.json` to HEAD (drop timestamp-only delta).
2. Kept / strengthened `test/w4-fix-item-ledger-surface.test.mjs` (names the path).
3. Resumed W4 with `--clear-halt --force` after the restore.

Tactical only — **F1 and F2 need engine/skill fixes** or the next wave that re-stamps a prior-wave JSON will re-create the clown show.

## Proposed skill / engine fixes (for Foundry sleep / Foreman improvement cycle — do not ad-hoc mid-build)

1. **Delta-coverage credit for committed wave-prefix tests** (F2) — blocker's recommend text becomes honest.
2. **Stable durable writers** (F1) — content-hash short-circuit on audit/ledger writes.
3. **Classify pure timestamp fields as non-surface** optional — weaker; prefer not rewriting.
4. **Status cadence must pin live status log path** — parallel agents kept re-reading a dead subdir log and reporting "still HALTED" while the root run was GO'ing waves 1–3 (also unprofessional).

## Standing rules (append to operator doctrine)

1. **Never re-stamp prior-wave durable JSON "for freshness"** during a later wave execute.
2. **If delta-coverage fails on a path you already tested:** check whether the test is in *this wave's git delta*, not whether it exists on disk.
3. **ProjectDir = suite root** for monorepo Foreman builds.
4. **A repeated identical HALT after following the recommend string is an engine bug**, not operator failure — stop thrashing; fix the guard or the writer.

- **provenance**: genuine-execution (2026-08-03, steward-handoff-v3 Heavy, W4 double delta-coverage HALT after 708/718 green gates).

## Recurrence — Wave 5 (2026-08-03 ~01:16) — same clown show, one wave later

After W4 GO (`5bb7660`, 720/720), Wave 5 **gate was GREEN (735/735 after 1 fix)** and dual review returned **0 agreed BLOCKER/MAJOR**. Orchestrator then HALTed again:

```
delta-coverage: FAIL wave 5 — artifacts/fix-item-ledger.json (persistence)
```

Diff was again **timestamp-only** (`recorded_at` / `updated_at` rewritten at fix-1 ~07:08Z vs committed ~06:40Z). No semantic change. Cost: full dual-review panel (~$11 sub-equiv, ~8 min wall) plus the execute→gate→fix loop, then stop with no W5 commit. Waves 6–22 not run.

**This is the exact defect F1+F2 predicted.** Tactical: restore ledger to HEAD; leave an in-wave `test/w5-fix-item-ledger-surface.test.mjs` in the dirty delta as insurance; single `--resume --clear-halt --force`. Do **not** thrash the recommend string ("add a test") without first restoring the no-op rewrite.

**Foundry priority raised:** F1 content-stable ledger writers + F2 credit wave-prefix tests already on disk — every later wave that re-runs A4/A5 audit helpers will re-create this until the engine is fixed.

## Related process failure � W5 silent resume death (2026-08-03 ~01:23�01:31)

After the W5 delta-coverage clear-halt resume (ledger restored), run-live PID 103432 logged `waiting on agent:execute` and exited with **no DONE/HALT stamp**, empty err log, stale lock, checkpoint left `status=running`. Journal: Ecgberht `0071-w5-silent-resume-death-after-delta-coverage-clear.md`. Same customer experience class as F1/F2 thrash � wall clock burned, system looks broken.
