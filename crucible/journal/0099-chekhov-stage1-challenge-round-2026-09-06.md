# 0099 — Chekhov (writing skill) Stage 1 Master Plan: two parks, one challenge round — 2026-09-06

**Run:** `C:\dev\Writing\planning\writing-skill-2026-09-05\crucible\` — `_stage1.mjs` (16:53–17:54, rounds 1–2) then `_stage1-challenge.mjs` (18:51–19:17, revise r3 + Shark round 3). Depth FULL, sharks 3 (grok-cli), judge grok-cli, synthesizer/revise claude. Families stamped: claude + grok.

**Outcome:** round 2 parked human-lockable with 23 single-reviewer concerns; John chose **challenge**. The challenge launcher stripped the stapled inputs binder mechanically (593 → 197 lines), collapsed the dual phase numbering to one 0–5 scheme, handed all 23 concerns to `reviseDraft` as blockers with a probing brief naming each fix (44 search/replace changes landed), then resumed `runMasterPlanLoop` with `startRound: 3, additionalRounds: 2, humanLockableAfterDry: 1`. Round 3 ran DRY (0 ≥2-agree blockers; 27 single-reviewer findings, 7 labelled BLOCKER by one voice each) → parked again at John's gate. Draft: `MASTER-PLAN-DRAFT.md` (220 lines, Phases 0–5, Round-2 resolutions kept, Round-3 resolutions table R4.1–R4.16).

**Defects / observations**
1. **Binder in `northStar` causes a stapled plan.** `_stage1.mjs` embedded NS + DECISIONS + INTAKE + Gandalf read + research v4 + preview + Jumper text as the North Star document; the drafter stapled all of it into the draft (three plans in one file, dual numbering, a dead elegance table). Fix that worked: a lean NS (framing + criteria + decisions) with inputs **by path**.
2. **The resume path works as a challenge.** `reviseDraft` + `runMasterPlanLoop({startRound, additionalRounds})` is a usable "challenge" re-entry; nothing in `runStage1` exposes it, so the launcher had to be hand-written. Worth a `--challenge` flag on stage1.
3. **Label drift.** The revise seat titled the draft "round 4" and its table "Round-3 findings resolved" while the engine counted the verification as round 3 and reported `roundsRun: 1`. Cosmetic, but John reads the title.
4. **Dedupe gap.** Two topics were raised by two Sharks each under different ids (session-start surface specified three ways: Skeptic `30-second-surface-test-times-wrong` + Contrarian `session-start-surface`; unbounded accept walk: Skeptic `accept-first-queue-surface` + Contrarian `accept-unbounded-walk`) and were not merged into a ≥2-agree blocker. The multi-Shark bar can be met by wording, not substance.
5. **Single-reviewer volume does not fall with rounds** (36 → 23 → 27 findings). Under the Elegance Law one dry round ends the loop; recommendation to John: approve, carry the two double-raised topics as Stage 2 riders.
6. Encoding: `OPEN-FINDINGS.json` is UTF-8 with an en-dash; `python json.load` on Windows needs an explicit encoding.

**Human step:** John's approve/challenge on the Master Plan; then Stage 2.
