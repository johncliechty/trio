# 0107 — test-immutability HALT with no fix agent: the post-execute baseline raced the executor's last write (2026-09-03)

- id: 0107-immutability-halt-false-positive-baseline-race
- skill: foreman@2026-09-03 (trio HEAD 03d1630)
- situation: BA 815 Wiggling Car, wave 6 (release stamp + USER-GATE HALT). Execute ended
  13:56:36 with its final action the plan-authorized release stamp (wave-6 deliverable line:
  "test/stamp.mjs ... updates MANIFEST.json with the release checksum"). Gate 13:56:37-13:57:04:
  106/106 GREEN. Then: `test-immutability HALT: fix agent modified test file test/MANIFEST.json`
  — at iteration 0, with NO fix agent having run. Run stopped one step short of the user gate.
- observation (measured, not inferred): test/MANIFEST.json and wiggling-car.html both carry
  mtime 13:56:36 — the same second `execute:w6 done` was logged. The release test is
  idempotent: running `node test/release.test.mjs` by hand left the manifest hash and the
  release hash byte-identical (c5ddb4d5… / b38848c8…). So the gate did not touch the manifest.
  The only writer after the baseline was the executor's own atomic write (temp+fsync+rename)
  landing in the same second `testHashSnapshot` ran post-execute (wave-engine ~1193). The
  guard then compared post-gate disk to a pre-rename baseline and blamed a phase that did not
  exist.
- two defects: (a) the baseline is taken before the executor's process tree has fully quiesced
  (the agent's final write can land after "done"); (b) the halt text asserts "fix agent
  modified" unconditionally — at iteration 0 with no fix call, that sentence is false, and a
  false sentence in a HALT costs the operator a forensic round (this one cost ~15 minutes and
  a manual idempotence proof).
- steward action: checkpoint set to wave 6 / review / budget_stopped (gate had been GREEN; the
  resume re-proves it anyway); relaunched through the project launcher; gate re-proved
  106/106 at 14:01:34; full two-reviewer panel now running toward the USER-GATE HALT. Note for
  operators: a checkpoint written by PowerShell `Set-Content -Encoding utf8` carries a BOM and
  the engine refuses it as torn — write checkpoints with node.
- engine fixes owed: E5 take the immutability baseline only after the execute child has exited
  AND re-hash any test file whose mtime is within the execute window's last second (or simply
  snapshot after a short settle); E6 when iteration is 0 and no fix agent ran, the guard must
  say "changed between execute and gate" and name the likely writer (the gate's own scripts or
  the executor's trailing write), never "fix agent"; E7 a plan-authorized test writer named in
  the wave's deliverables (stamp.mjs → MANIFEST.json) should be an allow-listed path for that
  wave, so the guard does not need a model-supplied citation to let it through.
- outcome: friction (no work lost; one false HALT, one BOM refusal, both operator-cleared).
- provenance: genuine-execution; hashes, mtimes and status log on disk in the project.
