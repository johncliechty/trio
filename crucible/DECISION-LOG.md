# Crucible — Decision Log (ADR index)

MADR-style. Each decision has one named Approver (DACI). Append-only; supersede, don't edit.

| # | Date | Decision | Approver | Status |
|---|---|---|---|---|
| D1 | 2026-06-04 | Placement: standalone now, mechanically merge-able into Project-Manager later (alongside Foreman). **Production-only — strip all pedagogy.** | John | Accepted |
| D2 | 2026-06-04 | Anti-drift is a central pillar: lock a North-Star Objective; tag every change; Crucible may challenge the goal only via a logged amendment the human approves. | John | Accepted |
| D3 | 2026-06-04 | Drift-guard strictness: **Tiered** — minor drift flagged + continue; MAJOR drift = HALT and ask. | John | Accepted |
| D4 | 2026-06-04 | Convergence gate: **Exhaustive, loop-until-dry, cap 5**, with six honest-guards (G1–G6) because round 4+ risks Problem Drift. Dry-round is the real stop. | John | Accepted |
| D5 | 2026-06-04 | Independence + substrate: **Pro/Claude default (like Foreman); independence via fresh/cleared context windows + role-differentiated refute prompts.** Cross-model (Gemini/ChatGPT/Grok) opt-in, gated on a reachable CLI/API key; degrade-and-stamp otherwise. Provider-agnostic judge layer. | John | Accepted |
| D6 | 2026-06-04 | Architecture: **Full Node engine, Foreman-style (a Foreman sibling).** Human touchpoints = first-class HALT-to-human gates; autonomous between gates; heavy reuse of Foreman `bin/` libs. | John | Accepted |
| D7 | 2026-06-04 | Name: **Crucible.** | John | Accepted |
| D8 | 2026-06-04 | Drift resolution = **two options**: out-of-scope → **Grasscatcher** backlog (`GRASSCATCHER.md`, with suggested future home), or refinement → **North-Star amendment** (goal sharpens). Brainstorm mode batches ideas after divergence, then summarizes + recommends. **Every sub-agent prompt embeds the current North Star** and tags new ideas refinement-vs-out-of-scope. | John | Accepted |
| D9 | 2026-06-04 | Crucible is its **own standalone skill** — NOT a Project-Manager mode (overrides round-1 shark M-2). It **reuses/imports** PM/ResearchOne/Foreman machinery but stays separate. | John | Accepted |
| D10 | 2026-06-04 | **Two-stage pipeline**, each refined via multiple Shark-Tank rounds to convergence with a **user-approval gate**: Stage 1 Master Plan (North Star + brainstorm → phased plan w/ near-term specifics → approve) → Stage 2 Implementation Plan (draft Foreman doc-trio → sharkfood → converge → approve → handoff). **User is the convergence authority** (round cap = safety ceiling only). | John | Accepted |
| D11 | 2026-06-04 | Terminology: **Shark Tank** = adversarial review round; **sharkfood it** = submit a plan to the panel; the 4 Sharks = Skeptic(Critic)/Contrarian(Devil's-Advocate)/Analyst(ResearchOne)/Closer(Judge). **dogfood** retained = using Crucible on itself. | John | Accepted |
| D12 | 2026-06-04 | Build mechanism = **autonomous Node engine, Foreman-style** (confirms D6) WITH round-1 amendments: **import-not-fork** Foreman's durability code; gate **split** into a forge-proof well-formedness check (Foreman contract resolver on the doc-trio) + a model/user **quality** judgment (no false "forge-proof quality" claim); **cross-model judge at the lock gate** when reachable; **cuts** adopted (fold standalone deep-think into the round; altitude-gate RTM/viz/SUMMARY off in v1; ResearchOne once-up-front). | John | Accepted |

| D13 | 2026-06-05 | **Open-items + round-2 refinements.** (a) **No altitude tiers in v1** — PM is the lighter path; altitude docs (RTM/viz/SUMMARY) = optional flag, default OFF. (b) Remote = **GitHub private, push at the two approval gates with OK each time** (local commits per round automatic). (c) Deep-Think = **best-available capability-bound, persistent Synthesizer/Director (= the Closer)** — Stage-0 framing + cross-round journal + **mandatory fresh-eyes anti-anchoring pass**; replaces v2's one-shot Phase-4. (d) **Stage 0 promoted to first-class** with a research-backed brownfield ingest flow (inventory/dedupe → archaeology w/ Confirmed/Inferred/Gap → AS-IS→TO-BE gap → salvage-vs-rewrite → North-Star lock). (e) **"dogfood" demoted** to a build note. | John | Accepted |

| D14 | 2026-06-05 | **Inclusion test + Oranges + round-2 right-sizing.** (a) Size rule = **North-Star service, not brevity** ("the inclusion test"): growth that serves a criterion is welcome; only non-serving bloat is cut/Grasscatched. (b) **Restore the Parable of the Oranges / PM Real-Intent ethos** into Stage-0 framing, Stage-1 brainstorming, and the Synthesizer's suggesting mandate; pull in PM's 8 critique angles (Sharks) + decomposition heuristics (Stage 2). (c) Round-2 right-sized (not gutted): **tiered** Stage 0 delegating deep archaeology to ResearchOne; Synthesizer keeps its persistent Director role but with **simplified** persistence (last-round-verbatim + direction log; compression/variance → v2); **Director ≠ decider** (decider = cross-model judge + user); **one fresh-eyes cold pass before each lock**. (d) **Add per-wave acceptance criteria** (Given/When/Then) to the handoff — justified growth (full YAML conformance stays v2, Grasscatcher #1). (e) Gate **spawns** `locate-plan.mjs` (not import); Confirmed/Inferred/Gap labels **gate**; salvage-vs-rewrite = user question; drift detection starts after lock. | John | Accepted |

| D15 | 2026-06-05 | **Degraded-mode Judge + Enhanced-mode description (v4.1).** When no cross-model judge is reachable, the model-side decider is a **same-model judge persona run as a fresh-context, context-free sub-agent** with all evidence in its prompt (never the anchored Synthesizer). §10 rewritten as **Default** (subscription-only) vs **Enhanced** (cross-model when API keys/CLIs present) modes, with per-role model stamping. | John | Accepted |

| D16 | 2026-06-05 | **Build-time open items resolved.** (a) Enhanced-mode model selection = **reasoning-strength + family-diverse** — Synthesizer takes the strongest reasoning model; Judge takes the strongest model from a *different family* than the plan's author; overridable per project. (b) Per-wave acceptance criteria = **hybrid** — a one-line *done-when* per wave + 1–3 Given/When/Then scenarios for non-trivial waves. | John | Accepted |

| D17 | 2026-06-05 | **Master Plan v4.1 APPROVED** by John (Stage-1 gate passed). Proceed to Stage 2: draft the Foreman-ready implementation doc-trio, then sharkfood it before the build. | John | Accepted |

| D18 | 2026-06-05 | **Implementation Plan v2.2 CONVERGED** — Stage-2 Shark-Tank rounds 2 & 3 both dry (two consecutive = convergence bar met); all round-1/2 buildability findings fixed; passes the well-formedness gate (11 waves). Foreman-ready; awaiting user approval to start the autonomous build. | (convergence) | Accepted |

## Shark-Tank Round 3 (2026-06-05, Master Plan) — DRY ROUND ✅
All 3 Sharks converged: no new BLOCKER/MAJOR; v4 is at convergence (Success Criterion #2 demonstrated). Two MINOR doc fixes applied (import attribution in MASTER-PLAN §11; this note).
- **Superseding note for D11:** D11 listed a 4th "Closer/Judge" Shark, but D13/D14 moved the deciding role **out of the panel** (the Synthesizer *directs*; the *decider* is the cross-model judge + the user). The Shark panel is therefore **3 Sharks** — Skeptic / Contrarian / Analyst. D11's persona names stand; its 4th panel seat is retired.

## Amendments from Shark-Tank Round 1 (2026-06-04)
- **D4 (convergence)** amended: cap-5 demoted to a *safety ceiling*; the real stop is sharkfood-until-dry **plus user approval** (D10). The six honest-guards remain but are simpler now that the user is the authority.
- **D5 (independence)** amended: add a **cross-model judge at the lock gate** when reachable (round-1 M-1 — same-model fresh-context does not fix model-correlated/sycophantic error).
- **D6 (architecture)** confirmed but amended per D12 (import-not-fork; split gate).
- See `plans/debates/round-1/SYNTHESIS.md` for the full panel verdict; parked ideas in `GRASSCATCHER.md`.

## Rationale notes
- **D4 honest-guards** exist specifically to make the user-chosen cap-5 exhaustive loop safe against the empirically-documented pass-3 drift (ResearchOne lane B). See MASTER-PLAN §4.
- **D5** reflects "more value/$ from Pro accounts right now"; cross-model is additive, never required for v1.
- **D6** reconciles "full autonomy" with planning's human-in-the-loop nature by making approvals explicit halt gates rather than interruptions to a monolithic run.
