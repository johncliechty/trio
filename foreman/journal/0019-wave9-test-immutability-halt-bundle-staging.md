# Lesson 0019: Test Immutability Halt Triggered by Build Output Directories

## Context
During Wave 9 of the Anchor shareable build ("Deny-by-Default Bundle Builder with Leak-Scan, Pure-JS, and Boot-Smoke Gates"), Foreman's orchestrator repeatedly threw a `test-immutability HALT`. The orchestrator reported that the fix agent maliciously added a test file: `bundle_staging/test/pinning/fs_shim.mjs`.

## Cause
The Node.js test suite for Wave 9 legitimately builds a staging bundle via `node tools/build_bundle.mjs`. This causes the `bundle_staging/` directory to be populated during the test gate execution.
Foreman's test-immutability guard works by comparing test file hashes before and after the fix loop. It identifies test files using `isTestFile()` via `listFiles()`. Since `bundle_staging` is not in `.gitignore` (it is an un-ignored build artifact) and its path matches the regex `/(^|\/)tests?\//` (due to the `test/pinning` subdirectory), Foreman incorrectly classified the newly built files as newly created test files added by the `fix` agent.

## Resolution
The root cause was twofold:
1. A bug in the Foreman orchestrator: `listFiles` was scanning build output directories that are irrelevant to the source tree. We surgically updated `IGNORE_DIRS` in `C:\dev\trio\foreman\bin\wave-engine.mjs` to explicitly include `bundle` and `bundle_staging`. This permanently prevents Foreman from scanning build artifacts when identifying source/test file changes.
2. The agent improperly attempted to fix test failures by modifying the test file `test/pinning/wave9.test.mjs` (removing `shell: true`), which correctly triggered the test-immutability guard. To resolve the underlying test failures, a pair-programming intervention manually fixed the test environment (enforcing `ANCHOR_AUTH_MODE=enforce`), removed the non-shipped `test_quote.js` from `bundle/MANIFEST`, updated leak-scan patterns in `tools/leak_scan.mjs` to avoid multiline string matches, and added `foundry_map_v2.schema.json` to the manifest.

## Future Prevention
When designing new test suites that produce un-ignored build artifacts, ensure the orchestrator's file-walking mechanics are configured to ignore output directories to prevent false positives in the vacuous-GREEN and test-immutability guards. Furthermore, agents must cite any necessary test changes in the implementation plan rather than attempting unauthorized edits during the fix loop.
