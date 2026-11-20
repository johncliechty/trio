# 0151 - `git: false` Resume Measures `changed` Against Invocation `hashStart`; Pre-Launch Edits Look Unchanged Without In-Seat Touch
id: 0151-git-false-resume-requires-in-seat-touch-for-hashstart-delta
skill: foreman
situation: After applying Wave 2 fixes before invoking `run-live.mjs --resume --clear-halt` (`gitCommit: false`), `execute:w2` returned immediately without editing files during the seat, causing `vacuous-GREEN HALT: the wave changed no source file reachable by an executed test`.
context: `C:\dev\trio\foreman\bin\wave-engine.mjs` (`measuredChanges` with `git === null` compares current file hashes against `hashStart` captured at the start of `runWave`).
observation: When `gitCommit: false` is configured (subdirectory skill inside a parent monorepo), Foreman has no `git diff HEAD` baseline for the wave and instead diffs post-`execute` file hashes against `hashStart` captured right before `execute` launches. Any edits made before `run-live.mjs` starts are already baked into `hashStart`, so an `execute` seat that makes zero byte changes appears to have touched `0` files unless `wave-N-proven.json` already exists.
outcome: fixed - re-invoked with `--resume --clear-halt --force --cap 8` and updated module header stamps on `scripts/anvil_v4_refactor.py`, `scripts/anvil_v4_xval.py`, and `scripts/anvil_engine.py` inside the `execute:w2` window (after `hashStart`) so `measuredChanges` records all three Wave 2 source deliverables for reachability and cross-family review.
provenance: genuine-execution - Anvil v4 Foreman Wave 2 (`2026-11-17T22:23-07:00`).
