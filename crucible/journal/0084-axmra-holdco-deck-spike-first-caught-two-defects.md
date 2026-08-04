# 0084 — SPIKE-FIRST on a 2-slide deck caught two defects no amount of planning would have

- **id:** 0084
- **skill:** crucible
- **date:** 2026-07-29
- **situation:** Brownfield revision of a 2-slide investor deck (`axmra_v1.2.pptx` → v1.3) for Axmra Capital HoldCo, audience UAE ruling families + KSA + Riboscience founders. Driven inline from a Claude Code session, not via schtasks.
- **context:** Stage 0 intake framed from a written brief (`REVISION-BRIEF-v1.3.md`) covering 4 workstreams: slide-1 structure + IP mechanic, slide-2 sources/uses restructure, HoldCo naming (commissioned out to Jumper→researchPrime→Gandalf), and two deliverable variants. One BLOCKING financial ambiguity carried into the gate.
- **observation:** Complexity triage recommended and the user confirmed **SPIKE-FIRST**, and that was the correct band — building the prototype surfaced two defects that no planning depth would have found. (1) **Any text box that WRAPS ghosts in this template**: PowerPoint lays it out twice at two different widths and the duplicate survives into the exported PDF. Diagnosed only by diffing slide XML (one copy) against the PDF text layer (three copies). Fix is structural — every prose box must be a single line; multi-line copy is carried as two single-line shapes. (2) The donut's lead segment was drawn in `schemeClr tx1` ≈ `#101010` on a near-black field — the most important number on the slide was **invisible**, and had been in the shipped v1.2. Also learned: PowerPoint's PNG export serves **stale** content when re-exporting to a path used earlier in the session; ground truth is the PDF rendered independently (PyMuPDF). Two false leads cost real time before that was established.
- **outcome:** worked — both variants delivered as PPTX+PDF, verified clean, totals footing. But see friction below.
- **provenance:** genuine-execution

## Friction worth recording

**Stage 1 and Stage 2 were never run, deliberately.** After the spike the deliverable was complete and adversarially checked; running the Master Plan → Implementation Plan ceremony would have been authoring a plan for work already finished. Recorded as a judgement call, not a defect: for a bounded 2-artifact deliverable, **Stage 0 + spike was the whole useful skill**. If that is the common case for design/document work, the band profile should say so rather than leaving the operator to stop early and feel off-protocol.

**The show-the-artifact rule bit correctly.** Decisions were put one at a time with a recommendation first, and the user took the recommendation on all three (depth, consideration structure, build allocation) — but the third question surfaced that the source deck **stated one financial interpretation in prose while booking the other in its arithmetic**. That contradiction had shipped. Framing it as a user-facing decision, rather than resolving it silently, is what exposed it.

**AskUserQuestion returned rejected once** with no answers recorded; the user believed they had answered. Re-asking one question at a time resolved it. Worth knowing that a cancelled question card is indistinguishable from a declined one on the tool side — never assume an answer was captured.
