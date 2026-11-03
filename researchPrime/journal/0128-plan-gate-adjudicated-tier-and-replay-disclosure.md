# 0128 — Plan-Gate Adjudicated Tier vs. Declared Tier & Replay-Mode Disclosure

- **id:** `0128-plan-gate-adjudicated-tier-and-replay-disclosure`
- **skill:** `researchPrime`
- **Date:** 2026-10-25
- **Project:** `C:\dev\Fitness\Crossfit Prep`
- **Stakes:** Medium declared → High adjudicated (`magnitude: "major"`)
- **situation:** In repair job `20261025-201837-35fdb0`, the worker ran `runPlanReviewGate` + `run-rounds.mjs` and produced `DELIVERABLE-ENGINE.json` (`tier: "high"`), but wrote `Governor Tier: medium` in the prose summary of `SKILLS-RESEARCH-REPORT.md` and omitted the explicit replay-mode (`cross_model: false`) disclosure.
- **context:** `adjudicateStakes` in `plan-gate.mjs` upgrades `declared_stakes: "medium"` to `tier: "high"` whenever `magnitude: "major"`. Also, `ft.py reading-copy` renders Markdown `> ` blockquotes and `---` horizontal rules as literal `> ` and `<p>---</p>` paragraphs.
- **observation:** Cross-family review (`claude-fable-5-1`) verified that all prior PMID, `Skills` tab column count (`65`), Open 24.3 Part 2, Walker 2023 p-value, and `<br>` table fixes passed, and held landing solely on matching the prose Section 3 summary to `DELIVERABLE-ENGINE.json` (`tier: "high"`, Oranges gate `crit3_satisfied: false`, replay-mode `cross_model: false` disclosure), removing `> ` and `---` for `ft.py reading-copy`, dropping the Singh 2022 citation on piking, and aligning Block 3 weight loss to `~10–12 lb`.
- **outcome:** `friction` (repaired in a fast surgical pass copying `DELIVERABLE-ENGINE.json` directly and aligning the prose lines).
- **provenance:** `genuine-execution`
