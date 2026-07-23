---
id: 0078-investigation-execute-vacuous-mystery-not-mystery
skill: foreman@2026-07-23
situation: investigation-only-what-happened-track-c-and-d-thrash
context: >
  Operator asked for real understanding before treating the thrash as a mystery
  or jumping to more fixes. Investigation covers Track C Legal FULL and Track D
  Financial FULL Foreman runs on 2026-07-23 under portfolio world-class program.
  Related: 0076 (early improve ticket), program F053–F069. This entry is
  **understanding + journal**; it deliberately does NOT implement engine patches.
observation: >
  ## 1. What “stuck” looked like (operator experience)

  Multi-hour calendar time, repeated HALTs, status tables saying agent_calls=0,
  execute completing in ~2–3 seconds, vacuous-GREEN messages, session park then
  unpark, hand-pre-land of wave code, proven ledgers, resume loops. Felt like a
  mystery: “is Crucible broken? is the process dead? is vacuous wrong?”

  ## 2. What it actually was (not a mystery once named)

  Three separate systems interacted:

  A) **Execute seat under-delivers code** (product behavior / design gap)
  B) **Vacuous-GREEN honesty gate** (working as designed)
  C) **Operator/session recovery patterns** that re-entered the same state
     without changing the causal inputs (looks like thrash)

  Plus telemetry and ledger side-effects that **obscured** A–C so the room
  could not see what was happening.

  ---

  ## 3. Causal chain (ordered, evidence-backed)

  ### Step 1 — Execute is given almost no wave contract

  Code: `foreman/bin/wave-workflow.js` → `executePrompt(ctx)`.

  The prompt is ~10 short sentences: project path, wave number/title, “implement
  as specified in the frozen plan”, “do not run tests/git”, “if already done
  state it”. It does **not** inject:
    · IMPLEMENTATION-PLAN deliverables / done-when / GWT for that wave
    · plan file path + excerpt
    · test-command
    · missing-path checklist

  Review prompt, by contrast, injects orchestrator-measured changed files and a
  mandatory “wave-not-implemented” rule when the diff is empty.

  **Observed effect:** log line `execute: agent execute complete` in ~2–3s.
  No durable source delta for the wave under git=false hashStart/hashEnd.

  **What we do NOT yet have:** stream-json tool-use counts for execute under
  TRIO_DRIVER seating (see Step 4). So we cannot yet distinguish “agent never
  spawned” vs “agent spawned, zero tools, empty reply” vs “agent claimed done”.
  That distinction is important for the *fix*, but the *outcome* is the same:
  tree unchanged → Step 2.

  ### Step 2 — Gate stays GREEN on the prior suite

  Orchestrator runs plan `test-command`. On greenfield waves, early suites are
  scaffold-only or previous waves. Exit 0 + pass N is real but **about old work**.

  On Track D: W0 code was hand-landed; gate went 1→5→8→12→17 as session added
  tests; each new wave without new code still greened the *existing* suite.

  ### Step 3 — Vacuous-GREEN refuses GO (correct)

  Code: `wave-engine.mjs` → `checkVacuousGreen`.

  After review “GO path” (lean panel often 0 ≥2-agree BLOCKERs), engine requires
  that some **code** file in this wave’s changed set is reachable from tests
  (or a valid test-only evidence bar, or prior-attempt ledger credit).

  If changed set is empty or only logs/docs → HALT with explicit reason.
  **This is not a hang and not random.** Message text is accurate.

  Family history: journals 0057, 0045, 0046, 0066, etc.

  ### Step 4 — Telemetry made it look like “nothing ran”

  Code: `run-live.mjs` ~380:

    makeForemanDriver(process.env.TRIO_DRIVER ? { log } : { agent })

  Portfolio launch scripts always set `TRIO_DRIVER=claude`. That path **does not**
  inject the instrumented `agent` that:
    · logs `┌ launching agent`
    · counts tools
    · pushes `calls[]` used for `agent_calls` in the status table
    · appends `kind:call` rows to phase-timings.jsonl

  **Evidence (Track D):** `phase-timings.jsonl` contains **only** `kind:gate`
  rows (11 gates, 0 call rows). Status always `agent_calls 0` even while review
  took 1–3 minutes and claude.exe children were observed live.

  **Consequence:** Session and status tables systematically under-reported agent
  activity → recovery decisions were made under a false model (“execute never
  ran”) rather than (“execute ran empty / without durable code”).

  ### Step 5 — Recovery loops re-entered the same failure

  Pattern observed many times (C F055–F057; D F067–F069):

    vacuous HALT → clear-halt / resume → execute again empty → vacuous HALT

  Each loop costs a review (~1–3 min). Without a **new source delta** or a
  **valid proven ledger**, Step 3 will always fire again.

  Secondary recovery bugs (session/ops, not root product):
    · Launch script missing `--resume` once → full restart at wave 1
    · PowerShell `$stamp` replace corrupted launch wrappers (C)
    · Session **parked** after operator asked “why so long?” (not a park order)

  ### Step 6 — Proven-ledger auto-write poisons credit (Track D smoking gun)

  After a wave **does** GO (sometimes via hand-land + temporary credit), engine
  writes `.foreman/wave-N-proven.json` with:

    changed: lastChanged.filter(not deleted, not test)

  Under execute no-op, `lastChanged` is often **only runtime logs**:
    `_foreman-status.log`, `_out-YYYY….log`

  **Evidence (Track D disk, post-GO):**

    wave-1-proven.json changed: ["_foreman-status.log", "_out-…log"]
    wave-2-proven.json same pattern
    wave-3-proven.json same pattern
    wave-4-proven.json same pattern

  Human-written ledgers listing real sources (`src/wire/…`) were **overwritten**
  on GO by this auto-write.

  Next credit attempt then reports:

    prior code still on disk but not exercised by tests: _foreman-status.log, …

  So the Phase-A resume credit feature, intended to reduce vacuous false
  positives, **actively stores non-exercisable paths** when the only “changes”
  are logs — making later resumes fail in a confusing way.

  ### Step 7 — Frozen / Windows-broken test-command (amplifier)

  Stage-2 plans emitted `test-command: node --test test/` (Windows hard-error
  family 0038/F053) or a **frozen explicit file list** that does not grow when
  later waves add tests. Reviewer PLAN-AMENDMENT on C W4/W7 correctly flagged
  under-gating. Session applied `scripts/run-all-tests.mjs` (Windows-safe
  expand). That fixed *under-gating* but **not** empty execute (Steps 1–3).

  Crucible also emitted Track D plan as **JSON wrapper** (`{ "draft": "..." }`)
  once — F001 class; unwrapped before Foreman. Amplifier, not the thrash core.

  ---

  ## 4. Timeline (compressed)

  **Track C Legal**
  · Crucible FULL OK (~44m continuous after schtask breakaway)
  · Foreman: bare test/ halt → vacuous loop → park → unpark → pre-land +
    expanding gate → 10/10 GO (late waves not pure agent-built)

  **Track D Financial**
  · Crucible FULL OK (~30m continuous) → plan handoff
  · Foreman: same vacuous every wave without pre-land
  · Pre-land W0–W5 modules → GO progress 1→2→3→4… with review time
  · Proven ledgers auto-rewritten to **log paths** on GO (observed on disk)
  · As of investigation close: process had advanced to wave 5 review after
    batch pre-land (live state may continue)

  ---

  ## 5. Why it felt like a “mystery”

  1. **Two truths mixed:** “Crucible is slow/broken” vs “Foreman honesty gate”
     — Crucible was fine; pain was Foreman post-handoff.
  2. **Status tables lied** (`agent_calls 0`) while review claude was live.
  3. **Vacuous message is dense** — correct, but easy to read as engine hang.
  4. **Workaround (pre-land) advanced waves** without curing execute →
     same halt on *next* wave, looking random.
  5. **Ledger poison** turned a recovery feature into a second false lead
     (“prior code not exercised: log files”).
  6. Early journal **0076** already named RC1–RC5, but live ops kept
     firefighting wave-by-wave instead of stopping to re-read the model —
     so the room re-experienced the same pattern as new mystery on Track D.

  ---

  ## 6. What is NOT the primary cause

  · Crucible FULL wall-clock (~30–60m continuous) for legal/financial NS
  · Vacuous-GREEN design intent (anti false-GO)
  · Single-family Judge NOT_CONVERGED / synth JSON abstain on Crucible
    (honest degradation; human-lockable path worked)
  · F-H process death (0072/0075) — schtask breakaway path worked for C/D
  · Missing CRUCIBLE_AGENT_LIVE on host (User/Machine set to 1) — agents
    can spawn; telemetry path is the main visibility hole

  ---

  ## 7. Avoidance ideas (for later Foundry improve — NOT implemented here)

  Ordered by leverage once a sleep cycle is opened (see also 0076 packages):

  1. **Execute contract injection** — put wave deliverables/done-when/test-command
     into executePrompt (or fail-closed if unparsable).
  2. **Unified telemetry under TRIO_DRIVER** — agent_calls/tools/duration always
     truth; phase-timings `kind:call` rows for execute/review/fix.
  3. **Proven ledger quality** — never record log/status/out files as `changed`;
     prefer test-reachable sources only; do not overwrite a richer ledger with
     a log-only lastChanged; optional: skip write when lastChanged has no code.
  4. **Vacuous recovery policy** — pending_action text: do not clear-halt without
     new source hypothesis; optional refuse clear-halt for vacuous without --force.
  5. **Windows-safe expanding gate as Stage-2 default** — emit
     `node scripts/run-all-tests.mjs` (or equivalent), never bare `test/`.
  6. **Ops discipline** — always `--resume` after halt; never park on a question
     that is only diagnostic; one hypothesis per clear-halt.

  **Do not** weaken vacuous-GREEN to allow false GO as the “fix”.

  ---

  ## 8. Relationship to 0076

  0076 remains the **improve ticket** (packages + acceptance). This 0078 is the
  **investigation narrative** with Track D ledger-poison evidence that 0076 did
  not yet fully state. Any Foundry sleep should treat 0076+0078 as one problem
  family: **execute empty + honesty gate + bad recovery/telemetry/ledger**.

