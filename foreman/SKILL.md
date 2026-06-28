---
name: foreman
description: >-
  Autonomous multi-wave build orchestrator. Invoke inside a project folder that
  has frozen design + implementation-plan docs to drive each wave/sprint/section
  to done via fresh-context sub-agents in an EXECUTE -> ADVERSARIAL-REVIEW -> FIX
  -> RE-REVIEW loop, auto-advancing across waves and halting only on a defined
  blocker set. STATUS (2026-06-02): the full engine — contract + parsers, the
  one-wave EXECUTE/GATE/REVIEW/JUDGE/FIX loop, multi-wave auto-advance, budget
  pre-flight + resume, git hygiene, and Node + Python/pytest gates — is BUILT and
  adversarially verified through Phase 3d (106/106 unit tests). The ground-truth
  test gate is run by the orchestrator (a Node process), never by a sub-agent.
  Remaining: the empirical live agent()-driven calibration on the Pro/Max
  subscription.
---

# Foreman

Autonomous multi-wave build orchestrator (working title "code-execution-organizer").
Foreman is a Claude Code **skill** invoked in a project folder. Given that
project's *frozen* design + implementation-plan docs, it drives each
wave/sprint/section to done through fresh-context sub-agents, auto-advances to
the next wave, keeps the tree clean, prints running commentary, and **halts only
on a defined blocker set**.

> **Status (2026-06-02): the engine is built and adversarially verified through
> Phase 3d.** The invocation contract + parsers (Phase 0), the one-wave
> EXECUTE/GATE/REVIEW/JUDGE/FIX engine (Phase 1), multi-wave auto-advance
> (Phase 2), budget pre-flight + intra-wave/git resume (Phase 3a-c), and Node +
> Python/pytest gate support (Phase 3d) are all implemented in `bin/` — 106/106
> unit tests, each phase re-verified by an independent adversarial review. The
> model-driven {execute, review, fix} steps run as real sub-agents through an
> injected `agent()` seam; the ground-truth gate is run by the orchestrator
> itself so a sub-agent cannot forge a GREEN. **Remaining work:** the empirical
> live `agent()`-driven calibration on the Pro/Max subscription (tokens/wave +
> Pro-window pacing).

## What Foreman is / is NOT

- **Is:** a loop that takes a frozen plan and drives it to done wave by wave —
  EXECUTE -> ADVERSARIAL-REVIEW -> FIX -> RE-REVIEW until convergence, then
  auto-advance, with logging, hygiene, commits, and running commentary. **(built — see `bin/`)**
- **Is NOT:** a planner. It never invents requirements, refactors for taste
  outside the plan, or makes reserved architectural calls — those are **halts**.
  This anti-scope-creep contract is its most important property.

## Topology (the load-bearing rule)

Do **not** parallelize code-writing — coding is the least-parallelizable task and
parallel coders make conflicting implicit decisions (Anthropic + Cognition both
agree; see `research1-out/.../01-report.md` F1/F2).

| Phase | Topology |
|---|---|
| EXECUTE | single-threaded linear agent per wave; compress when long |
| REVIEW | `REVIEWER_COUNT` (default 2) independent reviewers, **sequential**, read-only, prompted to refute |
| FIX | single-threaded linear agent |
| JUDGE | 1 rubric judge; the **orchestrator-run ground-truth gate dominates** (§5) |

`REVIEWER_COUNT` is one config var (default 2, sequential) — never hard-coded.
Independence comes from separate sub-agent calls, never multi-persona-in-one-generation.

---

## §4 — Invocation / contract (the confirmation flow)

On invocation, Foreman resolves the contract and **states it back for the user
to confirm before building**. The deterministic, no-guess part is implemented in
`bin/locate-plan.mjs` (which uses `bin/foreman-lib.mjs`):

```
node foreman/bin/locate-plan.mjs [projectDir]      # human-readable contract
node foreman/bin/locate-plan.mjs --json [projectDir]
```

Exit codes: `0` contract resolved · `3` HALT-for-human · `2` internal error.

