# 0099 — A user-locked KEEP is not the adversary's to HOLD; RC-8's first live run had no seat

**Date:** 2026-09-07 · **Run:** Anchor code-windows (LITE, elegance + RC-8 inside, Sharks on Grok)

## What happened

Stage 1's elegance pass kept 35 of 36 plan elements. The adversary (Grok, the shark seat) then demoted
eleven KEEPs to HOLD — among them the per-project JupyterLab manager and everything that depends on it —
with the note "until John picks (A) jupyter-serve or (B) a new lab … spend zero until (B)". But criterion
1 of the locked North Star is John's own words: "a project's own JupyterLab, managed like a preview".
That IS (B). The catcher had marked the need user-ratified; the adversary treated it as the proposer's own
record and asked the user to re-ratify what he had already locked.

Stage 2's decomposition then wrote waves that assume the lab exists (the /notebook route 302s to it;
every row links to it) while the same waves carried the HOLD text. The Grok Sharks blocked the plan on
exactly that: "Foreman has two sentences and they contradict" — obey the HOLD and John gets clickable rows
that open nothing; obey the wave text and the table forbids the build. They were right.

RC-8, the new wave-count question, did not run: `trio seat seat_unavailable: rc8-wave-count`. The
synthesizer seat died the same way at the Stage-2 judge (`synthesizer:direct:r1`), so the run force-emitted
a human-lockable draft. The Claude CLI answered a smoke minutes later; the cause of the two deaths is not on
the record (the receipt does not survive the seat error) — owed below.

## The rule (now in the driver)

A KEEP whose provenance is **user-ratified** cannot be demoted by the adversary. The user's lock is the
independent need RC-1 asks for; asking him to say it again is overhead, and the demotion breaks the plan's
coherence one stage later. The adversary's dispute is still recorded (it may be right about the design),
but the verdict stands. `runRabbitCatcherAdversary` guards it; `drivers/test/elegance-pass.test.mjs` pins it.

## The steward's read

The eight draft waves were merged to three (kernels; the lab; the route + every surface) with the decisions
written into each wave's intent: (B) ratified; one click flow (probe → 302, else an honest "starting the lab"
page that polls and navigates; jupyter missing said aloud); tailnet hosts matched by exact host or leading
label; the CLI mirror cut. Foreman is building.

## Owed

- A seat death must leave its last words on the run record (the usage-limit taxonomy does this in Foreman;
  Crucible's stage loop swallows the receipt).
- RC-8 has not yet run live; its first real record is still to come.