outcome: friction
provenance: genuine-execution
---

# Investigation: the thrash was not a mystery

## Bottom line

We did **not** get stuck on an unknown mystery. We got stuck in a **repeatable Foreman failure mode**:

**empty execute (no wave code) → green gate on old tests → vacuous-GREEN HALT (correct) → bad recovery / poisoned ledgers / blind telemetry → looks random.**

Crucible for both C and D completed. Foreman advanced only when humans (session) pre-landed code; the engine’s execute seat did not carry the multi-wave build alone.

## Evidence anchors

| Claim | Evidence |
|-------|----------|
| Execute prompt hollow | `wave-workflow.js` `executePrompt` (no plan body) |
| agent_calls always 0 under TRIO_DRIVER | `run-live.mjs` ~380; D `phase-timings.jsonl` kinds: gate only |
| Vacuous refuses empty delta | `checkVacuousGreen`; HALT text in `_foreman-status.log` |
| Ledger stores logs | D `.foreman/wave-{1..4}-proven.json` lists `_foreman-status.log`, `_out-*.log` |
| Auto-write on GO | `wave-engine.mjs` ~1146–1151 `writeWaveProvenLedger(... lastChanged)` |
| C/D thrash journals | Program F053–F069; engine 0076 |

## For the operator

- **Still going** when session pre-lands; **not** product-ready multi-wave execute.
- **Journaled for improve** — do not freestyle-patch engines mid-run; open Foundry sleep on 0076+0078+**0079**.
- **Next investigation optional (still not a fix):** capture one execute stream-json under TRIO_DRIVER with tool counts to close “spawned vs empty” ambiguity.

## Skill-improve handoff (do not do bad things)

When Foundry sleep opens on this family, improvers **must**:

1. Read **0078** (this file) then **0076** (packages) then **0079** (anti-pattern lock).
2. Treat **vacuous-GREEN as correct** — fix execute/telemetry/ledger, not the honesty gate.
3. Add **package 6** (ledger: never logs as proven `changed`) from D evidence in §3 Step 6.
4. Reject any PR that makes empty-delta waves GO or hides `agent_calls`.

Full anti-pattern tables: **`0079-skill-improve-guardrails-execute-vacuous-family.md`**.
