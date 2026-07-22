---
id: 0018
skill: crucible
date: 2026-07-22
project: 2D breadth scoping → literature-review Foreman plan
related:
  - foreman/journal/0045-plan-amendment-then-vacuous-green-after-clear-halt.md
---

- **situation**: Crucible Stage-2 produced a Foreman-ready IMPLEMENTATION-PLAN that made Wave 5’s done-when / GWT require **both** literature-review and researchPrime full suites green, while the plan’s single Foreman pin remained `test-command: node --test test/` (lit-review tree only).
- **context**: 2D breadth LITE Stage-2 under all-Grok seats; plan promoted into `skills/literature-review/`. Foreman then HALTed mid-build with PLAN-AMENDMENT-PROPOSAL: implementers could only paper dual-suite with presence/wiring tests inside the measured tree; orchestrator never auto-ran RP. Operator later amended plan comments and measured RP out-of-band; residual RP reds were nested trio-green (Crucible/Foreman suite pins), not breadth units — but the **contract mismatch** originated in the Stage-2 plan text.
- **observation**: Stage-2 well-formedness (as run) did **not** reject “terminal multi-suite green” claims that Foreman’s single `test-command` cannot prove. That pushes honesty load onto Foreman reviewers (plan-amendment) and operators, instead of catching the mismatch when the plan is forged. Same class of bug as any plan that asserts cross-repo / cross-skill gates without a machine-checkable measurement path.
- **outcome**: friction (downstream Foreman) — not a Crucible crash. **Foundry fix tickets:**
  - **C-WF-1:** Stage-2 well-formedness: if done-when / deliverables / GWT mention a second suite, second package, or path outside the project root, require either (a) explicit `secondary-test-commands` (or equivalent) in the plan header Foreman will honor, or (b) rewrite done-when to “wiring + primary suite green” with honesty note — never silent dual-green.
  - **C-WF-2:** Shark/Judge checklist item: “Can Foreman’s single measured gate prove every green claim in this wave?” Fail closed if no.
  - Coordinate with Foreman **F-DS-1** (multi-suite gate) so Stage-2 can emit the richer contract when the engine supports it.
- **provenance**: genuine-execution
- **artifacts**: `planning/2d-breadth-scoping-2026-07-21/`, literature-review `IMPLEMENTATION-PLAN.md` Wave 5, Foreman journal 0045
