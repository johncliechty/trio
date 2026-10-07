# 0135 — the elegance step on a landing-only code job: two unbounded agent calls after GO, unsupervised and unlabeled

**Date:** 2026-10-06
**Asked by John:** "What exactly is this job doing? What is happening with the elegance check, please review and analyze and journal about this wrt the foreman skill."
**Run under study:** Anchor code job `20261006-180229-af04a0` (steward Aladdin, Setup and Mother Ship), Foreman single wave.

## What the job is

A LANDING, not a build. Provider-integration assurance work approved under implementation plan v2 (North Star: prove with cross-family review and reproduced failures that Anchor's provider integration handles credentials, account identities and native failures safely; harden only the demonstrated paths) was finished by job `20261006-124717-187472` (gate 93/93) when PUTER crashed mid-review. Its 27 files (20 new: the assurance plan, evidence, `tests/test_provider_setup_rigor.py`, `tests/test_provider_setup_hardening.py`; 7 changed: `anchor_gui.py`, `job_runner.py`, `provider_native.py`, `provider_setup.py`, `steward_cockpit/steward_engine.py`, `.gitignore`, `foreman.config.json`) were committed to branch `steward-job-20261006-124717-187472` (`ac0a09d`). This job copies them in from a staging folder, re-proves the gate, has them reviewed, and lands them.

## Timeline (observed, `.foreman-job/foreman-run.log` + seat sessions)

| step | start → end | minutes |
|---|---|---|
| execute (ChatGPT; copy the staged files in) | 18:02:35 → 18:06:24 | 4 |
| gate (orchestrator) | 18:06:28 → 18:07:19 | 1 (93/93) |
| review (2 × Grok, parallel) | 18:07:21 → 18:20:19 | 13 (0 agreed BLOCKER/MAJOR; one reviewer hit `max turns reached` and was RESUMED by the 2026-10-06 driver fix, trio `2feb9ed`, then completed) |
| delta-coverage + CONVERGED | 18:20:21 | 0 |
| **elegance: catcher** (coding seat = ChatGPT, role `synthesizer`) | 18:20:21 → ~18:30:23 | **~10** |
| **elegance: adversary** (review seat = Grok `xhigh`, role `shark`) | 18:30:23 → still running at 18:35 | **5+** |

The elegance step — after the wave had already converged GREEN with a clean cross-family review — took longer than execute + gate + review of the landing combined.

## How the elegance step works (journal 0111; `bin/wave-workflow.js` `elegance()`, `drivers/elegance-pass.mjs`)

After CONVERGED, once per wave: the catcher runs the RC battery (ELEGANCE.md Part II) over every changed file as an "element" (tests tagged malleability), with the plan's wave section as context and provenance `records: [the frozen plan section]`; the adversary attacks the verdicts. A CUT confirmed by both becomes a `[taxonomy:rabbit-hole] REMOVE` fix iteration, then re-gate, re-review, GO. HOLDs become EXECUTION-LOG lines. A seat error is non-fatal.

## Findings

1. **"Bounded to one call each" is not bounded in time.** Each call is a full agentic seat with tools (the Grok adversary had 26 file reads/greps in its first 4 minutes; `--max-turns 40`, 20-minute driver timeout). The bound is on call COUNT, not cost. The prompts ask for a verdict over a file list, yet the seats re-investigate the code the reviewers just finished reading.
2. **The step is unsupervised and unlabeled.** execute/review/fix run under `superviseSeat` with a seat heartbeat and silence windows; `elegance()` calls `agent()` directly. The only visible line is `waiting on agent:elegance Nm` — John asked twice whether the job was stuck. Nothing says catcher vs adversary, or which family.
3. **It is mis-aimed for a landing.** The brief says "landing only, no new design or feature work"; every element is pre-approved work with a user-ratified plan. RC-1 ("independent need") is satisfied by construction; a CUT here would remove approved work the user already ruled on. The pass cannot add value proportional to its cost on this job class. (Same holds for single-wave code jobs generally — journal 0110's owed fast path.)
4. **Resume interplay (new today).** The 2026-10-06 Grok driver fix resumes a cancelled/limit-hit turn up to 2 times. An elegance adversary on Grok can therefore now run up to ~3 × the driver timeout before the step gives up. Correct for a review (a lost review is worse), but it widens finding 1.
5. **The adversary call cannot change a zero-cut outcome.** The catcher returned `27 element(s) → keep 25 · hold 2 · cut 0` at 18:30:22. `runRabbitCatcherAdversary` can only restore a CUT to HOLD or demote a KEEP to HOLD — it can never create a CUT, so with zero cuts nothing it says can trigger a fix iteration or change GO; at most it adds HOLD lines to the execution log. It still ran 8+ minutes. Cheapest fix: skip the adversary when the catcher cuts nothing (say it aloud).
6. **Adjacent defect found while studying this job (Anchor, not Foreman): code jobs land `foreman.config.json`.** `steward_cockpit/code_jobs.py` `_start_foreman` overwrites the repository's TRACKED root `foreman.config.json` with the job's `.foreman-job/` doc pointers; `_exclude_local` adds it to `info/exclude`, which does not apply to tracked files. `_finish` runs `git add -A`, so the overwrite is committed and landed. No Foreman code job had landed before today, so it never showed; this job will be the first. Anchor and Skill Foundry both track the file.

## Recommendations (John's decisions; nothing changed in Foreman by this entry)

- **R1 — skip the elegance step for landing / single-wave code jobs**, or let a code job pass `elegance: false` (the brief already declares the job class). Cheapest, matches 0110's owed fast path.
- **R2 — timebox each elegance seat** (e.g. 8 minutes; on timeout the step is already non-fatal: say it aloud, proceed).
- **R3 — supervise and label it**: run catcher/adversary under `superviseSeat`; `waiting-on` reads `elegance:catcher (chatgpt)` / `elegance:adversary (grok)`.
- **R4 — tell the seats to judge, not re-review**: the reviewers' findings and the gate are inputs; no repository re-investigation unless an element's need is unclear.
- **R5 (Anchor) — code jobs must not land their temporary `foreman.config.json`**: write the job config outside the tracked path (Foreman takes a config path), or restore the file before `_finish` commits. Until fixed: after this job lands, restore Anchor's `foreman.config.json` from the prior commit.

## Outcome

The adversary ended at ~18:39 (about 9 minutes, no change possible as finding 5 says); `=== DONE === waves=1:GO` at 18:39:13. Anchor's finish re-ran the check and landed 27 files at 18:41 (`becc567`, snapshot `refs/anchor-snapshots/20261006-184049-c0be07`). Total run 39 minutes, of which ~19 were the elegance step. Finding 6 materialised as predicted: `foreman.config.json` landed; restored by `e35f598`.

## Still owed

- John's call on R1–R5.
- Measure: elegance minutes vs total wave minutes across the next five Foreman runs (phase-timings does not record elegance today — add it with R3).