1. **Project folder** (cwd) is the project proxy.
2. **Frozen docs** — locate + state back the *description*, *implementation
   plan*, and *execution log*. Resolution is no-guess:
   - an explicit `foreman.config.json` `{ "docs": {...} }` wins; else
   - a case-insensitive heuristic glob over top-level `*.md`.
   - **0 candidates for a role -> HALT (missing).** **>1 candidate -> HALT
     (ambiguous; ask, never pick).** Foreman never guesses which file is the plan.
3. **Wave parsing** — waves are read from an explicit `## Wave N` heading
   (`## Sprint N` / `## Section N` accepted as aliases) in the plan doc. Headings
   inside code fences are ignored. Wave numbers must be **contiguous 1..N**.
   - **No parseable wave structure -> HALT.** Foreman never infers wave boundaries.
4. **Test discovery** — the build+test (gate) command, from the plan first
   (`test-command:` / `build-and-test:` / `gate-command:` line), else the project
   manifest (`package.json` `scripts.test` -> `npm test`; `pyproject.toml` with
   pytest -> `pytest`).
   - **No ground-truth test command found -> HALT** ("no ground truth -> cannot gate").
5. **Project-DONE definition** — DONE = the last parsed wave GREEN (via the
   orchestrator-run gate) **and** any plan-level acceptance gate met. Foreman
   emits a final-state verdict and stops; it does **not** loop past the last wave.
6. **Budget** — `{max waves this run, max fix-iters/wave (default 4), max
   wall-clock}`; the Workflow `budget` token target is a secondary guard. **(enforced as a hard pre-flight gate)**
7. **Ambiguity gate (the linchpin).** Before acting, each execute/review agent
   must emit `answerable-from-frozen-docs: yes/no + cited plan line`. A `no` is a
   **HALT** (§6.4), never an autonomous decision. This is what makes "no
   babysitting" possible without scope creep. **(implemented: the execute/review
   agent prompts emit the gate; the engine cannot weaken it.)**

---

## §5 — Judge arbitration + the trusted ground-truth gate (reward-hacking fix)

**Evidence precedence:** OBSERVED test/command output -> reproduced execution
data -> directly-read authoritative source -> theory/argument.

- **The gate is run by the orchestrator, not by a sub-agent.** The deterministic
  Workflow step executes the build+test command, captures exit code + stdout/stderr
  to a **gate-artifact file that sub-agents cannot write**; the judge reads only
  that artifact. Sub-agent-pasted "command output" in a wave log is **never** the
  gate of record. (Closes the forge-the-output hole.) **(implemented in `bin/wave-engine.mjs` `runGate`)**
- **Anti-test-weakening:** snapshot the test inventory + assertion/skip count at
  wave start. A wave that reduces test count/coverage or adds `skip`/`xfail`
  without an explicit plan citation is an **automatic HALT**, not a downgradeable
  finding.
- **Vacuous-GREEN guard:** if the GREEN gate does not execute any artifact this
  wave changed (coverage-of-changed-files check), it is **not** a GO — HALT as
  "gate proves nothing about this wave."
- **Judge rules:** a GREEN gate outranks reviewer prose; to block GREEN a
  reviewer must produce a **failing repro command + output**. The judge may HALT
  on missing required tests; it may not override passing real output with argument.
- **Anti-sycophancy:** reviewers run read-only, are prompted to **refute**, cite
  `file:line` or `command+output`; a **BLOCKER requires >=2 independent reviewers
  to agree**.
- **Finding identity:** every finding carries a stable id (`file:line + rule`);
  convergence = zero open BLOCKER/MAJOR with verified closure; a fix that closes
  A but opens B is tracked to prevent false convergence / oscillation.

---

## §6 — Halt-for-human conditions (the only things that wake you)

1. Budget / iter / wall-clock cap.
2. Verdict **NO-GO**.
3. **Non-convergence** (`MAX_ITERS`, default 4, no GO) — `git stash`/branch the
   failed attempt and record the ref so the tree is left clean and recoverable.
