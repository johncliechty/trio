# 0153 - `reviewPrompt` Omitted `FROZEN PLAN PATH`, Plan Line Numbers, and File-Read Permission When `changed` Was Empty on Resume
id: 0153-review-prompt-missing-plan-path-and-line-numbers-on-resume
skill: foreman
situation: When Wave 2 resumed at the gate (`skipExecute = true`, `changed = []`), `review:w2#0` (`chatgpt-cli`) halted in `21s` with `[taxonomy:ambiguity]`: *"The supplied acceptance contract is specific enough to judge implementation, but no frozen plan text or line reference was supplied, and the instruction limits inspection to the gate artifact."*
context: `C:\dev\trio\foreman\bin\wave-workflow.js` (`reviewPrompt` lines `198–245`).
observation: Unlike `executePrompt` (which supplies `FROZEN PLAN PATH: ${planPath}`), `reviewPrompt` omitted `ctx.planPath`, included `waveSection` without 1-based line numbers while demanding `answerable-from-frozen-docs: yes/no with a cited plan line`, and phrased the gate rule as `read ONLY its artifact at ${gate.artifact_path}` while omitting `(but you may read anywhere)` whenever `ctx.changed` was empty.
outcome: fixed - updated `reviewPrompt` in `C:\dev\trio\foreman\bin\wave-workflow.js` (`node --check` verified) to include `FROZEN PLAN PATH: ${ctx.planPath}`, prefix exact 1-based `L<n>:` plan line numbers onto `waveSection`, and clarify that `read ONLY the orchestrator's gate artifact` applies to test pass/fail ground truth while source, test, and frozen plan files may be read directly.
provenance: genuine-execution - Anvil v4 Foreman Wave 2 (`2026-11-17T22:49-07:00`).
