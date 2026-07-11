---
name: researchPrime
description: Universal best-in-class research skill with an engine-backed, stakes-scaled adversarial verification loop. Runs a distinct PLANNING phase and a FRESH plan-only EXECUTION phase (true context isolation on sub-agent hosts; honest degraded mode elsewhere), then a Phase-3 that — on hosts with Node — drives a multi-round adversarial loop (heterogeneous >=2-agree reviewers, a separate context-free Judge, an active Deep-Think Synthesizer, convergence-until-dry, cross-lineage origin fusion) via a Node engine that IMPORTS, never forks, the trio's Crucible+Foreman machinery. Weights evidence on the OBSERVED>CORROBORATED>CLAIMED>UNVERIFIED>REFUTED ladder, reports correlated-blind-spot recall honestly, resists the bandwagon effect, refuses to flatter or hallucinate, and returns three summary levels (full report / executive / agent-implementation). Hosts without Node get a schema-conformant prose run stamped "adversarial verification did NOT run". Use for /researchPrime, "deep research with validation", or any high-stakes investigation.
---

# researchPrime — Universal Best-in-Class Research Skill (engine-backed)

This skill runs a distinct planning phase, a fresh plan-only execution phase, and an adversarial validation phase. It reports the true state of the world, weights evidence by verification quality, and does not tell the requester what they hope to hear. Popularity is not treated as truth.

researchPrime OWNS the evidence ledger, the verification ladder (OBSERVED > CORROBORATED > CLAIMED > UNVERIFIED > REFUTED), GATE-1 independent-origins, the stakes governor, and the three report shapes. On a host with `node`, Phase-3 escalates to a real, stakes-scaled, multi-round adversarial loop in the Node engine in `bin/` — which IMPORTS (never forks) the trio's Crucible+Foreman modules. On a host without Node, Phase-3 runs an honest degraded prose pass and says so.

This file is self-contained for the prose protocol; the engine is in `bin/` alongside it.

