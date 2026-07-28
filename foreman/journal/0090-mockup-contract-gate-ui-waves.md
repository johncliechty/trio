# 0090 — Mockup-contract gate for UI waves: coder reads it, reviewer checklists it, MISSING = BLOCKER

- **id**: 0090-mockup-contract-gate-ui-waves
- **date**: 2026-07-26
- **run context**: Upcoming Ecgberht take-charge steward build (`C:\dev\Ecgberht\e9-e10-crucible\stage2\`, TW1–TW8; UI waves TW5–TW7 on `C:\dev\Anchor-dev`).
- **situation**: John reports **two prior Foreman builds ignored an approved mockup** and freelanced the UI; work had to be redone after the mockup was rediscovered. Failure anatomy on the Foreman side: EXECUTE agents build from plan prose and never open the mockup (large HTML, base64-heavy → scout-skipped); REVIEW agents verify the plan's paraphrased acceptance bullets, not the mockup itself; wave goes GREEN with freelanced UI.
- **STANDING RULE for Foreman runs (whenever the handoff includes a mockup/wireframe)**:
  1. **EXECUTE (coder) prompts for UI waves list the mockup contract as the FIRST required read** (`foreman.config.json` → `docs.mockup_contract`; this run: `MOCKUP-CONTRACT.md`). If no contract exists but a mockup does → HALT back to planning; do not proceed on prose.
  2. **REVIEW (adversarial) prompts require a per-element verdict**: walk the contract's element IDs, mark each SHIPPED / WAIVED(operator receipt) / MISSING. **Any MISSING, any resemblance to a named negative-example mockup, or any "reasonable reinterpretation" without a waiver receipt = BLOCKER** (not a nit).
  3. The element-checklist verdict is recorded in the wave review record; a UI wave cannot go GREEN without it.
  4. Conflict between contract and canonical mockup HTML → HTML wins + HALT for the operator; never silently pick.
- **this run's binding**: `foreman.config.json` carries `docs.mockup_contract` + `ui_wave_law`; IMPLEMENTATION-PLAN global gates carry the same law; canonical mockup `C:\dev\Ecgberht\mockups\e9-e10-wireframes.html` (v2.1), negative example `…-v1-superseded.html`.
- **provenance**: genuine-execution (operator directive, John, 2026-07-26)
