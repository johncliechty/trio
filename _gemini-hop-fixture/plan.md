# Implementation Plan — Gemini-host hop fixture

test-command: node --test add.test.mjs

## Wave 1 — Implement add(a, b)

Create a new file `add.mjs` in this directory that exports a function `add(a, b)`
returning the arithmetic sum `a + b`. The test file `add.test.mjs` already exists and
imports `add` from `./add.mjs`; it currently fails because `add.mjs` does not exist yet.

- **Done-when:** `add.mjs` exists and exports `add`; the gate `node --test add.test.mjs`
  passes (exit 0) with the assertions in `add.test.mjs` running green.
- **Given** the pre-existing failing `add.test.mjs`, **When** `add.mjs` is implemented to
  return `a + b`, **Then** the test passes deterministically across two runs.
