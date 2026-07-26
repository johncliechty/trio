---
skill: foreman
situation: Execute agent in Wave 1 proposed a PLAN-AMENDMENT-PROPOSAL because `node --test` recursively ran tests in the whole workspace, including `crucible-itemF-out/` artifacts, causing warnings.
observation: The agent proposed changing `test-command` to `node --test test/`, but that string fails on Windows Node v26 (MODULE_NOT_FOUND).
outcome: friction - Manually rejected the agent's exact text and applied `test-command: node --test "test/*.test.js"` to the Implementation Plan instead, and resumed with `--clear-halt`.
provenance: genuine-execution
---