4. **Ambiguity / new-requirement / plan-deviation** — any
   `answerable-from-docs: no` (§4.7), or a wave diff with no traceable plan basis.
   - **`PLAN-AMENDMENT-PROPOSAL` (sub-type).** When a build-time discovery shows
     the *frozen plan itself* is wrong/incomplete for the current wave (an
     assumption falsified, an API not behaving as the plan assumed) — distinct
     from mere ambiguity above — a review/execute agent may attach a concrete
     proposed resolution: a **proposed diff** to the plan doc **plus a rationale**.
     This is **still a HALT** — no silent re-planning. Foreman records the proposal
     in the checkpoint `pending_action` for one-click human approval; on approval +
     resume the bounded amendment is applied (or recorded as applied) and the wave
     continues. The human stays in the loop and must approve before any plan change
     takes effect; the §4.7 ambiguity gate and every §5 guard are unchanged. F3
     only attaches a resolution to a halt that would otherwise be bare.
5. **Unrecoverable error** — can't verify a load-bearing claim; repo in bad
   state; an irreversible action's gates didn't both verify; invalid/torn
   checkpoint on resume (§8).
6. **Test-integrity / vacuous-GREEN** halts (§5).

On every halt: write the checkpoint (§8) with the **exact recommended next
action** in `pending_action`. In Phase 0, the `bin` CLIs signal a HALT with
**exit code 3** and a `HALT: <reason>` line on stderr.

---

## §8 — State, durability, resume (zero context bloat)

- Sub-agents communicate via **file paths**, never by dumping transcripts into
  the orchestrator. **(implemented)**
- **Per-wave logs + gate artifact:** the orchestrator-written gate artifact is
  `.foreman/wave-<n>-gate.json` (`written_by:"orchestrator"`); the judge reads
  only that. **(implemented)**
- **Canonical checkpoint `foreman-checkpoint.json`** (project root). Schema
  (implemented in `bin/foreman-lib.mjs`, exercised by `bin/checkpoint.mjs`):

  | field | type | notes |
  |---|---|---|
  | `plan_path` | string | absolute path to the plan doc |
  | `current_wave` | number | 1..N |
  | `total_waves` | number | parsed count |
  | `intra_wave_step` | string | `execute`\|`review`\|`fix`\|`judge`\|`gate`\|`done` |
  | `iteration` | number | fix<->review iteration within the wave |
  | `reviewer_count` | number | default 2 |
  | `budget_remaining` | object | `{waves, fix_iters, wall_clock_min}` |
  | `last_verdict` | string\|null | `GO`\|`NO-GO`\|`HALT`\|null |
  | `last_commit` | string\|null | HEAD at last checkpoint |
  | `open_findings` | array | `[{id, severity, file, line, rule, status}]` |
  | `pending_action` | string\|null | exact recommended next action on halt |
  | `stash_ref` | string\|null | non-convergence stash/branch ref |
  | `status` | string | `running`\|`halted`\|`done` |

- **Atomic writes:** serialize -> write `<file>.tmp` -> `fsync` -> atomic
  `rename` over the destination. A torn write can never replace a valid file.
- **On resume, if the JSON is invalid (torn) or breaches the schema -> HALT.**
  Never best-effort-parse a torn file.
- **Resume reconciliation (Phase 2):** compare `git rev-parse HEAD` to
  checkpoint `last_commit`; if HEAD is ahead, adopt HEAD and skip the re-commit
  (prevents double-apply). Intra-wave resume uses `intra_wave_step`.

CLI (Phase 0):

```
node foreman/bin/checkpoint.mjs new <file> --plan <path> --waves <N> [--reviewers K]
node foreman/bin/checkpoint.mjs read <file>          # HALT (exit 3) on torn/invalid
node foreman/bin/checkpoint.mjs roundtrip <file> --plan <path> --waves <N>
node foreman/bin/checkpoint.mjs dashboard <file>     # render §10 block
```

---

## §10 — Running commentary (best-effort telemetry)

Suppress sub-agent transcripts; narrate via `log()` / status line. Token %,
context fill, and rate-window status are **best-effort with graceful fallback**
(the harness exposes no live quota API; window status is derived reactively from
observed 429s, e.g. `window: OK` / `throttled @ HH:MM`). Rendered by
`renderDashboard()` in `bin/foreman-lib.mjs`:

