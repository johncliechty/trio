# 0104 - SOLVED 0103: delta-coverage counts the GATE'S OWN side-effects as wave surface changes

- id: 0104-delta-coverage-counts-gate-side-effects-0103-solved
- skill: foreman@2026-08-27
- situation: Wiggling-car build (BA815), wave 1 - delta-coverage HALTed twice
  on 18 build/reports/* files no wave touched; the same class that re-flagged
  three remedies in the overnight lecture build (0103, cause then unknown).
- context: project "BA 815/Fall 2026", git=false path, changedSince() vs the
  engine-start hash snapshot.
- observation: THE MECHANISM, proven empirically: the wave's gate command
  (node scripts/run-all-tests.mjs) itself REGENERATES the deck-gate reports
  (gate.py stages write <deck>.gate.json/md with a fresh generated_at) - so
  every gate run mutates ~18 files AFTER the engine-start snapshot, and
  wave-engine computes `changed` (line ~1282) POST-GATE, feeding the gate's
  own side-effects into checkDeltaCoverage as "persistence surfaces with no
  naming test." On a RESUME the effect is total: the wave's real deliverables
  are already in the start snapshot, so the changed-set is side-effect churn
  ONLY and testMentions is empty. 0103's "session-side remedies cannot reach
  it" follows exactly - a remedy test added before relaunch is in the start
  snapshot, hence never in the changed set, hence never read for mentions.
  Project-side mitigation landed (real improvement): report writers now go
  through util_io.atomic_write_*_stable (skip when only timestamps differ),
  cutting steady-state churn 18 -> 1. The irreducible file is
  build/reports/paper.structure.json - the rerun-proof REQUIRES its
  execution timestamps to differ every run (freshness IS the assertion), so
  it cannot be stabilized without gutting the proof.
- engine fix owed (one line in spirit): compute the delta-coverage/vacuous
  changed-set from the PRE-GATE snapshot (changedPre already exists at line
  ~1226) instead of post-gate, so a gate command's own outputs never count as
  wave surface changes. Gate teeth unchanged: wave surfaces are what
  EXECUTE/FIX wrote, and those are pre-gate by definition.
- outcome: friction (build parked at wave 1 pending John's call on the
  engine fix; repeat-rule honored - no third blind clear)
- provenance: genuine-execution
