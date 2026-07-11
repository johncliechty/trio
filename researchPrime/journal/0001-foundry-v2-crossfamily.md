---
id: 0001
skill: researchPrime
provenance: genuine-execution
---

**situation:** researchPrime-Heavy (cross-family) best-in-class research for Skill Foundry v2 — 5 branches
(extension-host, self-improving-loop safeguards, telemetry-as-byproduct, registry schema, GUI-over-real-engine),
feeding a Crucible plan.

**context:** Windows host; ENGINE mode (import probe go:true, 26 symbols). TRIO_TIER=heavy. Phase-2 = 5 parallel
web-research sub-agents (nonce-checked, laddered, ≥2-origin CORROBORATED discipline). Phase-3 = live cross-family
loop via buildLiveRoundAgent (reviewer/judge/debate=Gemini agy-p, synthesizer=Claude), launched under ConPTY.

**observation:** cross_model:TRUE attested (families [claude,gemini]). The convergence tracker stamped DRY
(dryStreak 2/2) but the Judge returned NOT_CONVERGED (2 BLOCKER + 7 MAJOR) — a **false-dry harness artifact**:
2–3 Gemini reviewers hit the same claim (C3 ×3) under different free-text `topic` slugs, each registering
agreement:1, so none crossed the ≥2-agree bar. The shared round-harness dedup keys ≥2-agree on normalized
free-text, NOT on the claim-id under attack → real multi-shark convergence reads as non-blocking + premature DRY.
The Judge (same-family, Claude) caught it; the Synthesizer diagnosed the keying bug explicitly. Adversarial pass
demoted C3/C5/C7 (CORROBORATED→CLAIMED) and split C6/C10; C11/C12 (reuse-Anchor GUI + anti-theater) survived
unattacked. Smoke test first proved the 5:1 seam fires live (PONG-GEMINI/PONG-CLAUDE, 0 popups under ConPTY).

**outcome:** worked (deliverable produced, honestly tiered) — with one real friction: the topic-keying dedup
defect in the shared round.mjs tally makes cross-family runs prone to false-dry when reviewers phrase the same
defect differently. Recommend the trio normalize reviewer findings to a canonical claim-id before ≥2-agree
counting. Also: the Judge ran same-family as the drafter (cross_model:false on the judge stamp) — only the
reviewer seat was cross-family; a fully cross-family run would route the Judge off-Claude too.
