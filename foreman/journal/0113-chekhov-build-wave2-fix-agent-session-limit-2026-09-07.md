# 0113 — Chekhov build: wave-2 fix agent died on the Claude session limit; resumed at the gate — 2026-09-07

**Run:** `C:\dev\Skill Foundry\skills\chekhov` (FULL, 20 waves, reviewers 2, cap 3, git off, FOREMAN_ALLOW_DIRTY_SIBLINGS=1; execute/fix pinned to claude). Wave 1 GREEN 19:59 (62 min, 29 tests, 2 fix iterations). Wave 2 gate green first try at 20:17 (37 tests, 18 min execute).

**What happened.** Wave 2 review returned "1 reviewers · 0 agreed BLOCKER/MAJOR" (one of two reviewer seats returned nothing usable) and Foreman launched fix iteration 1 on the findings. At 20:33 the fix agent died `class error-result` after 20 tool calls / 259 s: "You've hit your session limit · resets 8:50pm (America/Denver)". Foreman HALTed correctly ([taxonomy:agent-died], never "applied"), checkpoint `status=halted, current_wave=2, intra_wave_step=fix`. The same limit had killed the session's own sub-agent earlier in the day and the Crucible Stage-2 claude seat the night before (crucible 0100).

**Resume.** 20:52, after the reset: `go.ps1 -Project ... -Resume` with the env override (`--resume --clear-halt`); the engine re-enters at the gate per its own recommendation.

**Lessons**
- The Claude subscription session window is the single point of failure for every claude-seat engine on this host (Foreman execute/fix, Crucible synthesizer, Jumper sub-agents). A run that spans a window boundary WILL lose an agent; the engines halt cleanly and resume, so the cost is the dead call plus the operator's relaunch. Worth a Foreman feature: on `error-result` whose text names a reset time, sleep until the reset and auto-resume instead of halting.
- Reviewer quorum 1/2 on wave 2 — the second Grok reviewer returned nothing; Foreman proceeded to a fix pass on the single reviewer's findings. Watch for recurrence; if the second seat keeps failing, the review is single-voice and the run should say so on the wave line.
- First launch refused on dirty sibling repos (C:\dev root and the Foundry — other work); the override is the right tool when git is off for the build and the project folder is new.
