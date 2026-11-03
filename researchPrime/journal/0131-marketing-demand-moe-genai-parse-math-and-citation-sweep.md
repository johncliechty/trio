# 0131 — Matplotlib `parse_math=False` Double-Escaping & Full-File Citation Venue Sweep

- **id:** `0131-marketing-demand-moe-genai-parse-math-and-citation-sweep`
- **skill:** `researchPrime`
- **Date:** 2026-11-02
- **Project:** `C:\dev\AI Club\MIT Lectures` (`marketing-demand-moe-genai-v1`)
- **Stakes:** Small surgical repair pass
- **situation:** In repair job `20261102-060243-665ce5`, the coder resolved the 200-DPI full-artist bbox clipping, Outline 1/2 math assertions, Slide 3 Hoch/Montgomery lift, and Takasago matrix, but cross-family reviewer `claude-fable-5-1` caught 3 MAJOR and 3 MINOR residual issues: (1) Slide 13 used both `\$` AND `parse_math=False` (rendering literal backslashes `\$`), (2) `REPORT.md` line 704 split `\nobreak` into a literal newline (`obreak`), (3) Slide 1 attributed `+$80/task` to `1983 Homog. MNL` instead of the sourced `FFNN + Demographics: +$80/task (p=.29)` Car Conjoint arm, plus uneven journal venue replacements at lines 36, 38, 199, 476, 556, 598, 643, LE cluster numbering at line 625, and Slide 9 legend vs bar patch overlap.
- **context:** In Matplotlib 3.11.1, `Text._preprocess_math` returns strings unchanged when `parse_math=False`, so `\$` is only converted to `$` when `parse_math=True`.
- **observation:** Never combine `\$` with `parse_math=False`; use plain `$` whenever `parse_math=False`. Also include `ax.patches` (bars) in legend-overlap checks and grep all occurrences of author names when correcting journal venues across a long report.
- **outcome:** `friction` (queuing surgical repair pass 2 to fix all 6 items).
- **provenance:** `genuine-execution`
