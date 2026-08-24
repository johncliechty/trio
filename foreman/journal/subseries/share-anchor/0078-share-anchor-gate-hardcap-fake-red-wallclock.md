# 0078 — Gate hard-cap mid-run → fake RED + wall-clock thrash (share-anchor W1)

- **id:** 0078
- **skill:** foreman (+ crucible / Stage-2 handoff / monitoring)
- **date:** 2026-07-23
- **situation:** Shareable Anchor+Skills first Foreman build on `C:\dev\Anchor`. John asked: wall-clock is fine when *dangerously productive*; fake RED / sequential thrash / “is it hung?” waiting is not — journal for Foundry sleep improvement.
- **context:** LIVE W1 “Contracts brownfield package matrix…”. Plan `test-command` was `python -m pytest -v tests/` (full monorepo suite). Orchestrator gate ~20 min hard timeout. Execute had already shipped wave-scoped `tests/test_share_contracts_w1.py` (~32 tests) plus contracts code.
- **outcome:** friction
- **provenance:** genuine-execution

---

## What happened (facts)

1. **Execute completed productively** (~12:17): wrote real artifacts (`share_package_matrix.py`, schemas, `BROWNFIELD-INVENTORY.md`, `SUPERSEDES-REUSE.md`, `tests/test_share_contracts_w1.py`).
2. **Gate started full suite** `python -m pytest -v tests/` — collected **~2737 items**.
3. **Hard cap ~1200002 ms (~20 min)** fired while suite was still mid-run (~37% in stdout tail). Result stamped:
   - `exit_code: null`
   - `green: false`
   - `tap: { tests: 0, pass: 0, fail: 0 }`
4. Log line: `gate (iter 0): exit null · tests 0 pass 0 fail 0` → **RED without a real failure count**.
5. Review **skipped** (reviewers only block GREEN). FIX loop entered on a **non-informative RED**.
6. FIX completed once; **second full-suite gate** started again (same thrash). Orphan pytest processes continued after parent killed cmd.
7. Operator intervention: scoped plan to `tests/test_share_contracts_w1.py`, killed orphan full-suite pytests. Not a product fix — a **gate-contract** fix.

Earlier same day (same effort, Crucible): Stage-1/2 wall-clock gaps were mostly **real agent work** with low value density (full-doc revise for 1 change; same-family dry thrash; `approved=true` re-tanks without emit — journals **0068**, **0069**). Different mechanism; same user pain: **waiting looks unproductive**.

---

## Why this is deadly for “shareable skills”

