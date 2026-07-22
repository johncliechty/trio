---
id: 0045
skill: foreman
date: 2026-07-22
project: literature-review (2D breadth scoping)
related:
  - 0010-vacuous-green-resume-bug.md
  - 0043-vacuous-green-false-positive-on-redundant-rerun.md
  - 0009-plan-amendment-wave3.md
---

- **situation**: Foreman live run of literature-review 2D breadth (6 waves, all-Grok subscription seats, `git=false`, reviewers=1, cap=2) closed waves 1–4 GO with 0 fix iters, then **twice stalled wave 5** in ways that blocked project-DONE even though wave 5 deliverables and the measured suite were already green.
- **context**: Plan Wave 5 required “full lit-review suite **and** researchPrime suite green” (dual-suite). Foreman `test-command` was only `node --test test/` in the lit-review tree. Implementer added `test/dual-suite-gate.test.mjs` (presence/wiring checks; comments admit it does not re-run RP). Gate on W5 first pass: **452/452**. Reviewer issued **PLAN-AMENDMENT-PROPOSAL HALT** (correct honesty). Operator applied the proposed plan comments + recorded `.foreman/wave-5-rp-suite-gate.json` (RP `npm test` measured; residual red only nested trio-green Crucible/Foreman pins). Resume with `--resume --clear-halt` re-entered wave 5: execute no-op → gate 452/452 again → review 0 BLOCKER → **vacuous-GREEN HALT** (“wave changed no source file reachable by an executed test”). Product shipped via operator receipt; Foreman never stamped DONE.
- **observation**:
  1. **Dual-suite contract gap (plan vs gate):** Foreman has a single measured `test-command` per project. Plans that claim multi-tree / multi-suite green have no first-class orchestrator mechanism (second gate artifact required, path, fail-closed if missing). Presence-check tests paper over the claim. Reviewer plan-amendment is the only teeth today — good honesty, bad finishability.
  2. **PLAN-AMENDMENT → clear-halt → vacuous-GREEN cascade (recurrent with 0010/0043):** When execute already wrote deliverables before the amendment halt, `clear-halt` seeds resume at **gate** but the wave path still took an execute/no-op cycle under `git=false` hashStart-at-resume; `changedSince` sees no delta → vacuous-GREEN. Guard cannot credit prior same-wave execute from the same run attempt history. No sanctioned `--attest-wave-proven` after human plan apply.
  3. **Operator recovery is outside the engine:** SHIP-RECEIPT + checkpoint edit + commit is the only way to finish; that must remain honest but should not be the *only* path forever.
- **outcome**: friction — product complete (452/452, W1–4 Foreman GO, W6 no-extract); Foreman process did not reach project-DONE. **Foundry fix tickets (do not silent-patch mid-run; sleep-cycle these):**
  - **F-DS-1:** Multi-suite / multi-root gate contract — plan may declare `secondary-test-commands[]` (cwd + cmd); orchestrator runs + records each artifact; fail-closed if any red when required; presence tests cannot satisfy secondary green.
  - **F-VG-1:** After PLAN-AMENDMENT clear-halt, if prior execute of this wave already produced files exercised by green tests, **skip re-execute** or credit prior attempt delta (don’t re-snapshot hashStart *after* deliverables exist).
  - **F-AT-1:** Sanctioned `--attest-wave-proven` / operator attestation path that re-runs gate only, writes attestation record, allows GO without inventing source churn.
  - **F-DOC-1:** Document that dual-suite claims without secondary commands are plan bugs (Crucible Stage-2 well-formedness should flag — see crucible journal 0018).
- **provenance**: genuine-execution
- **run refs**: `_foreman-status.log` literature-review 2026-07-21/22; machine `journal/runs/2026-07-22T02-18-19-668Z-3840.json`, `2026-07-22T11-09-15-145Z-71987.json`; product ship `skills/literature-review/SHIP-RECEIPT.md`
