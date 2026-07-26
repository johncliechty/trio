# 0068 — Share Anchor+Skills Stage-1 wall-clock investigation (not hung)

- **id:** 0068
- **skill:** crucible
- **situation:** John asked whether Stage-1 FULL for share-anchor-skills was stuck/wasting time vs doing useful work (2026-07-23 ~11:25 MDT).
- **context:** LIVE Stage-1 under `C:\dev\plans\2026-07-share-anchor-skills\`, depth FULL, seats all `grok-cli` (`cross_model:false` from prefs). ~21 min wall elapsed at investigation.
- **observation:**
  - **Not hung.** Live process tree: `pty-launch.py` → `node launch-stage1.mjs` → active `grok.exe --prompt-file …` (child of launcher). Prompt at inspect time was **fresh-eyes synthesizer cold pass** after shark-tank r2 (~70KB prompt file, mtime = r2 shark finish).
  - **Timeline (UTC from crucible-run.log)** — real milestones, not idle:
    - 17:04:01 start FULL band
    - 17:05:27 assumption-map (28) · ~1.5m
    - 17:06:55 premortem (32) · ~1.5m
    - 17:08:47 brainstorm (75) + triage (57 integrate) · ~2m
    - 17:10:38 phased plan 7 phases · ~2m
    - 17:12:30 shark r1 DRY (45 findings) · ~2m parallel sharks
    - 17:13:34 synthesizer r1 not-lockable · ~1m
    - 17:14:16 cold pass · ~0.7m
    - 17:14:50 judge NOT_CONVERGED · ~0.5m
    - **17:14:50→17:23:27 revise r1 (~8.5m) for log line “1 change(s) [markdown-first]”** — largest single gap; real agent rewrite of full ~39KB BEST-DRAFT, not a freeze
    - 17:25:24 shark r2 DRY (46 findings) · ~2m
    - then synthesizer/cold/judge chain (in flight at investigate)
  - **Useful product signal in tank:** r2 demoted `embeds-full-master-ns-twice` (draft pastes entire North Star into Master Plan — inflates every seat prompt and confuses plan vs intent). BEST-DRAFT.md opens with full NS paste (confirmed).
  - **Same-family honesty tax:** all seats grok-cli; judge still labeled `cross-model: grok-cli` while families.cross_model=false. Dry rounds still produce 45–46 findings + not-lockable synthesizer → challenge rounds + full revise. Prior journals (0010, 0026, 0046+) already flag dry/NOT_CONVERGED thrash and same-model judge limits.
  - **Observability gap:** `_crucible-status.log` only ticks on loop heartbeats (~10m); Oranges + revise gaps look “stuck” in chat even while agent is working. No mid-call progress lines.
  - **Value density:** Oranges + first phased plan + shark findings = high. Full markdown-first revise of 39KB for one structural change = **low value-per-minute** (still not a hang).
- **outcome:** friction
- **provenance:** genuine-execution
- **improvement candidates (Foundry sleep / Crucible fix cycle — do not ad-hoc patch mid-run):**
  1. Revise path: prefer **patch/search-replace** or section-scoped rewrite when direction is small; avoid full-doc re-emit for 1-change revises (ties 0002/0006/0040 revise pain).
  2. Draft packing: **NS by reference** only (max short criteria list); ban pasting full NORTH-STAR into Master Plan body (matches r2 demotion).
  3. Heartbeat: emit status lines at **start/end of each agent call** (assumption, premortem, brainstorm, revise) not only Shark loop 10m — so wall-clock silence ≠ hang signal.
  4. Same-family FULL: document expected longer thrash; optional stricter “dry + no formal BLOCKER → faster lockable path” when cross_model:false (policy, not silent rigor drop).
  5. Prompt size: 70KB cold-pass embeds full NS + draft + transcripts — compress round transcripts for cold pass.
