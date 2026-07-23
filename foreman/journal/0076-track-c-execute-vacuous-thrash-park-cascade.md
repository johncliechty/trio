---
id: 0076-track-c-execute-vacuous-thrash-park-cascade
skill: foreman@2026-07-23
situation: track-c-legal-full-foreman-multi-hour-thrash-then-session-park
context: >
  Track C Legal FULL (C:\dev\plans\2026-07-22-portfolio-world-class\C-legal-engine)
  after Crucible FULL handoff 2026-07-23. Program FRICTION F053–F061.
  Session parked Foreman after vacuous loop (operator later ordered go-go-go).
  This ticket is the load-bearing improve target for "why thrash / why park".
observation: >
  ## Symptom (what burned hours)

  After Crucible FULL completed (continuous schtask ~44m; plan 10 waves locked),
  Foreman FULL spent wall-clock in a stop-start cascade:
    · F053: first start HaltError on bare `node --test test/` (Windows known-broken)
    · F055–F057: wave 1 vacuous-GREEN → clear-halt resume → vacuous again
    · F058–F060: same class on later waves; session hand-landed code + proven ledgers
    · Session then **parked** (operator inquiry was diagnostic, not a park order)
    · F061: unpark + pre-land pace resumed waves

  Observed execute line almost always: `execute: agent execute complete` in ~2–3s.
  Status tables showed `agent_calls 0` for entire runs. Gate stayed GREEN on
  already-landed suites. Vacuous-GREEN then HALTed honestly ("no source changed
  reachable by an executed test" / "doc-only artifacts" / "no prior-attempt ledger").

  ## Root cause stack (ordered — improve against these)

  ### RC1 — P0 LOAD-BEARING: EXECUTE prompt does not carry the wave contract
  Code: `trio/foreman/bin/wave-workflow.js` → `executePrompt(ctx)`.

  The execute agent receives only a short generic instruction ("implement this wave
  as specified in the frozen plan… edit source files… if ALREADY DONE state it").
  It does **not** receive:
    · wave **Deliverables** / **done-when** / GWT from IMPLEMENTATION-PLAN.md
    · plan path + relevant plan excerpt
    · discovered test-command
    · inventory of missing deliverable paths
    · prior open findings

  By contrast, `reviewPrompt` already injects orchestrator-measured changed files
  (efficiency fix). Execute is the under-specified seat. Live effect: claude can
  return in seconds with zero or near-zero tool use, leaving the tree unchanged
  while the gate re-proves an older green suite → vacuous-GREEN is inevitable.

  **Improve acceptance:** executePrompt (or wave-engine preflight) must inject at
  least: plan path, wave title, deliverables block, done-when, test-command, and
  a "files that must exist / be covered by tests" checklist derived from the plan
  wave body. Prefer fail-closed if plan section cannot be parsed.

  ### RC2 — P0: TRIO_DRIVER path drops instrumented agent telemetry (false diagnosis)
  Code: `trio/foreman/bin/run-live.mjs` ~line 380:

    driver: await makeForemanDriver(
      process.env.TRIO_DRIVER ? { log: (s) => emit(s) } : { agent }
    )

  When `TRIO_DRIVER` is set (portfolio launch scripts always set it to `claude`),
  the instrumented `agent()` that calls `runClaude` and pushes to `calls[]` is
  **not** injected. Seating goes through `makeForemanDriver` → registry
  `claude.mjs` instead.

  Effects:
    · `agent_calls` stays **0** even when agents run (status tables lie)
    · no `┌ label … launching agent` / tool-use lines from run-live transport
    · `.foreman/phase-timings.jsonl` records **gates only** (no execute/review call rows)
    · operators and sessions mis-diagnose "execute never ran" vs "execute ran empty"

  **Improve acceptance:** always inject instrumented agent OR always record
  telemetry at the makeForemanDriver/runAgent boundary so agent_calls, tools,
  duration_ms, and exit_class are truthful under TRIO_DRIVER seating. Prefer
  one code path for live transport.

  ### RC3 — P1: Vacuous-GREEN is correct; clear-halt-without-delta is the thrash
  Vacuous-GREEN (wave-engine `checkVacuousGreen`, family 0057/0045/0046) correctly
  refuses GO when the wave's hash-diff has no test-reachable source. That is
  honesty, not a bug.

  Thrash mode = operator/session response:
    clear-halt → resume → execute no-op again → same HALT
  (F055→F056→F057). Each cycle costs a full review (~1–3 min) and looks like
  "Foreman stuck."

  Proven-ledger credit (`wave-N-proven.json`) only helps when BOM-free JSON and
  sources.length===0 path; PowerShell `Set-Content -Encoding utf8` BOM once
  made ledger unreadable ("no prior-attempt ledger"). Doc-only deltas from
  gate-side artifact rewrites (timestamps in phase0-halt-verdict) took the
  doc/data HALT branch **before** prior-ledger credit.

  **Improve acceptance:**
    · On vacuous-GREEN, checkpoint pending_action must state "do not clear-halt
      until execute lands test-covered source or plan is amended" (hard text).
    · Optional: refuse clear-halt for vacuous unless `--force` or ledger present.
    · Artifact writers used by gates must be content-stable (no volatile timestamps)
      — landed partially on C Legal seam-audit; generalize.
    · Proven ledger writes must be BOM-free (Node writeFileSync only in helpers).

  ### RC4 — P1: Frozen explicit test-command under-gates later waves
  Stage-2 plan locked:
    test-command: node --test test/scaffold… (wave-0 files only)
  Windows cannot use bare `node --test test/` (isBadNodeTestDirectoryCommand /
  F053 / 0038 family). So each later wave's new tests are invisible to the gate
  until a plan amendment. Reviewer correctly raised PLAN-AMENDMENT-PROPOSAL on
  wave 4 (F061). Session expanded explicit lists by hand — not shippable.

  **Improve acceptance (pick one, document):**
    A) Stage-2 / discoverTestCommand emits expanding discovery:
       `node --test $(find test/**/*.test.mjs)` via a small node helper script
       that lists files (Windows-safe), OR
    B) Per-wave test-command blocks in the plan, OR
    C) Orchestrator merges package.json scripts.test with plan list and fails
       preflight if suite is a strict subset of test/*.test.mjs on disk.

  Bare `node --test test/` must remain hard-error on Windows.

  ### RC5 — P2: Session park without operator order
  After F057–F060 the supervising session treated diagnosis + "why so long?" as
  a halt order and stopped auto-resume. Operator had not ordered park (clarified
  go-go-go). Not an engine bug; process rule: park only on explicit operator
  park / safety / true deadlock after one recorded hypothesis.

  ## What is NOT the primary fault
  · Crucible FULL runtime (~44m continuous) — normal for FULL legal band.
  · Vacuous-GREEN itself — working as designed.
  · F-H process death — separate ticket 0072/0075 (schtask breakaway worked here).
  · Missing CRUCIBLE_AGENT_LIVE — host has User/Machine = 1; live seam can spawn.
    (Launch scripts should still set it explicitly for hermetic breakaway.)

  ## Evidence anchors
  · wave-workflow.js executePrompt (generic; no plan body)
  · run-live.mjs TRIO_DRIVER ? {log} : {agent}
  · C-legal _out-*.log: execute complete in 2–3s; no "launching agent" lines
  · phase-timings.jsonl: gate rows only during thrash window
  · Program FRICTION F053–F061
  · Prior family: 0057, 0045, 0046, 0066, 0038/0039

outcome: friction
provenance: genuine-execution
---

# Improve ticket — Foreman execute thrash / vacuous cascade (Track C Legal FULL)

## One-line problem
**Foreman FULL multi-hour thrash was not "Crucible slow" — it was execute under-specified + telemetry blind under TRIO_DRIVER + vacuous-honest HALTs + clear-halt loops + frozen gate lists; the session then parked without an operator park order.**

## Priority
**P0 for product ship of Foreman FULL on multi-wave greenfield plans.**  
Without RC1+RC2 fixes, every FULL build that relies on agent execute will either:
1. vacuous-HALT forever, or  
2. require human pre-land of every wave (not shippable).

## Proposed Foundry sleep work packages

| # | Package | Owner surface | Done when |
|---|---------|---------------|-----------|
| 1 | **Execute contract injection** | `foreman/bin/wave-workflow.js` (+ plan parse helper) | execute agent prompt includes deliverables/done-when/test-command; unit tests with fixture plan |
| 2 | **Unified live agent telemetry** | `foreman/bin/run-live.mjs` + driver boundary | `agent_calls`, tools, duration always recorded when TRIO_DRIVER set; status table truthful |
| 3 | **Vacuous clear-halt policy** | `project-engine` clearHaltedCheckpoint / run-live --clear-halt | vacuous HALT text forbids blind re-clear; optional force flag; BOM-safe ledger helper |
| 4 | **Windows-safe expanding gate** | Stage-2 emit + `discoverTestCommand` / helper script | new test files under test/ enter gate without per-wave plan amend; still hard-errors bare `test/` |
| 5 | **Stable gate artifacts** | any run-time writers used inside gate-invoked code | re-running green suite produces zero hash-diff from timestamps |
| 6 | **Proven ledger quality (Track D evidence)** | `wave-engine.mjs` writeWaveProvenLedger | never records `*.log` / `_foreman-status*` / `_out-*` as `changed`; never overwrites a source-rich ledger with log-only lastChanged; only test-reachable sources |

## Non-goals for this sleep
- Weakening vacuous-GREEN to allow false GO
- Replacing subscription claude with API keys
- Mid-run freelancing of engines outside Foundry sleep (Rule 1)
- Closing this ticket by human pre-land on one portfolio project (interim only)

## Skill-improve guardrails (mandatory)

**Before any patch:** read **0078** (investigation) + **0079** (anti-pattern lock).

**DO NOT when improving this skill (summary — full table in 0079):**
- Do not weaken vacuous-GREEN so empty execute GO’s
- Do not leave TRIO_DRIVER path without truthful agent_calls/tools
- Do not write proven ledgers that list log/status/out files as deliverables
- Do not re-enable bare `node --test test/` on Windows
- Do not freestyle-patch foreman/bin outside Foundry sleep
- Do not claim multi-wave FULL “product DONE” solely via hand-pre-land without honesty residual

## Operator interim (until sleep ships)
1. Pre-land wave code + expand explicit test-command before --resume, **or**
2. Write BOM-free `wave-N-proven.json` with **source paths only** (never logs) after real code lands, **and**
3. Do not clear-halt vacuous without a code delta hypothesis  
4. Do not park a live portfolio track without explicit operator park
5. Always pass `--resume` after halt

## Related journals
**0078** investigation · **0079** skill-improve guardrails · 0057, 0045, 0046, 0066, 0038, 0039, 0047, 0072, 0075  
Program F053–F071 (F062 improve, F070 investigation, F071 D DONE)
