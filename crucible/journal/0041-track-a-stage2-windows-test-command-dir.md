---
id: 0041-track-a-stage2-windows-test-command-dir
skill: crucible@2026-07-22
situation: stage2-emit-test-command-directory-glob
context: >
  Track A Stage-2 LITE emit → Foreman locate-plan on Windows Node v26, 2026-07-22
observation: >
  Stage-2 emitted IMPLEMENTATION-PLAN with test-command: node --test test/
  Foreman locate-plan HALTed: known-broken on this host (non-recursive /
  MODULE_NOT_FOUND class; foreman journals 0038/0039/0047). Session rewrote plan
  to explicit test file list before Foreman could start. Candidate Crucible fix:
  Stage-2 emit / locate-plan contract should default to explicit files or
  host-aware test-command on Windows; never emit bare test/ directory form when
  foreman preflight will hard-HALT it.
outcome: friction
provenance: genuine-execution
---

Sleep cluster: Stage-2 handoff test-command shape vs Foreman Windows preflight.
