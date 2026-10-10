# 0137 - Cockpit slim formal improvement (reviewed candidate)
- Date: 2026-10-10
- Situation: John authorized finishing the withheld S3/S5/S6 changes so bounded work and Foundry improvements can run through Anchor cockpits.
- Task: Correct actual-delta non-code gates, required oracle tests and production startup while preserving installed S1/S2/S4.
- Observation: Real-run entries 0135/0136 record excess review cost and gate failures; the saved final1010-trio review identifies bypasses and broken handoffs in the withheld candidate.
- Action: Formal Foundry improvement in improve/cockpit-skills-20261010, based on installed cf8f3d1; Claude adversarial plan review followed by Grok independence/elegance and focused correction checks.
- Result: Candidate corrected and independently accepted by Grok. Full Foreman suite: 272 passed. The installed driver's 20-minute limit interrupted advancing edits at 16:57Z; five files were preserved and the same native session resumed with a workload-based 45-minute allowance. Claude later exhausted its Fable quota; Codex completed preserved work, with actual author provenance retained. Grok found an ignored-delivery-directory executable bypass; expanded actual-delta snapshots and 15 regressions closed it. Not yet installed; no comparative speed claim.
- Review limit: The reviewer noted that an undeclared Git-ignored executable already present before a later invocation's snapshot is not measured as a new change. Declared executable outputs and in-wave changes are gated. This remaining retry-baseline case is not represented as covered.
- Lesson: Keep outputs, tests and review provenance tied to the actual wave; measure the user workflow before reporting readiness.
