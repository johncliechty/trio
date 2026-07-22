# 0019 — Phase A: human-lockable exit + effort-scoped round cap (2026-07-22)

**Why (journals):** 0007–0012, 0011 double-cap on resume — Shark Tank dry with zero ≥2-agree
BLOCKERs, yet Judge/fresh-eyes held through a full 5-round cap (~30 model calls) and resume
with `startRound=6, roundCap=5` opened **another** full cap.

**North Star check (must not violate):**

| Pillar | Preserved? |
|--------|------------|
| User = convergence authority | **Yes** — human-lockable never auto-locks; still requires `approveMasterPlan({approved:true})` |
| ≥2-agree BLOCKER bar | **Yes** — multi-Shark blockers still force revision loops; only *absence* of them enables the path |
| Independent Sharks | **Yes** — no seat removed |
| Judge / fresh-eyes | **Yes** — still run every dry round; we stop *burning further rounds* after streak, not skip them |
| LITE never silent | **Yes** — no depth downgrade |

**What changed (`bin/stage1.mjs`):**

1. `resolveLoopBounds` — effort-scoped: remaining = roundCap − (startRound−1). Resume cannot silently buy another 5. Explicit `additionalRounds=N` to extend.
2. `assessHumanLockable` — dry + no multi-agree BLOCKER/MAJOR → eligible for streak.
3. After **2** consecutive dry holds (configurable `humanLockableAfterDry`), HALT with `stage1-human-lockable`, BEST-DRAFT + OPEN-FINDINGS + HUMAN-LOCKABLE.json. Never auto-lock.
4. `approveMasterPlan` accepts `loop.humanLockable` when user explicitly approves.

**Tests:** `test/phase-a-efficiency.test.mjs` (9 pass).

**Anti-arguments (self shark):**

- *“This weakens the Judge.”* No — Judge still decides model-side lock. We stop **repeating** dry holds after the multi-Shark bar is already met.
- *“Two rounds is too aggressive.”* Tunable; 2 matches journal pattern (often 5 identical holds). User can re-run with `additionalRounds`.
- *“Effort cap breaks intentional long stages.”* Pass `additionalRounds` or raise `roundCap` on the **first** invoke so already counts correctly.

**Outcome:** engine change ready for collaborator ship + triage stream.
