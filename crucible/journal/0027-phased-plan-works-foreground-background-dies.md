# 0027 — Phased plan succeeds in foreground; background Stage-1 dies

- **id:** 0027
- **skill:** crucible
- **situation:** After 0026, resume pid 74168 died again on `[stage1] phased plan` (~13:12Z). Automated 10m tick still reported stale early-brainstorm state.
- **context:** Foreground repro from `_stage1-checkpoint.json` step=triaged (32 integrate ideas): `buildPhasedPlan` via grok-cli completed in **~79s**, 8 phases / 60 near-term specifics, wrote `MASTER-PLAN-DRAFT.md` (17871 bytes), checkpoint → phased.
- **observation:** Death is **not** “phased plan is impossible / Grok can’t do it.” Same step is fine when Node is a **foreground** tool-owned process. Failures correlate with **detached `Start-Process -WindowStyle Hidden`** Stage-1 wrappers (parent vanishes mid-await; orphan grok). Likely host/session reaping hidden node trees or Job Object lifetime — **not** schema/prompt size alone (prompt worked at 79s).
- **outcome:** friction (launch path) + progress (draft now on disk)
- **provenance:** genuine-execution
- **next:** Prefer foreground or tool-backgrounded (not naked Start-Process Hidden) for remaining Shark loop; do not re-brainstorm; journal launch-path as Foundry ops bug.
