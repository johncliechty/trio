# 0077 — P0 direct fixes: `$`-splice corruption closed + auto-approve launcher purge (2026-07-25, journal-hardening review)

Two P0 items from the 2026-07-25 portfolio journal-hardening review (`Skill Foundry/SKILL-PORTFOLIO-REVIEW-2026-07-25-JOURNAL-HARDENING.md`), applied as direct fixes with regression tests.

**1. `$`-splice draft corruption (journal 0013) — FIXED.** `bin/stage1.mjs` applied
search/replace patches with bare `String.replace(search, replace)`, so `` $` ``/`$'`/`$&`
in model output expanded to surrounding-document splices (the ~3-interleaved-copies
corruption). Fix: function replacement (`() => replace`) at both patch sites, plus the
0013 structural lint `detectDraftCorruption` (repeated H1 heading or leftover `<<<<`/`>>>>`
markers ⇒ revision REJECTED, prior draft kept; setext `====` underlines exempt). Tests:
`test/stage1.test.mjs` +3 (literal `$`-payload swap, splice-signature rejection, lint
unit). Also repaired one STALE pre-existing assertion (`/markdown-first/` vs the actual
whole-draft-fallback changelog message). Suite 289/0.

**2. Auto-approve launchers (North-Star you-approve bypass) — PURGED.**
`launch-zombie-stage2.mjs:52` hardcoded `approved: true` into runStage2 — pre-approving
the Stage-2 Implementation Plan — and was VENDORED into Anchor (Anchor-dev, the
Anchor-release-v1.0 repo, and all 5 share-package copies). Removed from all 8 copies
(comment left in place naming the gate). The 10 ad-hoc auto-approve launchers in
`C:/dev/plans/2026-07-22-portfolio-world-class/*/launch-crucible-{lite,full}.mjs` were
quarantined by rename to `*.DISABLED-auto-approve` so they cannot run or serve as
copy-paste templates.

Lesson: a fix that lives only in launcher copies (or a bypass that lives in one) spreads
by copy-paste — engine-side guards and vendored-copy sweeps must land together.

provenance: genuine-execution (direct-fix session, tests green)
