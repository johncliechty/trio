---
name: crucible
description: >-
  Standalone production planning skill — the planning brain of the trio
  researchPrime (research) -> Crucible (planning) -> Foreman (build). Invoke it on
  an intent (greenfield) or a messy existing project (brownfield) to forge a
  vetted, gold-standard, Foreman-ready implementation plan WITHOUT drifting from
  the project's locked objective. Three you-approve stages — Stage 0 Intake &
  Framing (lock the North Star) -> Stage 1 Master Plan -> Stage 2 Implementation
  Plan + Foreman handoff — each refined by an adversarial Shark-Tank loop (3
  fresh-context Sharks; BLOCKER needs >=2 to agree) steered by a persistent
  Deep-Think Synthesizer (steers, never decides) and decided by a context-free
  Judge plus the user (the convergence authority). A Node engine that IMPORTS
  Foreman's durability/git/driver modules (never forks) and SPAWNS
  locate-plan.mjs as the machine well-formedness gate. STATUS (2026-06-05): the
  full engine — Waves 1-11 — is built and GREEN; the dogfood self-run proves
  convergence (finding -> dry round) + a user-gate HALT/resume and emits a
  zero-HALT doc-trio, and the 5-gate Skill Productionization Checklist passes.
---

# Crucible

Crucible is the **planning brain** of John's skill trio: **researchPrime** (research)
→ **Crucible** (planning) → **Foreman** (build). It is a deliberately-invoked,
heavyweight planner that turns an intent — or a messy existing project — into a
**vetted, gold-standard, Foreman-ready implementation plan**, while **never
drifting** from the project's locked objective.

> **Status (2026-06-05): the engine is built and GREEN through Wave 11.** The
> three-stage pipeline, the Shark-Tank round engine, the Synthesizer + Judge, the
> two-gate convergence, researchPrime integration, the cross-model Enhanced mode +
> GitHub remote, the docs/VC layer, and the dogfood self-run + 5-gate
> productionization checklist all live in `bin/` and are exercised by
> `node --test test/`. The model-driven steps run through an injected `agent()`
> seam; the machine well-formedness gate is Foreman's real `locate-plan.mjs`,
> SPAWNED (never forked) so its exit code is forge-proof.

## What Crucible is / is NOT

- **Is:** a standalone skill that forges a plan through framing, brainstorming, and
  **Shark-Tank** refinement steered by a persistent **Deep-Think Synthesizer** and
  backed by researchPrime, then hands a Foreman-ready plan to the builder.
- **Reuses, never forks:** imports Foreman's `foreman-lib.mjs` (atomic checkpoints,
  budget, contract primitives), `git-hygiene.mjs`, and `makeAgentDriver` from
  `wave-workflow.js`; **spawns** `foreman/bin/locate-plan.mjs` as the well-formedness
  gate. Exactly one copy of each on disk.
