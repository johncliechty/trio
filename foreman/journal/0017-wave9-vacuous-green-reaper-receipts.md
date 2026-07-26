---
id: 0017
skill: foreman
situation: Foreman Wave 9 encountered a vacuous-GREEN HALT because a file (`.anchor/reaper_receipts.jsonl`) was modified but not exercised by any tests.
context: The Claude agent completed the EXECUTE phase for Wave 9 and the tests passed successfully (GREEN gate). However, the orchestrator detected that `.anchor/reaper_receipts.jsonl` had been changed without being exercised by any tests, halting the run because it proved nothing about the changed file.
observation: This demonstrates the strictness of Foreman's vacuous-GREEN guard. If an agent (or side-effect of a test) modifies a file that is not explicitly covered by the test suite, the orchestrator will HALT the build, demanding that a test actually exercise the modified code.
outcome: friction -> investigating. The agent needs to write/keep a test that exercises `.anchor/reaper_receipts.jsonl` or prevent the file from being modified as a side-effect, and then resume the wave.
provenance: genuine-execution
---
