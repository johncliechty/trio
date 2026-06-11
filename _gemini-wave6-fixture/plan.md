# Implementation Plan — Gemini-host lit-review deliverable (Wave 6)

test-command: node --test review-gate.test.mjs

## Wave 1 — Produce a PRISMA-structured literature-review deliverable

Create a new file `review.md` in this directory: a short literature-review document on a
topic of your choice (e.g. mindfulness-based stress reduction for chronic low back pain).
It MUST contain these five Markdown section headings (each written as a `#` or `##`
heading whose text contains the exact phrase), because the gate validates them via the
`literature-review` pack's Layer-1 doc-contract:

  - `Methods`
  - `Search Strategy`
  - `PRISMA Flow`
  - `Results`
  - `Discussion`

Write 1-3 sentences of plausible content under each heading. The test file
`review-gate.test.mjs` already exists; it loads the `literature-review` pack and asserts
the document passes the Layer-1 contract (all five required sections present).

- **Done-when:** `review.md` exists with all five required section headings; the gate
  `node --test review-gate.test.mjs` passes (exit 0), deterministically across two runs.
- **Given** the failing gate (review.md absent), **When** `review.md` is created with the
  five required sections, **Then** the literature-review pack's Layer-1 contract validates
  it and the gate passes.