- **Is NOT:** a lightweight everyday planner (that's Project-Manager), a code builder
  (that's Foreman), or an infinite-polishing machine.

## Two guiding principles

- **The inclusion test (the size rule):** every element must serve a North-Star
  criterion; growth that serves the objective is welcome — only non-serving bloat is
  cut or Grasscatched.
- **The Parable of the Oranges (real-intent foresight):** probe for the real goal,
  bring expertise, think 2–3 steps ahead, add justified value, show the receipt.

## The pipeline — three you-approve stages

1. **Stage 0 — Intake & Framing** → 🚦 the user **locks the North Star**. Greenfield
   Oranges framing, or a tiered brownfield ingest (T1 inventory/dedupe → T2
   reproduce-first + coverage → T3 delegate deep archaeology to researchPrime), with
   Confirmed/Inferred/Gap labels that gate. Drift detection begins **after** the lock.
2. **Stage 1 — Master Plan** → 🚦 the user **approves**. Oranges brainstorm
   (assumption-map → premortem → ideate), batch triage, a phased plan, then the
   Shark-Tank loop to convergence.
3. **Stage 2 — Implementation Plan** → 🚦 the user **approves** → the well-formedness
   gate → **Foreman handoff**. Wave decomposition with per-wave acceptance criteria
   (a one-line *done-when* + Given/When/Then for non-trivial waves), the Shark-Tank
   loop, then the emitted doc-trio + `foreman.config.json`.

**The Shark Tank** is the adversarial review round: 3 independent fresh-context Sharks
(Skeptic / Contrarian / Analyst), each prompted to refute, each embedding the North
Star + a rotated PM critique angle. **BLOCKER = ≥2 Sharks agree.** **The Synthesizer**
is a persistent Director that steers but never decides; **the Judge** decides
(cross-model when reachable, else a same-model fresh-context judge persona), and **the
user is the final convergence authority**.

## Substrate (two modes)

- **Default (subscription-only):** fresh-context Sharks + a same-model fresh-context
  Judge persona. Fully functional on the bare subscription.
- **Enhanced (API keys / CLIs present):** a cross-model Judge at the lock gate + a
  reasoning Synthesizer, selected by reasoning-strength + family diversity, with
  graceful degrade. Every run **stamps which model filled which role**.

## Files in this skill

**Engine (Node — ESM `.mjs`):**
- `bin/crucible-lib.mjs` — the contract layer: re-exports the imported Foreman
  primitives, the checkpoint superset (`newCrucibleCheckpoint`), the three-stage state
  machine + HALT-gate set, and the containment-safe managed-git context.
- `bin/agent.mjs` — the live `agent()` seam (`claude -p`), env-gated by
  `CRUCIBLE_AGENT_LIVE=1`, stubbable in tests.
- `bin/shark-tank.mjs` — the adversarial round engine (Sharks, cross-Shark finding
  identity, ≥2-agree BLOCKER, inclusion-test demotion, dry-round detection).
- `bin/synthesizer.mjs` / `bin/judge.mjs` — the Director (steers, never decides; the
  fresh-eyes cold pass + isolation oracle) and the context-free deciding Judge.
- `bin/gates.mjs` — the well-formedness gate (spawns `locate-plan.mjs`), the
  quality/convergence gate, and the post-lock tiered drift detector.
- `bin/research.mjs` — researchPrime integration (once up-front + cost-guarded per round).
- `bin/stage0.mjs` / `bin/stage1.mjs` / `bin/stage2.mjs` — the three stage protocols.
- `bin/enhanced.mjs` / `bin/remote.mjs` — cross-model Enhanced mode + the
  push-at-approval-gates GitHub remote (never auto-pushes).
- `bin/docs.mjs` — the living-doc + version-control layer.
- `bin/self-run.mjs` — the dogfood self-run (drives Stage 0→1→2, proves convergence +
  HALT/resume, emits a zero-HALT doc-trio) — also the runnable entrypoint.
- `bin/checklist.mjs` — the 5-gate Skill Productionization Checklist (the five
  North-Star criteria, made checkable) + the SKILL.md manifest checker.

**Tests:** `test/*.test.mjs`, auto-discovered by `test/index.mjs`. The gate is
`node --test test/`.

## How to invoke

1. **Run the engine.** Drive the stages through the `agent()` seam: scripted/stubbed
   in tests, or the live `claude -p` sub-agent with `CRUCIBLE_AGENT_LIVE=1`.
2. **Dogfood it deterministically** (no model, no billing): `node bin/self-run.mjs
   [outputDir]`. It plans a fixture intent end-to-end, emits a Foreman-ready doc-trio
   into the output dir, and prints the 5-gate checklist (exit 0 on a full pass).
3. **Hand off to Foreman.** Stage 2 gates the handoff on Foreman's real
   `node foreman/bin/locate-plan.mjs --json <dir>` (exit 0 required) — Crucible never
   hands Foreman a malformed doc-trio.