```
[Foreman | C:\dev\aurora | wave 3/7 "MoE judge wiring"]
  ▸ execute… done (commit 1a2b3c4, 2 files)            +6m
  ▸ review (2 independent, sequential)… 1 MAJOR        +5m
  ▸ fix iter 1… closed MAJOR; re-review… GO            +4m
  ✓ wave 3 converged (2 iters) · gate 18/18 (orchestrator-run)
  → advancing to wave 4/7
context: ~38% (best-effort) · elapsed 1h12m · budget 3/8 waves · window OK
```

---

## Files in this skill

**Engine (Node — the orchestrator + gate live here, never in a sub-agent):**
- `bin/foreman-lib.mjs` — parsers + state primitives: `locateDocs`, `parseWaves`,
  `discoverTestCommand`, `projectDoneDefinition`, checkpoint schema + atomic
  `writeCheckpointAtomic`/`readCheckpoint`, `makeBudget`, `renderDashboard`.
  Recoverable refusals throw `HaltError`.
- `bin/wave-engine.mjs` — the one-wave engine (`runWave`): EXECUTE -> orchestrator
  GATE -> sequential REVIEWERS -> JUDGE -> bounded FIX -> re-gate, with all §5
  guards (real-tests-ran GREEN predicate, anti-weakening, vacuous-GREEN, finding
  identity). Language-aware gate for Node `--test` and `python -m pytest -v`.
- `bin/project-engine.mjs` — multi-wave auto-advance (`runProject`): ascending
  truth-gated advance, project-DONE, budget pre-flight, wave/intra-wave/git resume.
- `bin/git-hygiene.mjs` — §9 git hygiene: dedicated work branch, commit-only-on-GO,
  dirty-tree HALT, repo-boundary containment, crash reconciliation. Never pushes.
- `bin/wave-workflow.js` — the production driver seam: `makeAgentDriver({agent})`
  turns an injected `agent()` (Workflow `agent()`, the Agent tool, or a headless
  `claude -p` child) into the engine's {execute, review, fix} steps.
- `bin/drivers/scripted-driver.mjs` — deterministic no-LLM driver used by the tests.
- `bin/locate-plan.mjs`, `bin/checkpoint.mjs`, `bin/run-wave.mjs`,
  `bin/run-project.mjs` — CLIs (contract resolver, checkpoint IO, single-wave and
  whole-project runners).

**Why a Node process, not a Workflow script (design finding L):** a Workflow-tool
script has no filesystem/process access, but §5 requires the orchestrator to spawn
the test command and write a gate artifact sub-agents cannot forge. So the
orchestrator + gate + state live in this Node engine; the Workflow tool / sub-agents
drive only the model steps via the `agent()` seam.

**Tests & fixtures:** `test/*.test.mjs` (106 passing), `fixtures/canonical-project/`
(Node, ships red), `fixtures/py-canonical/` (pytest, ships red), and the
`test/neg-*` HALT cases.

## How to invoke

1. **Resolve the contract first.** From the project folder, run
   `node <skill>/bin/locate-plan.mjs .`. If it prints `HALT:` (exit 3), fix the
   named problem (add the missing doc, add `## Wave N` headings, declare a
   `test-command:`) and re-invoke — Foreman never proceeds on a guessed contract.
2. **Dry-run the engine deterministically** (no LLM, reproducible) with the
   scripted driver: `node <skill>/bin/run-project.mjs <projectDir>` (add `--git`
   for commit-on-GO, `--max-waves`/`--max-wallclock-sec` for a budget cap,
   `--resume` to continue from a checkpoint).
3. **Drive it with live sub-agents** using the robust wrapper script:
   `powershell -File <skill>/bin/go.ps1 -Project <projectDir> [-Resume]`
   The script automatically handles stale locks and executes through the backend registry (supporting `claude` or `gemini-cli`). To use Gemini, ensure you explicitly set `$env:TRIO_DRIVER="gemini-cli"` and `$env:GEMINI_MODEL="gemini-3.1-pro"` (or your current session's active model) before invoking `go.ps1`. The wrapper also requires `$env:CRUCIBLE_AGENT_LIVE="1"` to allow live billable agents.
