# 0012 — Phase-1 Oranges drops unvalued branches

- **id**: 0012-phase1-oranges-zero-value-branch-drop
- **skill**: researchPrime@2026-07-23
- **situation**: Phase-1 seam `runPhase1` + `persistPhase1` before human plan-gate APPROVE
- **context**: Ecgberht next-gen research; `C:\dev\Ecgberht\research\phase1-receipt.json`; branches B1–B5 as `{id,name}` only; stakes medium/reversible/moderate
- **observation**: Engine tier correctly projected **medium** and stamped foresight “value added,” but automated Oranges **dropped B1–B5** with `net value 0 ≤ 0 — drops before spend (counterfactual: unquantified)`. Human `PHASE-1-PLAN.md` carried the real foresight (defer calendar/email; no default gateway). Machine receipt and human plan diverged: receipt is not a safe sole handoff for Phase-2 without re-reading the prose plan. Sleep: require branch net-value / counterfactual fields in plan input schema, or refuse to emit drop-all receipts when all branches unquantified (honest “foresight incomplete” stamp instead of mass drop).
- **outcome**: friction
- **provenance**: genuine-execution
