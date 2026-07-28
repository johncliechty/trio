# 0079 — Mockup-binding law: approved mockups must be MECHANICALLY bound into Stage-2 plans

- **id**: 0079-mockup-binding-law-approved-mockups-into-plan
- **date**: 2026-07-26
- **run**: Ecgberht take-charge steward, `C:\dev\Ecgberht\e9-e10-crucible\` (grok-driven Crucible, Stage 0–2 locked)
- **situation**: John reports this is the **third** effort where an approved mockup was at risk: in **two prior Crucible→Foreman builds, the build ignored the approved mockup entirely and freelanced UI on the fly**; the mockup had to be rediscovered and the UI rebuilt. In this run, Stage 1/2 *referenced* the wireframes ("UI binding: v2.1 only", screen→wave table) but nothing **mechanically forced** a fresh-context coder or reviewer to open them.
- **root cause**: (1) Mockups live as large HTML files (here ~56K chars, mostly base64 icon data) — fresh-context sub-agents scout-skip them and build from plan prose; (2) plan acceptance criteria *paraphrase* the mockup instead of gating on it, so a reviewer can pass a wave without ever seeing the mockup; (3) "must match the mockup" prose has no per-element verdict, so partial freelancing passes.
- **fix applied (this run)**: post-approval addendum (John-directed): `MOCKUP-CONTRACT.md` — a **small text-only element checklist** distilled from the approved mockup (per-screen element IDs + verbatim falsify quotes + negative list + waiver law), wired into IMPLEMENTATION-PLAN global gates, the Foreman handoff checklist, and `foreman.config.json` (`docs.mockup_contract` + `ui_wave_law`). Reviewer must mark every element ID SHIPPED / WAIVED(John receipt) / MISSING; MISSING = BLOCKER; conflict contract↔HTML → HTML wins + HALT.
- **STANDING RULE for future Crucible runs (adopt at Stage 2 emit)**: whenever the intake includes an approved mockup/wireframe:
  1. Stage 2 MUST emit a **mockup contract** (text-only, element IDs, verbatim falsify quotes, waiver law) alongside IMPLEMENTATION-PLAN — never rely on "match the mockup" prose or on agents reading a heavy HTML file.
  2. Every UI wave's acceptance MUST include the element-checklist verdict as a gate.
  3. The mockup path + contract path go into the Foreman handoff checklist AND foreman.config docs.
  4. Sharks should attack the plan for "mockup referenced but not enforced" as a standard finding class.
- **provenance**: genuine-execution (operator directive, John, 2026-07-26)
