---
skill: foreman
id: 0050
situation: >
  cf-slick revamp Wave B/G (2026-07-22). Journals 0038/0039/0047 (bad node --test test/),
  0049 under-gated DONE, 0027 Crucible background death → Foreman launch hygiene helper.
context: >
  preflightTestCommand + isBadNodeTestDirectoryCommand in foreman-lib; resolveContract
  refuses known-broken gate; soft warn when package suite larger than plan gate.
  lifecycle-launch.mjs: classifyAgentExit, spawnEngineOwned (detached:false), retry policy.
observation: >
  Unit tests gate-preflight + lifecycle-launch green. Does not remove vacuous-GREEN or
  test-immutability — prevents known false paths into FIX harness / silent DONE.
outcome: worked
provenance: genuine-execution
---

# 0050 — cf-slick: gate preflight + lifecycle launch helper

North Star: orchestrator gate, real tests dominate — strengthened by refuse-broken-gate.
