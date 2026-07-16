---
id: 0001
skill: foreman
situation: Initialization of a Foreman build for a Crucible-generated plan.
context: Attempted to run Foreman on the zombie-hunter project using a newly generated Crucible implementation plan and the Gemini 3.1 Pro (High) model for reviewers.
observation: Encountered two friction points on launch: 1) Crucible outputs its plans (IMPLEMENTATION-PLAN.md, foreman.config.json) into a nested planning folder, but Foreman strictly requires these files at the project root to parse the contract. 2) The backend transport CLI strictly checks exact model string names (e.g. "Gemini 3.1 Pro (High)") rather than fuzzy-matching "gemini-3.1-pro", causing a transport HALT on the reviewer invocation.
outcome: friction
provenance: genuine-execution
---

### Resolution
1. Moved the Crucible output files directly to the `C:\dev\Skill Foundry\skills\zombie-hunter` project root.
2. Updated the launch script environment variable `$env:GEMINI_MODEL="Gemini 3.1 Pro (High)"`.
3. Manually cleared the halt flag using `checkpoint.mjs clear` and re-invoked the build, allowing the engine to successfully resume and begin testing Wave 1.
