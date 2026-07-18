# 0006: Stage 2 Markdown Fallback & Revise Truncation Stall

**Date:** 2026-07-17
**Event:** Stage 2 (Implementation Plan) halted at `roundCap=5` without Judge convergence.
**Symptom:** 
- Initially, the Shark Tank loop crashed because the reviewers could not output valid JSON schemas for a 141 KB prompt (JSON fragility). 
- After applying a Markdown-first fallback to the Sharks, the parser flawlessly processed the 120+ KB prompts for all 5 rounds with 0 JSON errors.
- However, the loop still failed to converge because the `stage1:revise` model consistently truncated its output when asked to emit the full 120 KB markdown draft, returning only ~22% to 44% of the original content.

**Mechanism & Friction:**
1. The `shark-tank.mjs` JSON-fragility was successfully solved by intercepting the schema constraint when `draft.length > 20000` and instructing the model to output Markdown bullet points, which are regex-parsed into the strict internal `SHARK_SCHEMA`.
2. However, the existing EI1 markdown-first logic for `stage1:revise` demands the LLM emit the *entire* 120 KB draft in full inside markdown fences. 
3. The LLM repeatedly refused to do this, attempting instead to output a delta (a partial).
4. The newly introduced EI1 completeness guard (`REVISE_MIN_KEEP_RATIO = 0.5`) caught these truncations ("NON-COMPLIANT PARTIAL, keeping prior draft") and preserved the full plan.
5. Because the prior draft was preserved unchanged, the `revise` step became a no-op across rounds 2, 3, 4, and 5. The exact same draft was passed to the sharks, the same unaddressed blockers remained open, and the Judge correctly refused to converge.

**Resolution / Next Steps:**
- The engine safely threw a `stage2-round-cap` exception and saved the unapproved artifacts to `_unapproved-cap-draft` without data loss.
- The next step is manual review. To fully support massive Stage 2 drafts without truncation stalls, Crucible will need a more sophisticated delta/patch strategy for the `revise` step, as expecting the LLM to cleanly stream 120 KB of raw unchanged context every round is exceeding its output generation limits.
