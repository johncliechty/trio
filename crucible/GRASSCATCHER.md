# Crucible — Grasscatcher (idea-catcher backlog)

Out-of-scope ideas surfaced during planning, parked for future consideration. **Nothing good is dropped** — it's caught here for the user to review, revisit later, or route to another project. Refinement ideas do NOT go here; those sharpen the North Star (see `DECISION-LOG.md`).

| # | Date | Idea | Origin (phase/round/agent) | Why out-of-scope | Suggested home | Status |
|---|---|---|---|---|---|---|
| 1 | 2026-06-04 | Machine-verifiable per-wave acceptance criteria embedded in the handoff plan (Given/When/Then or YAML conformance contracts), so Foreman has an independent oracle beyond a `test-command:` label | Round-1 weakness-scan (W-05); round-2 A-2/A-5 | **PARTIALLY PROMOTED (v4/D14):** per-wave Given/When/Then acceptance criteria are now IN v1; only the full **machine-verifiable YAML conformance contracts** remain v2 | revisit-here (v2 — machine-verifiable form) | promoted (partial) |
| 2 | 2026-06-04 | Full visualization + RTM docs-as-code suite as default output (Mermaid C4/Gantt, RTM, dual-history) | Round-1 (C8, DA-7) | Traces to best-practice (lane D), not the 5 success criteria; gate on altitude tier, default off in v1 | revisit-here (v2 / altitude-gated) | parked |
| 3 | 2026-06-04 | Provider-agnostic cross-model DEBATE layer (Claude+Gemini+ChatGPT+Grok across the full roster) | Round-1 (DA-10) | Claude-only default never exercises it; defer. NOTE: a cross-model JUDGE at the lock gate may belong in v1 (see round-1 M-1) | revisit-here (v2) | parked |

## Statuses
- `parked` — captured, awaiting user review.
- `revisit-here` — reconsider for THIS project in a later round/version.
- `routed:<project>` — handed to another project's intake.
- `promoted` — graduated to a North-Star amendment (cross-ref the DECISION-LOG entry).
- `dropped` — reviewed and discarded (keep the row; record why).

## How ideas land here
During refinement, any new idea that doesn't trace to the current North-Star Objective is classified `out-of-scope` (option A of the drift fork) and appended here with provenance. In brainstorm mode, the whole batch is classified at once after divergence, and out-of-scope items are swept here in one pass.
