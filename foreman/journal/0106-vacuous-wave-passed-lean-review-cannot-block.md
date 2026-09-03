# 0106 — a wave that built NOTHING went GREEN: stale seat preference + lean review that cannot block (2026-09-03)

- id: 0106-vacuous-wave-passed-lean-review-cannot-block
- skill: foreman@2026-09-03 (trio HEAD 03d1630)
- situation: BA 815 Wiggling Car build, resumed 12:25 with `--resume --clear-halt` under the
  08-25 engine. Wave 1 converged honestly (delta-coverage PASS via the F2-9 pre-existing-test
  rescue — the 0104/0105 fix worked as designed). Wave 2 ("Accuracy Harness") then:
  execute "complete" in 29 s with zero tool lines → gate GREEN 66/66 (the OLD suite) →
  lean review (1 of 2 reviewers) → "0 agreed BLOCKER/MAJOR" → CONVERGED → EXECUTION-LOG
  appended "Wave 2/6 GREEN" → advanced to wave 3. No accuracy.test.mjs exists on disk.
- context — two independent causes, both already named in 0100 and both still live:
  1. **Seat routing.** `~/.anchor/model_prefs.json` still carries `coding_family: chatgpt`
     from the 08-31 Codex experiment. The project's `foreman.config.json` says
     `execute: claude:claude-fable-5`, but a claude entry only sets `CLAUDE_MODEL_EXECUTE`;
     it never sets `TRIO_DRIVER_EXECUTE`, so `applyFamilyPrefsToEnv` found the slot unset
     and filled it with `chatgpt-cli`. Header: `execute=chatgpt-cli:driver-default`. Codex
     cannot run the Claude-shaped execute prompt (0100 item 5, "parked") and the engine
     logged the no-op as "execute complete" (0100 item 2).
  2. **Lean review cannot block.** The single reviewer DID find it — the checkpoint carries
     `open_findings: [{rule: "wave-not-implemented", severity: BLOCKER, file: test/accuracy.test.mjs}]`
     — but BLOCKER needs ≥2 reviewers to agree and an ordinary mid-run wave runs 1 of 2.
     A threshold of two on a panel of one is a guard that can never fire.
  3. (compounding) delta-coverage saw one changed file — `build/reports/paper.structure.json`,
     the gate's own side-effect — and the F2-9 rescue covered it. The wave's changed-set was
     otherwise EMPTY, and nothing treats "execute changed nothing" as vacuous.
- observation: three guards each did their narrow job and the wave still lied. The signal
  that was available and unused: an execute phase with zero tool calls and zero writes
  against a wave whose deliverables list names files that do not exist afterwards.
- steward action (project side, no engine edit): run killed (pid 9472); today's vacuous
  wave-2 gate/delta/proven files moved to `.foreman/_vacuous-codex-2026-09-03/`; the
  08-17 lecture-build wave-3..6 files (a DIFFERENT plan's proven ledger, sitting in the
  same `.foreman/`) moved to `.foreman/_lecture-build-2026-08-17/`; checkpoint reset to
  wave 2 / execute / budget_stopped; the false "Wave 2/6 GREEN" line removed from
  EXECUTION-LOG.md; a project launcher `planning/crucible-wiggling-car/_run-car.ps1`
  pins TRIO_DRIVER_{EXECUTE,FIX,REVIEW}=claude in the process env, which config cannot
  override and the preference cannot fill.
- engine fixes owed (mechanisms, not instructions — Elegance rule 8):
  E1. A wave whose deliverables name files that do not exist after execute is
      `wave-not-implemented` at the ORCHESTRATOR (deterministic), not a reviewer opinion —
      HALT before the gate runs. Cheapest version: execute phase with 0 tool calls ⇒ HALT.
  E2. On a lean (1-reviewer) round, a single BLOCKER must either block or escalate to the
      full panel; "0 of 1 agreed" is not a verdict.
  E3. Config `claude:` entries must ALSO set `TRIO_DRIVER_<ROLE>=claude` so a family
      preference can never re-seat a role the project pinned (0100 L3: one routing
      source, logged winner).
  E4. `.foreman/` per-wave files should carry the plan hash; a proven.json from another
      plan is refused, as a foreign checkpoint already is (0093).
- outcome: friction (≈8 minutes of engine time and one review call spent on nothing;
  caught by the steward reading the routing header, not by the engine).
- provenance: genuine-execution; status/output logs and the checkpoint on disk in the
  project; no model call for this entry.
