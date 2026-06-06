# trio — Description / Design Doc (for the Foreman build)

**What we are building:** **`trio`** — a single public GitHub monorepo (under
`johncliechty`) that packages John's skill trio — **researchPrime** (research) →
**Crucible** (planning) → **Foreman** (build) — so a collaborator can `git clone`
it and run one `/onboard` command to install and activate the skills in Claude
Code, on Windows / macOS / Linux, **without ever degrading their existing Claude
Code setup**. The engine skills' model backend is **pluggable** across Claude
(default), Gemini, OpenAI, and Grok; researchPrime additionally ships as a
documented portable-markdown skill for Gemini CLI / OpenClaw.

> This file is the Foreman **description** role. The **waves** live in
> `IMPLEMENTATION-PLAN.md`. This plan was forged by **Crucible** (Stage 0 North
> Star lock → Stage 1 Master Plan → Stage 2 wave decomposition, Shark-Tank
> converged) and handed off per the trio contract: Crucible plans, Foreman builds.

## North Star (LOCKED)

Forge a public `johncliechty` monorepo of the trio that a collaborator clones and
activates with one `/onboard` command — installing the skills into Claude Code on
Windows/macOS/Linux without degrading the working Claude Code experience — where
the engine's model backend is swappable across Claude/Gemini/OpenAI/Grok via a
pluggable driver, and researchPrime ships as a documented portable-markdown skill.

**Success criteria (inclusion-test anchors — every element must serve one):**
1. One-command activation: `clone → /onboard → trio live` in Claude Code.
2. Sibling-integrity guaranteed by repo layout (Crucible↔Foreman imports never break).
3. Non-regression: `/onboard` idempotent, non-destructive, clean uninstall; the
   Claude driver path stays green and behavior-identical.
4. Cross-OS from one Node installer (Win/mac/Linux).
5. Pluggable driver: Claude (default) + Gemini + OpenAI + Grok backends for the
   engine `agent()` seam.
6. Portable-markdown layer: researchPrime documented for Gemini CLI / OpenClaw.

## The load-bearing invariant (DO NOT BREAK)

Crucible imports Foreman via the relative specifier `../../foreman/bin/...`
(`crucible/bin/crucible-lib.mjs` → `foreman-lib.mjs`, `wave-workflow.js`,
`git-hygiene.mjs`, `wave-engine.mjs`; and spawns `foreman/bin/locate-plan.mjs`).
This resolves **iff `crucible/` and `foreman/` share an immediate parent.** The
monorepo places both as **direct top-level siblings**, so the import needs **zero
changes** and survives the `~/.claude/skills` junction (Node resolves to the real
path). Any layout that breaks that adjacency breaks Crucible.

## Architecture (summary)

- **Monorepo, skills as top-level siblings:** `trio/{researchPrime,crucible,foreman}`
  plus `trio/tools/` (onboard + verification) and `trio/drivers/` (the pluggable
  model backends). One `git clone`, atomic versioning. Submodules rejected
  (clone friction, version-sync pain).
- **`/onboard` = repo-shipped slash command → Node installer:**
  `.claude/commands/onboard.md` (available when Claude Code runs inside the clone)
  invokes `node tools/onboard.mjs`, which symlinks each skill into
  `~/.claude/skills` via one `fs.symlinkSync(target, link, 'junction')` call (real
  junction on Windows — no admin; `ln -s` semantics on POSIX). Idempotent,
  non-destructive (warn + refuse to clobber a foreign skill dir without `--force`),
  prerequisite-detecting (`node`/`claude`/`git`), with `--uninstall`.
- **Pluggable driver behind the `agent()` seam:** one `runAgent({prompt, schema,
  freshContext})` interface; the **existing `claude -p` code is the default driver,
  untouched** (that *is* the non-regression guarantee); `gemini`/`openai`/`grok`
  drivers are additive modules selected by `TRIO_DRIVER`. A capability matrix marks
  each `subAgentCapable` (CLIs spawn real fresh contexts; raw APIs approximate via
  clean isolated calls — researchPrime's existing model). Keys live in collaborator
  env (`.env.example`), never committed.
- **Public-repo hygiene:** scrub personal absolute paths / email / secrets; ship
  `LICENSE` (MIT), top-level `README`, `.gitignore`, `.env.example`.

## Tech & conventions

- Language: **Node.js (ESM `.mjs`)**, matching Crucible/Foreman. Native test
  runner. Cross-OS by construction (no per-OS shell scripts).
- Authored BOM-free; CRLF tolerated (git `eol=lf`).
- **Source of the copied skills:** `C:\dev\crucible` and `C:\dev\foreman` (current
  green trees). researchPrime (`C:\dev\researchPrime`) is imported **last (Wave 6)**
  because it is being revised in a parallel Crucible run — late import avoids any
  collision.
- Copies EXCLUDE `.git`, `node_modules`, `.foreman`, `foreman-checkpoint.json`,
  run/status logs, and `plans/` output dirs.

## Scope / Non-goals

- **In:** the monorepo assembly, the cross-OS `/onboard` installer + slash command,
  the public-repo hygiene/scrub, the pluggable `runAgent` driver (Claude default +
  Gemini/OpenAI/Grok), researchPrime's portable-markdown install docs, and an
  end-to-end fresh-clone verifier.
- **Out (Non-goals):** Skill Foundry packaging (eventually); publishing to a skill
  marketplace/registry; making Grok/OpenAI/Gemini *host* these skills natively
  (the engine cross-harness is the **driver/model-backend** sense, not native
  skill-hosting — only researchPrime ports as a pasteable markdown prompt).
- **Human-only step (Foreman never pushes):** creating the public GitHub repo and
  the first `git push` are performed by the user after the build is GREEN (Wave 7
  emits the exact commands).
