# 0007-model-string-strictness.md

date: 2026-07-16
skill: foreman
context: Launching Phase 1 of researchPrime Master Plan upgrade.

observation: The Foreman orchestrator launched successfully but halted on Wave 1 review. The backend transport `agy` threw a transport error: `invalid --model "gemini-3.1-pro"`. The CLI strictly requires the exact model name string (e.g. "Gemini 3.1 Pro (High)") and does not fuzzy-match "gemini-3.1-pro". 
workaround: Resumed the run with explicitly exported environment variables (`$env:GEMINI_MODEL='Gemini 3.1 Pro (High)'` and `$env:TRIO_MODEL='Gemini 3.1 Pro (High)'`) to strictly enforce the correct CLI-recognized model string on the reviewer node.
