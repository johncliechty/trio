# 0082 — The hardening gate's first dogfood WORKED; the emitted plan carried mojibake

- **id**: 0082-hardening-gate-first-dogfood-and-mojibake
- **date**: 2026-07-28
- **run**: Ecgberht steward data tracking & indexing (grok-driven Crucible Stage 0→2, 19 waves emitted, then Foreman)
- **why it matters**: this was the **first real use** of the hardening law (0080) and its engine enforcement (0081), on an effort deliberately chosen because its subject matter *is* durability and honesty.

## The gate worked — evidence

`planning/steward-tracking-2026-07/stage2/hardening-gate-result.json`:

```json
{ "pass": true,
  "claims": ["durability", "idempotence", "boundedness", "containment"],
  "missing": [],
  "detail": "4 asserted propert(ies) all carry a mechanical gate" }
```

Four property families were **detected from the plan's own prose** and each was
forced to name a mechanism. The durability claim (matched on `/append[- ]only/i`)
obliged "atomic write (temp + fsync + rename)", "lock or documented
serialization", and "a concurrency test" — exactly the three things whose absence
caused the original defect this law was written for.

The resulting plan is visibly shaped by it: the locked North Star commits to a
"delete-and-rebuild index", the engine "never shells to git" (commit-intent
receipts Anchor honors instead), and a lost project "reports itself loudly as
unknown/root-absent instead of silently shrinking the portfolio" — the
unknown-is-not-empty rule, adopted as an architectural commitment rather than a
review note.

Wave 19 then carried a **delta-coverage audit per gate 0091** as an explicit
deliverable, and shipped `w5x-class-symmetry-audit.test.mjs` (counts twelve legs,
fails naming any missing one) and `w5x-decision-ledger-lint.test.mjs` (fails if a
branch deleted by a locked decision reappears). Both are "count it, don't assert
it in prose" artifacts — the law propagating into the plan's own style.

**Verdict: the gates are not decorative.** Keep them.

## FINDING — mojibake in the emitted plan (P1)

`planning/steward-tracking-2026-07/stage2/IMPLEMENTATION-PLAN.md`, the North Star
line, contains:

```
... from ONE portfolio-level, stdlib-only, delete-and-rebuild index
(JSONL event log + JSON snapshot) Ã¢â‚¬â€ while the per-project files ...
```

`Ã¢â‚¬â€` is a UTF-8 em-dash (`—`, `E2 80 94`) decoded as cp1252 and re-encoded.
The corruption is in the **primary emitted artifact**, on the **North Star line** —
the one sentence every downstream Shark, reviewer and coder reads and re-quotes.

Two things make this worth a rule rather than a shrug:

1. The run itself hit encoding trouble hard enough to add `engine/encoding.mjs` to
   the deliverables — so the symptom was noticed downstream while its source in the
   emitted doc went unfixed.
2. Windows is the default host here. `fs.writeFileSync(path, text)` without an
   explicit encoding, or any read that assumes the system codepage, produces
   exactly this. It will recur on every Windows run until the emit path pins UTF-8
   on both read and write.

## STANDING RULES

1. **Pin UTF-8 explicitly on every doc read AND write in the emit path.** Never
   rely on the platform default; on Windows it is cp1252.
2. **Lint the emitted doc-trio for mojibake before the well-formedness gate.** The
   signatures are cheap and unambiguous (`Ã¢â‚¬`, `Ã¢â€`, `â€™`, `Â `). A hit is a
   HALT, not a warning — a corrupted North Star propagates into every later stage.
3. **The North Star line specifically deserves a round-trip assertion**: what was
   locked at Stage 0 must byte-match what appears in the Stage-2 plan. Drift there
   is not cosmetic; it is the anchor every other gate measures against.


## FINDING 2 — emitted JSON carries a UTF-8 BOM (P2, same root as the mojibake)

`stage1/NORTH-STAR-LOCK.json` and `stage1/STAGE1-APPROVED.json` begin with
`EF BB BF`. Python's `json.load` rejects that outright
(*"Unexpected UTF-8 BOM (decode using utf-8-sig)"*), and Node's `JSON.parse`
throws on it too. These are **gate artifacts** — the North-Star lock and the
Stage-1 approval — so any downstream tool that machine-reads them to confirm a
lock will fail on a file that is otherwise perfectly valid.

Same root cause as the mojibake: the emit path does not pin its encoding. A BOM
is what you get from a Windows text write that defaults to `utf-8-sig`.

**Rule:** emit JSON as **UTF-8 without BOM**, and add a parse-back assertion to
the emit step — write it, then `JSON.parse` it from disk. An artifact that
cannot be read back is not emitted.

## Repair applied 2026-07-28

14 mojibake sequences repaired across 9 planning docs (targeted sequence map;
a whole-file cp1252→utf-8 reversal does NOT work because the files are *mixed* —
partly correct text, partly corrupted). Engine code was clean: **0 affected
files** under `engine/`, `test/`, `tools/`. The BOM files were left as-is —
they are pre-existing gate artifacts and rewriting a lock receipt to fix its
encoding is not this session's call.

- **provenance**: genuine-execution (post-run review, 2026-07-28). See foreman journal 0093 for the build-side findings from the same run (19 GREEN waves, zero commits).
