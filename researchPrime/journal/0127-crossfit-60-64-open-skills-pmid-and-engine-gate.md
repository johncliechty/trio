# 0127 — CrossFit 60–64 Open Skills Study: PMID Verification & Non-Interactive Engine Gate

- **id:** `0127-crossfit-60-64-open-skills-pmid-and-engine-gate`
- **skill:** `researchPrime`
- **Date:** 2026-10-25
- **Project:** `C:\dev\Fitness\Crossfit Prep`
- **Stakes:** Medium (designing John's 16-week November 2026 – February 2027 progression and pacing playbook across double-unders, bar/ring muscle-ups, handstand push-ups, box jump-overs, and burpees for the Men 60–64 CrossFit Open, Quarterfinals, and Semifinals)
- **situation:** Single-context `steward_code_job.py --skill researchPrime` worker (`20261025-194859-d2652e`) produced `SKILLS-RESEARCH-REPORT.md` and `SKILLS-EXECUTIVE-SUMMARY.md`, but cross-family review (`claude-fable-5-1`) blocked landing on two MAJOR findings and five MINOR findings.
- **context:** Host has Node v26.1.0 with `runImportSpike()` returning `{"go":true}`, and the v5 workout tracker (`Gym-Week-Tracker-v5-Through-Feb2027.xlsx`) on disk.
- **observation:**
  1. The worker cited two mis-mapped PMIDs from web search snippets without verifying them against Europe PMC / PubMed metadata (`PMID 27556403` instead of `PMID 27556961` for Bruce/Moull/Fischer 2017 double-under PCA; `PMID 34164132 / PMC8209869` instead of `PMID 34025867 / PMC8120962` for Mangine et al. 2021 Open pacing) and cited a non-existent 2023 jump-rope SSC review (`PMID 36508090`).
  2. The worker self-declared `"mode: degraded prose"` inside a code job worktree even though `runPlanReviewGate` (with programmatic `promptGate1`/`promptGate2` callbacks) and `bin/run-rounds.mjs` work cleanly on Node v26.1.0.
  3. Minor arithmetic/table checks caught: `Skills` tab has 65 session columns (`B` through `BN`, `18 + 15 + 16 + 16 = 65`), Open 24.3 Men 60–64 has chest-to-bar pull-ups in Part 2 (Part 1 is 10 chin-over-bar pull-ups), Walker 2023 push-phase p-values are `triceps p=0.025, biceps p=0.001`, Monday pre-class bar-hang cap must be one consistent number inclusive of warm-up hangs, and raw `<br>` tags inside Markdown tables get HTML-escaped by `ft.py reading-copy`.
- **outcome:** `friction` (caught by cross-family review before landing; repaired in follow-up job with verified PMIDs, real `runPlanReviewGate` + `run-rounds.mjs` engine execution, and clean Markdown table formatting).
- **provenance:** `genuine-execution`
