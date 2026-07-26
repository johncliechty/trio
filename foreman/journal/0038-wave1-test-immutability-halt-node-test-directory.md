---
skill: foreman
situation: Execute agent successfully created the `test/` directory and test file in Wave 1 as instructed, but `node --test test/` fails on Windows Node v26 with `MODULE_NOT_FOUND` because it treats the trailing slash as a module path rather than a test directory wildcard.
observation: The gate ran `node --test test/`, failed, passed the RED gate output to the Fix loop, and the Fix agent modified the test file, triggering the test-immutability HALT again.
outcome: friction - Manually replaced `node --test test/` with `node --test` in the Implementation Plan to resolve the Node test runner incompatibility, cleared checkpoint and restarted.
provenance: genuine-execution
---
