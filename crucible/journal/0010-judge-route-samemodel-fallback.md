---
id: 0010
skill: crucible
---

- **situation**: Live cross-family Crucible Stage-1 run (Tidy-Idy GUI effort). Goal: Gemini 3.1 Pro (High) on BOTH adversarial seats (Sharks + Judge), Claude steering.
- **context**: Launcher mirrored `launch-zombie.mjs`: `const { agent, routes } = await buildLiveCrucibleAgent({ routes:{ shark/judge→gemini-cli, synth/default→claude }, drafterFamily:'claude' })` then `runMasterPlanLoop({ agent, routes, ... })`. Cross-family Gemini 3.1 Pro High / Opus 4.8.
- **observation**: Sharks ran on REAL Gemini 3.1 Pro (High) — the agy conversation transcripts show the label and the gemini-cli substitution-guard attested clean (NOT the Flash degrade). But the Judge stamped `same-model persona: claude` EVERY round. Root cause: **`buildLiveCrucibleAgent` returns `{ agent, tracker }` — NOT `routes`.** So the destructured `routes` was `undefined` → `runMasterPlanLoop` → `makeJudge({ routes: undefined })` → fell to `selectJudgeModel`'s probe path (nothing reachable) → same-model Claude Judge. `selectJudgeFromRoutes` itself is correct (gemini-cli → family gemini ≠ author claude → cross-model); it just never received routes. **`launch-zombie.mjs` has the same latent bug — its Judge was silently same-model too.**
- **outcome**: worked (fixed). Launcher: pass routes EXPLICITLY to `runMasterPlanLoop` (don't rely on the non-returned destructure). ENGINE FIX: `buildLiveCrucibleAgent` now returns `{ agent, tracker, routes }` so the documented `const { agent, routes } = …` pattern works and EVERY launcher's cross-family Judge routes correctly. Relaunched — Judge now cross-model Gemini 3.1 Pro.
- **provenance**: genuine-execution