| Failure mode | User experience | What it actually is |
|--------------|-----------------|---------------------|
| **A. Hard-cap fake RED** | “Tests failed” after 20 min | Suite **still green path**, killed mid-flight; TAP shows 0/0/0 |
| **B. Gate vs product mismatch** | Wave “fails” despite new tests | Gate runs **host monorepo suite**, not wave tests |
| **C. FIX thrash** | More wall clock | FIX chases timeout RED, not a real assertion |
| **D. Silent long calls** | “Is it hung?” | Agent working; no heartbeat until call ends |
| **E. Sequential re-work** | Stage-2 auto-approve re-tanks | `approved=true` still runs full Shark Tank, can human-lockable **before emit** |
| **F. Monitoring false “idle”** | Cadence says Foreman not started | Bot watches wrong dir (`plans\` vs `Anchor\`) |

Collaborators will not distinguish A from a real fail. They will burn credits + wall clock and lose trust.

---

## Root causes (layered)

1. **Plan declaration anti-pattern:** Crucible/force-emit defaulted `test-command` to whole `tests/` for a multi-thousand-test host.
2. **Gate semantics:** Timeout → `exit null` + zero TAP counts is **indistinguishable from “nothing ran”** in status tables; not labeled `TIMEOUT` / `INCOMPLETE`.
3. **No preflight “can this gate finish under cap?”** — no estimate of suite size vs `gate_ms`.
4. **No progress stream during gate** — long pytest looks dead in chat until end.
5. **Orphan child risk** — killed/timeout gate leaves pytest still eating CPU.
6. **Observability path skew** — 10-min cadence looked only at plan workspace; real Foreman lives on code project.

---

## Improvement candidates for Foundry sleep (prioritized)

### P0 — Stop fake RED (Foreman gate)

1. **Classify timeout exits:** if `timedOut` / wall ≥ cap / `exit_code == null` after long run → stamp `gate_class: TIMEOUT_INCOMPLETE`, **not** “RED with 0 tests.” Status table: `Tests timeout ✗ · incomplete (N% if known)`. Never send FIX the same “0 pass 0 fail” guidance as a real fail.
2. **Wave-scoped gate default for monorepos:** Stage-2 / locate-plan preflight: if plan is under a repo with >N tests (e.g. 200+), **refuse** bare `tests/` or require explicit `gate: full-suite` opt-in. Prefer `tests/test_*wave*` or path globs listed in wave deliverables.
3. **Preflight gate budget:** before first gate, dry-run `pytest --collect-only -q` count × historical sec/test → if estimated > 0.7 × gate cap, **HALT with amend plan** (not silent thrash).
4. **Re-read plan test-command every gate iteration** (if not already) so mid-run amend works without kill/restart.
   - **Confirmed 2026-07-23:** Operator amended IMPLEMENTATION-PLAN `test-command` to scoped `tests/test_share_contracts_w1.py` *before* gate iter 1 completed, but `wave-1-gate.json` iteration 1 still recorded `"command": "python -m pytest -v tests/"` and died with exit 4294967295 / 0 TAP after ~196s (killed mid full suite). **Plan amend did not rebind the live gate.** Sleep must make gate discovery re-read the plan (or config) each iteration — not cache at wave start.

### P1 — Make long work honest (observability)

5. **Gate progress heartbeat:** every 30–60s while pytest runs, append one line: last test name + % from pytest live log (or “collected N, running…”). Cadence reads this — John does not need 30s polling; the **engine** emits.
6. **Agent-call lifecycle lines:** start/end of execute, review, fix, gate with duration (Crucible already needs this for Oranges/revise — same pattern).
7. **Cadence contract:** status watchers must know `projectDir` + status log paths from handoff (`foreman.config` / receipt), not hardcode `plans\`.

### P2 — Cut low-value serial work (Crucible + Foreman)

8. **Stage-2 `approved=true` must emit, not re-tank** (journal 0069): human-lockable + user approval → `writeDocTrio` + well-formedness from structured waves; Shark Tank already dry.
9. **Revise = patch, not full re-emit** for 1-change markdown-first revises (0068).
10. **NS-by-reference** in Master/Impl drafts (ban full NS paste — inflates every seat).
11. **Same-family dry thrash policy:** when `cross_model:false` and 2× dry multi-Shark with no ≥2-agree BLOCKER, prefer human-lockable earlier / skip full-doc revise if only Judge/fresh-eyes hold.

### P3 — Parallelism (only where safe)

12. **Do not parallelize gate with execute** (race). Do parallelize **Shark seats** (already) and **reviewers** (already when GREEN).
13. Optional: **wave test file discovery** in parallel with execute agent writing tests — only if hermetic; lower priority than P0.

### P4 — Operator / shareable UX

14. Onboard + Foreman README: one page **“how to know it’s working”** — which log, what a TIMEOUT looks like, that full monorepo gates are wrong for wave builds.
15. Sleep-loop cluster tag: `wallclock-fake-red`, `gate-scope`, `observability-gap` for portfolio sleep index.

---

## Suggested sleep-session tickets (copy-paste)

| Ticket | Skill | Acceptance sketch |
|--------|-------|-------------------|
| T1 Timeout ≠ RED | Foreman | Gate timeout stamps TIMEOUT_INCOMPLETE; FIX prompt says “suite incomplete under cap, scope the gate” not “fix failing tests” |
| T2 Monorepo gate preflight | Foreman + Crucible Stage-2 | Collect-only budget vs cap; fail closed if over budget without wave-scoped path |
| T3 Wave-scoped test-command emission | Crucible Stage-2 | Default test-command derived from wave test deliverables; never bare `tests/` on large repos |
| T4 Gate live progress | Foreman | Heartbeat file updated every 60s during gate with last line of pytest |
| T5 Stage-2 approved emit path | Crucible | `approved=true` skips tank when human-lockable draft exists; emits doc-trio |
| T6 Cadence path from handoff | Ops / skills | 10-min relay reads `FORCE-EMIT-RECEIPT` / `foreman.config` projectDir |
| T7 Rebind test-command each gate | Foreman | Gate iter N re-reads plan `test-command`; mid-run amend takes effect next gate without restart |
| T8 Progress heartbeats mandatory | Foreman + Crucible + Jumper | Every long phase stamps progress ≤60–120s; age >3× interval → STALL_SUSPECT |
| T9 Stall escalate + kill budget | Foreman | Hard stall → snapshot + kill child tree + STALL_KILLED + smart resume (not unbounded wait) |
| T10 Status shows last-progress age | Ops / status emitter | Table distinguishes productive-long vs STALL_SUSPECT |
| T11 Shared progress-event contract | Foundry multi-skill | One event schema for Foreman/Crucible/Jumper/Gandalf seats (corroborates Jumper 0005) |

---

## Hang / stall strategy — how we know we’re not “waiting forever” (John 2026-07-23 follow-up)

**Honest answer:** today’s sleep tickets already fix *fake RED* and *wrong-sized gates*. They do **not** by themselves fully eliminate every hang. We need an explicit **stall taxonomy + watchdog ladder** so neither humans nor 10-min cadence have to guess.

### Three different “stuck” classes (must not mix)

| Class | What you see | Real meaning | Tool we already have / need |
|-------|--------------|--------------|-----------------------------|
| **1. Timeout incomplete** | Gate dies ~20m, 0/0/0 RED | Work *was* running; hard cap killed it mid-suite | Cap exists (`gate_ms` / `CALL_TIMEOUT`); **mis-labeled** as RED — T1 |
| **2. Silent death** | Process gone, lock orphan, empty stderr, no DONE | Engine exited mid-wave | **process-lifetime.mjs** + heartbeat + last-crash (sleep **0075** / cluster **0072**); resume fix landed — still prove on live multi-wave |
| **3. True hang / stall** | Process **alive**, child **alive**, **no progress** for long wall clock | Deadlock, blocked network, agent no tokens, pytest stuck test | **Missing as productized watchdog** — only manual process-tree + log mtime checks today |

### What already exists (do not reinvent)

- **Per-agent call timeout** (`run-live` / `spawnGuarded` / `CALL_TIMEOUT_MIN` default ~20m) — SIGKILLs hung **child** agent calls.
- **Kill-on-exit registry** (`proc-guard.mjs`) — orchestrator teardown should not leave agent children.
- **Process-lifetime guards** (`trio/drivers/process-lifetime.mjs`, journal **0075**): heartbeat.json, last-crash.json, uncaughtException fail-loud — reduces **class 2**.
- **Does NOT claim:** external SIGKILL / host reaper eliminated; **class 3 stall** while PID alive needs observation of *progress*, not just *aliveness*.

### Proposed watchdog ladder (sleep tickets T8–T11)

**T8 — Progress heartbeats are mandatory, not optional**  
Every long phase must write a monotonic progress stamp (file or log line) at least every **60–120s**:
- Gate: last pytest line / %  
- Execute/fix/review/shark/Gandalf seat: “still running · phase X · t+Nm”  
If stamp age > **3× heartbeat interval** while PID alive → **STALL_SUSPECT** (status table), not silent hope.

**T9 — Stall escalate policy (automatic, bounded)**  
1. **t_stall = 2× expected phase budget** (or fixed defaults: gate 25m if full-suite forbidden; agent call = CALL_TIMEOUT already).  
2. On STALL_SUSPECT: dump child tree + last 50 log lines to `journal/runs/` / `.foreman/stall-snapshot.json`.  
3. On **hard stall** (e.g. 1.5× CALL_TIMEOUT with no progress stamp): kill child tree → stamp `STALL_KILLED` → resume policy (re-enter step, not thrash full wave if gate already GREEN — 0075 resume).  
4. Never sit unbounded waiting for “maybe it finishes.”

**T10 — Separate “productive long” from “stuck” in UX**  
Status table must show: `Doing gate · pytest 37% · last progress 12s ago` vs `Doing gate · NO progress 8m · STALL_SUSPECT`. Cadence 10m is enough **if** progress stamps exist; without them, 10m cadence cannot protect wall clock.

**T11 — Cross-skill same pattern**  
Jumper journal **0005** already: sparse stage logging looks like stall (Ecgberht). Sleep should share one **progress-event contract** across Foreman / Crucible / Jumper / Gandalf hosts — not four ad-hoc logs.

### How this plugs into our earlier recipes A–E

| Recipe | Hang class it attacks |
|--------|------------------------|
| A Timeout ≠ RED | Class 1 (honest) |
| B Right-size gate | Class 1 root cause (less need for long gates) |
| C Rebind + orphan kill | Class 1 residual + orphan CPU |
| D Progress heartbeats | Class 3 detection (human doesn’t poll) |
| E Crucible serial thrash | Fake long work (not hang, but waste) |
| T8–T11 watchdog | Class 3 kill + forensics |
| 0075 process-lifetime | Class 2 fail-loud + resume |

### What we will NOT claim until sleep ships T8–T11

- “Runs never hang.”  
- “10-minute chat updates alone prevent stuck processes.”  

We **will** claim after P0+T8–T11: hangs either **finish under a budget**, **die loud with a stamp**, or **show progress** so waiting is intentional productivity—not mystery.

---

## How we actually fix it (sleep-ready recipe — John 2026-07-23 ask)

Principle: **wall clock only for dangerously productive work.** Engine must make long work *honest* and short-circuit *fake* work.

### Recipe A — Never fake-fail a kill mid-suite (days 1 of sleep)

1. In Foreman gate runner, when child hits wall timeout or `exit_code == null` after long spawn:
   - Write `gate_class: "TIMEOUT_INCOMPLETE"` (not plain RED).
   - Parse last pytest progress line if present (`[ 37%]`) into `progress_pct`.
   - FIX prompt template: *“Gate timed out incomplete under cap; scope test-command to wave tests; do not invent failing tests.”*
2. Status table row: `Tests timeout ✗ · incomplete · re-scope gate` — never `0 pass 0 fail` alone.

### Recipe B — Right-size the gate before burning 20 minutes

1. Stage-2 (and force-emit / locate-plan): if project has pytest and collect-only count > 200 and command is bare `tests/` or `test/`, **refuse handoff** unless plan has `gate: full-suite-opt-in: true`.
2. Default emission: `test-command: python -m pytest -v tests/test_<wave_slug>.py` (or globs from wave deliverables).
3. Optional: run collect-only at wave start; if est_time > 0.7 × gate_cap → **amend HALT** before execute (cheap).

### Recipe C — Rebind + kill orphans (so rescue works)

1. Each gate iteration: re-call `discoverTestCommand(plan)` — do not cache argv from wave open.
2. On timeout/kill: `taskkill` process tree of gate child (Windows Job Object already preferred); verify no orphan `pytest` left.
3. Operator mid-run amend of plan must take effect on **next** gate without restart.

### Recipe D — Stop “is it hung?” human polling

1. Engine writes `_foreman-gate-progress.log` every 60s during gate (last pytest line).
2. Engine writes agent lifecycle: `execute start/end`, `fix start/end`, `gate start/end` with ms.
3. Crucible same: start/end per Oranges step and revise (not only 10-min Shark heartbeat).
4. Cadence agent: read `projectDir` from handoff receipt; never assume plans folder.

### Recipe E — Cut Crucible serial thrash (same effort)

1. Stage-2 human-lockable + approved → **emit doc-trio from structured waves**, skip second Shark Tank.
2. Markdown revise: apply patch/search-replace when changelog is “1 change”; refuse full re-emit below size threshold unless forced.
3. Drafts: North Star by reference only (one-line path + criteria list).

### Expected outcome after sleep ships A–D

- A wave gate finishes in **seconds–few minutes**, not 20+ of incomplete suite.
- Timeout never looks like “zero tests failed.”
- Long productive work shows **progress lines** so 10-min cadence is enough (no 30s human checks).
- Approve/handoff does not double wall clock for free.

---

## What NOT to do in sleep

- Do not remove the gate timeout (hangs forever is worse).
- Do not default to “always full suite” for “safety” on monorepos — that’s what burned today.
- Do not patch skills mid-share-build ad hoc beyond operator-scoped test-command (this run already did that as rescue only).

---

## Related journals

- Crucible **0068** — Stage-1 wall-clock: real work vs hang; low-value revise; same-family thrash  
- Crucible **0069** — Stage-2 `approved=true` re-tanks, no emit  
- Foreman **0050** cf-slick gate preflight lifecycle (prior art)  
- Foreman **0072 / 0075 / 0076** — silent death / process lifetime / execute thrash clusters  
- Thin note **0001-share-anchor-w1-full-suite-gate-timeout.md** — superseded by this entry for sleep detail  

**Sleep feed label:** `genuine-execution` · cluster `wallclock-productivity` · host `share-anchor-skills-2026-07`
