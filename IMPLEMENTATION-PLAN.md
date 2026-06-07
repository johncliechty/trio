# trio — Implementation Plan (Foreman-ready)

**Status:** Forged by Crucible (North Star LOCKED → Master Plan APPROVED → Stage-2
wave decomposition, Shark-Tank converged). Handed to Foreman per the trio contract:
**Crucible plans, Foreman builds.** 7 waves. See `DESCRIPTION.md` for the design +
the load-bearing sibling invariant.

test-command: npm test

> **Gate = `npm test` at the repo root**, established in Wave 1 as `"test": "node
> --test"` (auto-discovers every `**/*.test.mjs` across `crucible/test`,
> `foreman/test`, and `tools/test`). **Every wave must ship real source its new
> tests import and exercise** — Foreman's vacuous-GREEN guard HALTs a wave that
> changes no executed source, and the anti-test-weakening guard HALTs on reduced
> test/coverage. A wave just drops its `<name>.test.mjs`; do NOT change the
> `test-command`.

**Project-DONE:** Wave 7 GREEN via the orchestrator-run gate AND `node
tools/scrub.mjs --check` exits 0 AND `node tools/verify-e2e.mjs` exits 0. The
public GitHub repo creation + first push are a **human follow-up** (Foreman never
pushes); Wave 7 emits the exact commands.

**Acceptance-criteria convention:** every wave has a one-line **done-when**;
non-trivial waves add 1–3 **Given/When/Then** scenarios.

**Foreman contract facts (honor these):**
- The managed git repo is `C:\dev\trio`, a **sibling** of `C:\dev\foreman`, so
  `assertContainment` does not fire. The `foreman/` copied *inside* trio is plain
  files at a different path (`C:\dev\trio\foreman`) — not the orchestrator's own
  `C:\dev\foreman`, so containment is unaffected.
- Source to copy: `C:\dev\crucible` → `trio/crucible`, `C:\dev\foreman` →
  `trio/foreman` (siblings; preserves `../../foreman/bin/` imports). Exclude `.git`,
  `node_modules`, `.foreman`, `foreman-checkpoint.json`, status/run logs, `plans/`
  outputs.
- researchPrime is imported in **Wave 6** (late) — it is being revised in a
  parallel Crucible run; do not import it earlier.

---

## Wave 1 — Monorepo scaffold + sibling assembly

**Intent:** Assemble the canonical `trio` monorepo with `crucible/` and `foreman/`
as direct top-level siblings, so the `../../foreman/bin/` imports resolve in-repo,
and establish the root test gate.

