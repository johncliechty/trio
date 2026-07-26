---
id: 0072-b7-silent-midwave-process-death-cluster
skill: foreman@2026-07-23
situation: portfolio-b7-w4-silent-process-death-cluster
context: >
  Track B7 literature-review bands LITE Foreman resume after overnight mid-W4 death.
  Project: C:\dev\plans\2026-07-22-portfolio-world-class\B7-literature-review-bands
  Program FRICTION F036–F039. Seats grok-cli/grok-cli, reviewers=1, --resume W4.
observation: >
  Product ship-gate already GREEN (orchestrator wave-4-gate.json: 19 pass / 0 fail;
  live Skill Foundry + plan-local B7-C suite re-run 19/19 outside engine). Formal
  PROJECT DONE never stamps because run-live dies without review/CONVERGED/DONE.

  Cluster (genuine-execution, same host, same wave):
  · F036 2026-07-23 ~06:10–06:22 pid 18988 ConPTY: after wave-4 banner only; lock
    dead; zero execute/gate lines; stderr empty.
  · F037 ~06:22–06:31 pid 25428 ConPTY: execute complete + gate 19/19 GREEN then
    death before review; checkpoint stuck at wave4/execute; no wave-4-proven;
    no DONE line; stderr empty.
  · F038 ~06:31–06:41 pid 37460 ConPTY: banner-only death again (no execute line).
  · F039 ~06:42–06:51 pid 17756 direct node (no pty) + redirected stdout/stderr:
    execute complete + gate 19/19 @06:43:56 then death before review; stderr file
    length 0; still no proven/DONE. ConPTY is not the sole cause.

  Mid-write corruption observed on overnight death: plan-local
  skills/literature-review/test/b7-c*.test.mjs and package.json were zero-filled;
  resume-B execute restored them. Gate artifact remains valid after process death.

  Pattern: silent exit with empty stderr; lock file orphaned; checkpoint not
  advanced past execute even after GREEN gate; operator must --resume repeatedly.
  Prior overnight death same class (pid 60988 mid-W4 execute).
outcome: friction
provenance: genuine-execution
---

**Sleep priority P0 for Foreman** (portfolio B7 2026-07-23).

Recommended Foundry investigation (formal cycle — not mid-run freestyle):

1. **Survive gate→review handoff:** after orchestrator GREEN, process must not exit
   before review agents are spawned and checkpoint advances to review/proven.
2. **Checkpoint durability on crash:** if gate GREEN is written, resume should
   re-enter at **review** (or re-prove gate then review), not only “execute” with
   stale `intra_wave_step` that re-runs full execute when product is already green.
3. **Orphan lock + empty-stderr death:** emit a final status line + non-zero exit
   reason on uncaught rejection / child kill; never leave status=running forever.
4. **Zero-byte mid-write:** atomic write for agent-produced test files (tmp+rename)
   so crash does not null-fill ship-gate surfaces.
5. **Parent lifetime:** document safe launch (node direct vs ConPTY vs go.ps1);
   prove child tree not reaped when session shell ends.

Corroborates nothing already fixed by vacuous-GREEN family (0057/0066) — this is a
**process lifetime** cluster, orthogonal to gate semantics. Program FRICTION
F036–F039; mirror runs JSON under journal/runs/.

## Addendum 2026-07-23 ~07:02 · F040
- resume-E pid 15004 ConPTY: banner-only death again (~06:54–07:01). Cluster now F036–F040 (five deaths). Product gate still GREEN 19/19. No orphan grok/run-live children observed after death.

## Addendum 2026-07-23 ~07:12 · F041 residual closeout
- resume-F pid 17572: banner-only death (sixth). Session residual-closed B7: product GREEN 19/19+30/30, formal DONE not stamped (0074). Stopped infinite restart.

## Addendum 2026-07-23 ~07:22 · F042 Crucible corroboration
- C Legal FULL Crucible died post-Stage-1 triage (pre-draft). Cluster is host-wide nested-agent process death, not Foreman-only. See crucible **0064**.

## Addendum 2026-07-23 ~07:52 · F045 Crucible post-triage (confirmed not family-specific)
- C Legal FULL Stage-1 died post-triage under claude + direct node (empty stderr). Kill window = after Oranges triage / before draft. Cluster spans B7 Foreman W4 + C Crucible Stage-1, grok+claude, ConPTY+direct. **Highest-priority sleep ticket for trio engines.**
