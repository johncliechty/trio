- id: 0129
- skill: foreman
- situation: Main verification launch lost the spaced project argument through the existing ConPTY wrapper
- context: Attempt55340,2026-09-09T02:28:05.389Z to02:28:08Z, intended Chekhov W7 cap0 verification; zero model calls.
- observation: Log immediately identified C:/dev/Skill, not Chekhov; missing-contract startup exit. No Chekhov gate/checkpoint/source change. Existing helper joins arguments, so quoted PowerShell arguments alone did not preserve the project path through both parsing layers. Reinvoke with project '.' and explicit Chekhov WorkingDirectory, no shared-script patch. Two generated status/heartbeat artifacts under accidental path are identified by exact path and launch creation time; retain recoverably in the cycle, no user file deletion.
- outcome: failed
- provenance: genuine-execution

Next: corrected verification wrapper18756 started02:29:34.027Z, inspect actual project and gate at startup. Status20:31 must report the failed launch and restart. Main observer21473/PID55516 remains active; no model quota, failed seat, or new approval needed. Machine companion: Chekhov/journal/runs/2026-09-09T02-28-05Z-codex-w7-source-validation.json.