**Deliverables:** copy `C:\dev\crucible` → `crucible/` and `C:\dev\foreman` →
`foreman/` (excluding the dirs named above); root `package.json` with
`"type":"module"` and `"test":"node --test"`; `.gitignore` (node_modules,
`.foreman`, `*-checkpoint.json`, status/run logs, `plans/out`, `.env`); `.env.example`
(placeholder `ANTHROPIC*`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY`);
`LICENSE` (MIT, copyright John Liechty); `README.md` skeleton (what the trio is +
the clone→cd→claude→/onboard quickstart).

**Depends on:** —

**done-when:** from the repo root, `npm test` is GREEN — i.e. `node --test`
discovers and passes the copied `crucible/test` and `foreman/test` suites, proving
the sibling imports resolve **in-repo** (not via the original `C:\dev` trees).

- **Given** a checkout of `trio` with no global `~/.claude/skills` junctions,
  **when** `npm test` runs at the root, **then** the crucible + foreman suites pass
  (Foreman's 66/66 unchanged), proving `crucible/bin` resolves `../../foreman/bin`
  to `trio/foreman`.
- **Given** the copy step, **when** the tree is inspected, **then** no `.git`,
  `node_modules`, or `*-checkpoint.json` from the source trees is present.

## Wave 2 — Public-repo hygiene scrubber

**Intent:** Make the tree safe to publish publicly, enforced by a reusable,
tested scrubber.

**Deliverables:** `tools/scrub.mjs` — scans the tracked tree for a deny-list
(personal absolute paths like `C:\Users\<name>`, the maintainer email, common API-key
patterns) and exits non-zero on any match under `--check`; `tools/test/scrub.test.mjs`
(fixture dir with planted offenders → asserts detection; clean fixture → asserts
pass). Apply it: relocate/remove offenders, and gitignore personal logs
(DECISION-LOG / EXECUTION-LOG style files carried in from the copies).

**Depends on:** Wave 1

**done-when:** `npm test` GREEN (incl. the scrub tests) AND `node tools/scrub.mjs
--check` exits 0 over the whole tree.

- **Given** a fixture containing a planted `C:\Users\<name>\...` path and a fake key,
  **when** `scrub.mjs --check` runs on it, **then** it exits non-zero and names both;
  **given** the cleaned repo tree, **then** it exits 0.

## Wave 3 — `/onboard` installer + slash command (Claude path)

**Intent:** One cross-OS, idempotent, non-destructive command that installs the
skills into Claude Code.

**Deliverables:** `tools/onboard.mjs` — for each skill dir, create a junction/symlink
at `~/.claude/skills/<name>` via `fs.symlinkSync(target, link, 'junction')` (Win
junction, POSIX symlink); idempotent (skip a link already pointing at this repo);
**non-destructive** (warn + refuse to overwrite a foreign dir/link unless `--force`);
prerequisite detection (`node`, `claude`, `git`) with a clear report of any missing;
`--uninstall` removing only links that point into this repo; `--dry-run`.
`.claude/commands/onboard.md` (slash command that runs the installer and reports
results). `tools/test/onboard.test.mjs` — uses a temp HOME + temp skills dir to
assert install, idempotency, non-destruction, and uninstall.

**Depends on:** Wave 1

**done-when:** `npm test` GREEN incl. onboard tests covering: fresh install creates
working links; a second run is a no-op; a foreign dir is not clobbered without
`--force`; `--uninstall` removes only our links.

- **Given** a temp HOME with no `~/.claude/skills`, **when** `onboard.mjs` runs,
  **then** 3 links are created pointing into the repo; **when** it runs again,
  **then** zero changes (idempotent).
- **Given** a pre-existing foreign `~/.claude/skills/crucible` real dir, **when**
  `onboard.mjs` runs without `--force`, **then** it warns and leaves it untouched.
- **Given** links created by us, **when** `onboard.mjs --uninstall` runs, **then**
  only our links are removed and unrelated entries remain.

## Wave 4 — Driver abstraction + Claude driver (NON-REGRESSION)

**Intent:** Introduce one pluggable model-backend seam without changing any
existing behavior — the Claude path must stay byte-for-byte equivalent.

**Deliverables:** `drivers/index.mjs` exposing `runAgent({prompt, schema,
freshContext, driver})` and a driver registry; `drivers/claude.mjs` = the existing
`claude -p` behavior (the current `crucible/bin/agent.mjs` + Foreman's
`makeAgentDriver` logic), wired so the default path is unchanged; route
`crucible/bin/agent.mjs` and the foreman driver seam through the registry with
`claude` as default. `drivers/test/driver-interface.test.mjs`.

**Depends on:** Wave 1

**done-when:** the existing crucible + foreman suites pass with **identical counts**
(non-regression), and the new driver-interface test passes; `npm test` GREEN.

- **Given** `TRIO_DRIVER` unset, **when** any engine `agent()` call routes through
  `runAgent`, **then** it dispatches to the Claude driver and the existing suites'
  pass counts are unchanged.

## Wave 5 — Gemini / OpenAI / Grok drivers + capability matrix

**Intent:** Add the non-Claude model backends behind the same interface, with a
capability model and graceful skip when keys are absent.

**Deliverables:** `drivers/{gemini,openai,grok}.mjs` behind `runAgent`; a capability
matrix (`subAgentCapable`, structured-output method per backend: CLI sub-agent vs
JSON-mode/function-calling); `TRIO_DRIVER` selection (default `claude`); `.env`
wiring + cost note in docs. `drivers/test/backends.test.mjs` using **mocked
transports** (no real network/keys) to assert request shaping + structured-output
parsing + that a missing key makes the live smoke **skip**, not fail.

**Depends on:** Wave 4

**done-when:** `npm test` GREEN; mocked backend tests pass for all three drivers;
`TRIO_DRIVER=openai|gemini|grok` selects the right driver; the Claude default and
Wave-4 non-regression still hold.

- **Given** `TRIO_DRIVER=grok` and a mocked transport, **when** `runAgent` issues a
  schema request, **then** the driver shapes the call correctly and returns a
  schema-valid object; **given** no key set, **then** the live smoke test is skipped.

## Wave 6 — researchPrime import (LATE) + portable-markdown docs

**Intent:** Add the third skill last (after its parallel revision settles) and
document its cross-harness install.

**Deliverables:** copy the then-current `C:\dev\researchPrime\SKILL.md` →
`researchPrime/SKILL.md`; extend `tools/onboard.mjs` to install it; add
`docs/portable-markdown.md` (copy-paste install for Gemini CLI / OpenClaw);
`tools/test/researchprime.test.mjs` (asserts onboard links researchPrime and its
SKILL.md frontmatter is valid: has `name` + `description`).

**Depends on:** Wave 3, Wave 5

**done-when:** `npm test` GREEN; `onboard.mjs` now links all three skills;
researchPrime's SKILL.md is present with valid frontmatter; the portability doc
exists.

- **Given** the imported researchPrime, **when** `onboard.mjs` runs in a temp HOME,
  **then** `~/.claude/skills/researchPrime` resolves into the repo.

## Wave 7 — End-to-end verify + re-scrub gate + release prep

**Intent:** Prove a fresh clone activates the whole trio, re-check publish-safety,
and stage the public release.

**Deliverables:** `tools/verify-e2e.mjs` — copies the repo to a temp dir, runs
`onboard.mjs` against a temp HOME, and asserts all three skills resolve + each
engine's import smoke passes; `tools/test/verify-e2e.test.mjs`; finalize `README.md`
(verified quickstart) and `docs/`; append the human publish recipe (create public
`github.com/johncliechty/trio`, `git remote add`, `git push`) to the README.

**Depends on:** Wave 2, Wave 6

**done-when:** `npm test` GREEN; `node tools/verify-e2e.mjs` exits 0; `node
tools/scrub.mjs --check` exits 0 (catches anything Wave 6 reintroduced). The repo is
now publish-ready; the human push is the documented follow-up.

- **Given** a fresh temp copy of the repo, **when** `verify-e2e.mjs` runs, **then**
  onboard activates all three skills against a temp HOME and each import smoke
  passes; **when** `scrub.mjs --check` runs, **then** it exits 0.
