---
id: 0042
skill: foreman (git-hygiene context)
situation: A Foreman wave failed, leaving untracked build artifacts and a broken state.
context: Attempting to rapidly wipe the workspace clean to resume from a pristine state, I executed `git clean -fd` followed by `git checkout -- .`.
observation: The `git clean -fd` command unconditionally deleted all untracked files and directories. Because the Crucible plan (`IMPLEMENTATION-PLAN.md`) and the test scaffolding were created but not yet staged or committed, they were permanently deleted, resulting in total project loss and requiring complex recovery from agent transcripts and `.git/lost-found`.
outcome: failed
provenance: genuine-execution
---

### Lesson
Never run `git clean -fd` to "reset" a workspace without first explicitly verifying if there are newly generated, uncommitted files (like the Master Plan or new test scripts) that are supposed to be kept. Git is the archive, but only for things actually tracked in Git. When resetting a failed Foreman wave, only revert the specific tracked changes, or use `git clean -n` (dry run) first to see what would be destroyed.
