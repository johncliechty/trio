# 0002: Stage 1 Revise JSON Parsing Workaround

## Issue Summary
During the heavy validation loops in Crucible's `stage1.mjs`, the frontier LLM model repeatedly failed to parse the JSON schema during the `stage1:revise` step (the Shark Tank revision step). The failure occurred because the LLM was asked to enclose a massive, 150+ line markdown document (`draft`) inside a single JSON string property. The frontier models frequently hallucinated unescaped quotes or newlines within that massive string property, causing the driver (`driver-gemini.mjs`) to fail its `JSON.parse()` check.

As a result, the `stage1:revise` step would silently drop the revision, returning 0 changes. This led to the Shark Tank looping until it hit its 5-round safety cap and eventually halting without actually converging on a new draft.

### Stage 2 (`decomposeIntoWaves`)
The exact same failure mode appeared in Stage 2's `decomposeIntoWaves` step. The LLM was asked to generate a complex, deeply nested JSON array (defined by `WAVE_DECOMP_SCHEMA`). Large markdown strings inside properties like `intent` or `doneWhen` caused standard JSON syntax errors (such as unescaped quotes or newlines), triggering a `NotValidJsonError` which ultimately halted the entire pipeline with `HaltError: Stage-2 decomposition produced no waves`.

## Applied Workaround

### Stage 1
Instead of enforcing the `REVISE_SCHEMA` on the `agent()` invocation in `stage1.mjs`'s `reviseDraft()` function, we:
1. Removed the `schema` argument completely.
2. Updated the prompt in `revisePrompt` to instruct the model to: "Emit ONLY the revised draft enclosed in ```markdown ... ``` fences. Do NOT emit a JSON object."
3. Updated `reviseDraft` to use regex to extract the text block inside ` ```markdown ... ``` ` (or fallback to trimming the raw text).
4. Forced the `changelog` to a static notice `["(Raw markdown parsed, changelog omitted)"]` if changes were detected, because the LLM is no longer generating a structured array of changelogs.

### Stage 2
Similarly, we bypassed JSON parsing entirely in `stage2.mjs`'s `decomposeIntoWaves` step:
1. We removed the `schema` argument and stripped `WAVE_DECOMP_SCHEMA`.
2. We explicitly directed the LLM to output raw text with strict markdown headers (e.g., `## Wave: [title]`, `Intent: [intent]`).
3. We wrote a custom JS fallback parser inside `decomposeIntoWaves` that extracts `title`, `intent`, `deliverables`, `dependsOn`, `doneWhen`, and Given/When/Then scenarios using regex directly from the raw markdown output.

## Recommended Permanent Fix for Skill Foundry
To permanently address this without losing the granularity of a structured changelog:
1. Implement a true multi-part extraction pipeline in `crucible-lib.mjs` or `driver-gemini.mjs` that can handle mixed schema outputs (e.g., `<changelog>...</changelog><draft>...</draft>`).
2. Utilize XML-like tags (e.g. `<draft>...</draft>`) for long strings in prompts rather than relying on JSON string escaping for massive multi-line documents.
3. Update the `stage1.mjs` driver to parse the XML sections cleanly, preserving both the array of changelog items and the un-mangled markdown draft.