> **Tier definition (Heavy vs regular · always-cross-model · seat mapping):** canonical in `C:\dev\Skill Foundry\AGENTS.md` → "Skill tiers". A `-Heavy` run uses top-frontier models on EVERY seat regardless of the base session (delegate the frontier seat to a frontier-pinned sub-agent if the base session isn't frontier); foundry skills are ALWAYS true cross-model. Do not re-define tiers locally.

---

## Step 0 — Mode + capability binding + run-dir (FIRST, every run)

You cannot reliably enumerate your own host's tool list mid-turn. Bind by try-and-observe.

1. **Sub-agent axis.** Default to single-context (sequential role-play). Switch to parallel-swarm only if the host explicitly signals sub-agent support. When unsure, stay single-context.

2. **Engine capability (import probe — NOT direct CLI).** From this skill's directory run:
   `node -e "import('./bin/contract.mjs').then(m=>m.runImportSpike()).then(v=>{process.stdout.write(JSON.stringify(v));process.exit(v.go?0:1)})"`
   If it exits 0 / prints `"go":true`, bind ENGINE mode for Phase-3. If `node` is absent or it exits non-zero, bind DEGRADED prose mode.
   Do NOT use `node bin/contract.mjs` for this probe: when the skill is installed via the onboard junction, that command prints nothing and exits 0 (its CLI guard compares the junction path to the symlink-resolved real path), which would falsely look like NO-GO.

3. **Other capabilities** (web-fetch, code-exec, file-write, sub-agent, search): bind each by a low-cost attempt, never by introspection.

4. **Run-dir.** Create a working dir for the ledger and the engine's crash-durable checkpoints.

---

## Phase 1 — PLAN (deliberate; gather nothing) + stakes vector + foresight

Produce only a written plan: the AXIS (the load-bearing win-condition and what would FALSIFY a candidate); a stakes VECTOR (impact / reversibility / blast-radius — irreversibility forces tier >= medium); the candidate branches; the best-in-class baselines to beat. Name no expected winner.

Oranges foresight receipt (required): name >=1 dropped or reordered branch AND its counterfactual cost. If you cannot, stamp "no foresight value added."

Emit the stakes vector + foresight receipt as the Phase-1 hand-off; the governor projects the vector to a tier that scales Phase-3. Freeze the plan and STOP.

---

## CONTEXT BOUNDARY — FRESH EXECUTION (plan-only)

Execution reads ONLY the frozen plan. On sub-agent hosts this is a real forget (stamp ISOLATION: real only with a recorded nonce check); on single-context hosts it is approximated — quote the plan and derive every step from the quote (stamp ISOLATION: approximated).

---

## Phase 2 — EXECUTE

Gather evidence; record each item in the evidence ledger with its origin(s) and place it on the ladder. Empirical (OBSERVED) requires real code execution; cap at CLAIMED with a NO-EXEC stamp where the host cannot run code. A claim supported only by "everyone says so / most popular" with no primary origin is BANDWAGON-ONLY and never exceeds UNVERIFIED without fresh independent verification. Count origins ONLY through the shared independence module — never re-implement origin counting.

---

## Phase 3 — VALIDATE: the stakes-scaled adversarial loop

### ENGINE mode (Node available)

Drive the REAL engine loop. The assembled orchestrator is `bin/governor.mjs` + `bin/round.mjs`, presented by `bin/deliverable.mjs`; `bin/dogfood.mjs` is the canonical worked example. Do NOT call `bin/engine.mjs runEngine` — that module is a skeleton with no-op gate slots.

Per governed round (`runGovernedRound({ agent, stakes, reviews, round, northStar })` -> `orchestrateRound(...)`):
- **Governor (stakes scaling).** Tier `low` fires ZERO Synthesizer/Judge/debate sub-agents; `medium`/`high` include them. A zero-AXIS-finding round is skipped at every tier.
- **G3 heterogeneous >=2-agree reviewers** + **G6 stable finding identity** via the trio `tallyFindings`/`SHARK_ROLES`/`angleForShark` (a finding counts only with >=2 agreeing reviewers).
- **GATE-1 independent origins** through the single shared independence module (same-lineage agreement adds 0 origins).
- **G9 conditional debate** — fires only on a conflicting independent-origin pair.
- **G8 cross-lineage origin fusion** — Enhanced-only; INERT by default behind the human-gated lineage enum (claims zero cross-lineage origins, wears the inert stamp).
- **G4 separate context-free Judge** (`makeJudge`) — DECIDES.
- **Active Deep-Think Synthesizer** (`makeSynthesizer`) — STEERS and files a separate brief; never decides.
- **G5 convergence-until-dry** with the honest tracker (an EMPTY round never counts toward convergence) and the suspiciously-dry guard (a high-stakes run going dry too fast with unresolved high-severity findings fires probe-or-dissent; on a single-family substrate it emits the shared-blind-spot UN-MITIGABLE stamp — it FLAGS, it does not claim to mitigate).
- **Checkpoint/resume + budget pre-flight** reuse Foreman's durable primitives via the imported surface.

Assemble the run with `assembleDeliverable({ mode:'engine', rounds, convergence, calibration, substrateFamilies, northStar })`: it carries the round history, the Judge verdict, the convergence proof, the rho-hat/learned-quorum state, and the separate Synthesizer Brief (decides:false). The engine resolves the trio's Crucible/Foreman via its in-repo siblings — no configuration; leave RP_TRIO_ROOT unset. If the import probe is NO-GO (a trio symbol was renamed), do not fork — fall back to degraded mode.

### DEGRADED prose mode (no Node)

Run a best-effort sequential audit: a reviewer pass, an independent second reviewer, a separate judge pass, repeat until no new AXIS finding. Stamp the deliverable with the engine's literal honesty stamp: "schema conforms; adversarial verification did NOT run"; force cross_model:false; the word "parity" is FORBIDDEN in any prose-mode surface.

---

## Deliverables — three summary levels (one ledger)

Build the findings + sources ledger first; render full report / executive / agent-implementation as parallel projections. In ENGINE mode each carries the round history, Judge verdict, convergence proof, calibration state, and the separate Synthesizer Brief. In DEGRADED mode those are null and the honesty stamp leads every surface. Every deliverable carries the ISOLATION and mode (engine|degraded) stamps.

Never flatter, never hallucinate a source, never count popularity as truth, never claim a mitigation the run did not perform.

## Reserved / HALT-worthy

The attested-lineage enum membership, the pre-registered thresholds (G / X% / C_min / N / K / M / T / N_min), and any change to the locked North Star / invariants are human calls — HALT for a human.
## Usage journal (sleep-loop feed — append after every REAL run)

At the end of any real (non-test) run of this skill, append ONE entry to
`journal/` in this skill folder as `NNNN-<slug>.md` (next number; APPEND-ONLY —
a correction is a new entry, never an edit). Keep it under ~15 lines, honest over
polished, with the 7 canonical fields (see the Skill Foundry's
`planning/portfolio-program/src/journal.mjs`): id, skill, situation, context,
observation, outcome (worked | friction | failed | refused), provenance
(genuine-execution | seeded — only genuine-execution corroborates).
No journal entries → the sleep loop has nothing to learn from.
