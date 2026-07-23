---
id: 0079-skill-improve-guardrails-execute-vacuous-family
skill: foreman@2026-07-23
situation: skill-improve-do-not-reintroduce-execute-vacuous-thrash
context: >
  Operator (John 2026-07-23): log investigation ideas with the journal effort so
  Foundry sleep / skill improve does NOT do bad things. Pairs with 0076 (packages)
  and 0078 (investigation). This entry is the **guardrail / anti-pattern lock** —
  mandatory reading before any patch to execute, vacuous-GREEN, proven ledger,
  run-live TRIO_DRIVER seating, or Stage-2 test-command emit.
observation: >
  Portfolio C Legal + D Financial FULL Foreman thrash (2026-07-23) was a named
  failure mode, not a mystery. Sleep that “fixes” the wrong layer will make the
  product worse (false GO, silent self-review, Windows gate lies).

  Canonical reads (in order):
    1. 0078 — what happened (causal chain + D ledger-poison evidence)
    2. 0076 — improve packages + acceptance
    3. THIS 0079 — what NOT to do when improving the skill

  Program: F062, F070, F071 · SLEEP-FEED 0076/0078/0079
outcome: friction
provenance: genuine-execution
---

# Skill-improve guardrails — execute / vacuous / ledger family

**Read before any Foundry sleep that touches Foreman execute, vacuous-GREEN, proven ledger, run-live agent injection, or Stage-2 test-command.**

---

## Locked anti-patterns (DO NOT when improving the skill)

### A. Honesty / vacuous-GREEN

| DO NOT | Why |
|--------|-----|
| **Weaken or bypass vacuous-GREEN** so empty execute can GO | That reintroduces false-GO (the guard is correct; execute is the broken seat) |
| **Treat vacuous-GREEN HALT as a “hang” to silence** | It is an honest stop; silence = ship unproven waves |
| **Auto-clear-halt vacuous in a tight loop** without new source | Guarantees thrash (F055–F057); burns review minutes forever |
| **Credit “already green suite” alone as wave proof** | F2-9 / R2-3 doctrine: suite must exercise *this wave’s* deliverable |

### B. Execute seat

| DO NOT | Why |
|--------|-----|
| **“Fix” thrash only by better status prose** without contract injection | Symptom care; empty execute remains |
| **Make execute prompt longer with fluff** instead of **parsed wave body** (deliverables / done-when / test-command) | Agents already get generic text; need *this wave’s* contract |
| **Let execute run tests/git “to help”** by relaxing orchestrator ownership** without a deliberate design change | Orchestrator-owned gate is load-bearing |
| **Ship multi-wave FULL demos that only work via human pre-land** and call that “Foreman DONE” without honesty stamp | Track C/D late waves used pre-land; product residual must stay labeled |

### C. Telemetry / TRIO_DRIVER

| DO NOT | Why |
|--------|-----|
| **Leave `TRIO_DRIVER ? {log} : {agent}` as the only live path** without call-level telemetry | Status lies (`agent_calls: 0`); ops invent wrong root causes |
| **Report agent_calls only from instrumented path** while production always sets TRIO_DRIVER | Guarantees permanent zero counts |
| **Infer “execute never ran” from agent_calls alone** | Reviews ran with live claude while counts stayed 0 |

### D. Proven ledger

| DO NOT | Why |
|--------|-----|
| **Write proven ledger `changed` from raw lastChanged including logs** (`_foreman-status.log`, `_out-*.log`) | Track D smoking gun: overwrote good source ledgers; next credit fails “not exercised: log” |
| **Overwrite a source-rich ledger with a log-only lastChanged on GO** | Destroys Phase-A resume credit |
| **Count `.log` / status / out files as deliverable code** | Never test-reachable; vacuous credit path fails closed correctly |
| **BOM UTF-8 JSON via PowerShell Set-Content -Encoding utf8** for ledger files | parse fails → “no prior-attempt ledger” false negative |

### E. Test-command / Stage-2

| DO NOT | Why |
|--------|-----|
| **Emit or re-allow bare `node --test test/` on Windows** | Hard-broken (0038/F053); false “fixed by directory form” |
| **Freeze explicit test file lists at plan lock with no expand path** | Later waves under-gated → PLAN-AMEND treadmill or false green |
| **Accept reviewer amend that only says `test/` without Windows-safe helper** | Same footgun; use expand helper pattern (`scripts/run-all-tests.mjs`) |

### F. Process / sleep discipline

| DO NOT | Why |
|--------|-----|
| **Freestyle-patch `foreman/bin` mid-portfolio-run** outside Foundry sleep | Rule 1; thrash + unjournaled “fixes” |
| **Park a live track because operator asked “why so long?”** without explicit park | Diagnostic ≠ stop (F058/F061) |
| **Close 0076 by hand-pre-landing waves on one project** | Interim ops only; not product acceptance |
| **Start sleep packages without reading 0078** | Missing ledger-poison + telemetry evidence → wrong patch |

---

## Required positive directions (when sleep *does* land)

These are the **allowed** fix directions (detail/acceptance in **0076**):

1. **Execute contract injection** — wave deliverables / done-when / test-command in prompt (or fail-closed if unparsed).
2. **Unified live telemetry** — agent_calls / tools / duration truthful under TRIO_DRIVER.
3. **Vacuous recovery policy** — no blind clear-halt; BOM-safe ledger helpers.
4. **Proven ledger quality** — source-only, test-reachable; never logs; no poison overwrite.
5. **Windows-safe expanding gate** as Stage-2 default emit.
6. **Stable gate artifacts** — no volatile timestamps thrashing hashStart.

---

## Acceptance of a future sleep (skill improve done when)

- [ ] Execute on a **greenfield** multi-wave plan mutates import-tested source without human pre-land on ≥1 full wave (hermetic demo). **Residual after 0081** — code injects contract; live demo not yet re-run.
- [x] Status `agent_calls` path always injects instrumented agent under production seating (**0081** package 2 — unit/code; live count prove on next FULL).
- [x] vacuous-GREEN still HALTs empty execute (regression suite green; clear-halt refuse without force).
- [x] `wave-N-proven.json` after GO never lists `*.log` / `_foreman-status*` / `_out-*` as changed deliverables (package 6 unit).
- [x] Stage-2 emitted test-command is Windows-safe and picks up new `test/*.test.mjs` without per-wave amend (Crucible **0071**).
- [x] No mid-run freestyle of engines; journal **0081** + runs/ appended.

---

## Related

| ID | Role |
|----|------|
| **0078** | Investigation (read first) |
| **0076** | Improve packages + acceptance |
| **0079** | This guardrail lock |
| **0075 / 0072** | F-H process lifetime (separate; do not conflate) |
| **0057 / 0045 / 0046** | Vacuous family history |
| **0038 / F053** | Windows `test/` hard-error |
| Program **F070 / F062 / F071** | Portfolio friction mirrors |

**Rule for improvers:** If a proposed patch would make empty execute GO, or hide agent_calls, or store logs as proven deliverables — **reject the patch**.
