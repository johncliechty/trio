---
skill: foreman
id: 0049
situation: >
  NS-01 triage package Foreman run (2026-07-22) finished PROJECT DONE · all 6
  waves GO in ~48m after project re-home to foundry/triage. Frozen plan
  test-command remained
  `node --test test/recommend.test.mjs test/vocabulary.test.mjs` (17 tests)
  for every wave while agents added lock/stage0/foreman/rp/wave6 test files and
  package.json scripts.test expanded to the full list. Orchestrator gate never
  ran the expanded suite. Full explicit suite post-run had failing assertions
  (rp-intake governance byte-identity / match). Reviewers filed open BLOCKERs
  that gate must exercise wave deliverables; lean mid-wave panel (1 reviewer,
  ≥2-agree) did not block; terminal wave 6 panel also 0 agreed BLOCKER/MAJOR.
context: >
  Sibling of 0047 (gate string / test-immutability) and 0048 (dual-root
  vacuous-GREEN). This is the complementary failure: frozen gate stays narrow
  while deliverables and package test script grow — DONE under contract law
  without plan-level acceptance of the real suite.
observation: >
  - Status log: every wave gate 17/17 then GO; W6 full 2-reviewer panel, still 0 agree.
  - Checkpoint open_findings still list gate-must-prove-deliverables BLOCKERs.
  - package.json test script lists 7 files; plan test-command still 2 files.
  - Human clear earlier locked explicit 2-file gate for Node v26; that fix was
    not revisited when waves added more tests → permanent under-gating.
outcome: friction
provenance: genuine-execution
---

# 0049 — PROJECT DONE with stale frozen gate (17-test under-gating)

## What happened

Engine truth: **DONE**, waves 1–6 GO, ~48m, project `foundry/triage`.

Acceptance risk: **frozen gate never grew** with the wave deliverable tests.
Reviewers noticed; agreement rule + lean panel let the run advance anyway.

## Sleep-cycle candidates

1. When EXECUTE adds `*.test.mjs` under project, require PLAN-AMENDMENT or auto
   HALT if plan `test-command` does not name them (or a recursive pattern that
   actually works on this host).
2. Terminal wave: if `package.json` scripts.test ≠ plan test-command, HALT
   for human reconcile before PROJECT DONE.
3. Full-panel terminal already runs; also require ≥1 agreed finding check on
   "gate covers changed code" for terminal wave even when lean earlier.

## Operator note

Do not treat this DONE as "full suite green on all wave modules" without
running the expanded package test script and fixing failures + aligning the
plan gate.
