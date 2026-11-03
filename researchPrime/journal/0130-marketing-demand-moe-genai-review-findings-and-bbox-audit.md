# 0130 — Cross-Family Review Findings on `marketing-demand-moe-genai-v1` & `recover` Finish-Only Semantics

- **id:** `0130-marketing-demand-moe-genai-review-findings-and-bbox-audit`
- **skill:** `researchPrime`
- **Date:** 2026-11-02
- **Project:** `C:\dev\AI Club\MIT Lectures` (`marketing-demand-moe-genai-v1`)
- **Stakes:** Standard (`researchPrime` + `Gandalf` + `Superjump` + `Einstein` 5-part empirical demand synthesis & 14-slide deck)
- **situation:** On Attempt 2 of job `20261102-044119-6d8394`, the deterministic `--check` passed (`build_marketing_demand_deck.py`, `ft.py reading-copy`, `ft.py pptx-pdf-verify`), and cross-family reviewer `claude-fable-5-1` returned `verdict: "FAIL"` with 6 MAJOR and 7 MINOR findings.
- **context:** The 6 MAJOR findings were:
  1. Outline 1's micro-example claimed a log-differential decomposition of `64.8% / 20.1% / 15.1%`, whereas the stated inputs (`.40/.60` gates, `.25/.30 -> .40/.32` incidence, `.30/.50 -> .75/.60` brand, `1.5/1.0 -> 2.2/1.05` qty) yield `42.4% / 21.8% / 35.8%` (or sequential `34.2% / 29.9% / 35.9%`), because `o1_shares_split` was hard-coded rather than computed in `assert_numerical_integrity()`.
  2. `check_200dpi_bboxes()` only audited `ax.texts`, missing tick labels, axis titles, and legends (`fig.findobj(matplotlib.text.Text)`), which left y-axis category labels clipped at the left edge on slides 1, 3, 5, 9, 10, 12, and 14 and a legend overlapping `+$540/task` on slide 1.
  3. Slide 13 title and badges contained unescaped paired `$` signs (`+$60` ... `+$1,320`), causing Matplotlib mathtext to strip the `$` signs and italicize the intermediate text.
  4. Slide 3 stated `+14% to +26%` gross margin lift for Hoch/Montgomery store-level HB, whereas `REPORT.md` line 114 and Montgomery (1997) state single-digit (`3% to 10%`) gross-profit lift.
  5. Slide 1 mixed the 10%-budget column (`+$120/task`) for 1983 Homogeneous MNL with the 20%-budget column (`+$170` MNL, `+$220` CLC, `+$540` MoE) and plotted an unsourced `51.6%` FFNN EV-Tire accuracy (Table 1 has `52.6%` for `d1x4`).
  6. The Takasago `[OBSERVED]` bullet in `REPORT.md` line 354 misstated Q2 fine-tuning accuracy (which is flat `0.59 -> 0.59` in `Session 4` slide 108 and `FT_Experiment_Results.xlsx`) and Q4 base GPT-4o direction (`0%` top-two-box vs `53%` human).
- **observation:** Additionally, `steward_code_job.py recover` always executes `cj._finish(...)` (`worker_restarted: False`) on the existing worktree snapshot rather than waking the coder for a post-recovery fix loop. When a recovered attempt fails cross-family review, the steward must launch a targeted repair job rather than calling `recover` again on the unchanged snapshot.
- **outcome:** `friction` (documented all 6 MAJOR and 7 MINOR fixes for immediate surgical repair once Attempt 3's finish pass completes).
- **provenance:** `genuine-execution`
