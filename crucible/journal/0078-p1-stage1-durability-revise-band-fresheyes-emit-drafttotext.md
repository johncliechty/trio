# 0078 — P1: Stage-1 lifetime guards, revise-by-band, accountable fresh-eyes veto, 0069 emit-and-return, engine draftToText, honest substrate stamp (2026-07-25)

The Crucible P1 batch from the 2026-07-25 journal-hardening review, direct fixes:

1. **Stage-1 durability (the 9-death cluster: 0020-0027, 0064-0066, 0075).**
   `runStage1` now installs `installProcessLifetimeGuards` (last-crash.json +
   heartbeat.json + HALT.json via new `writeStage1HaltJson`), wraps EVERY agent-call
   boundary in `withPhaseProgress` (oranges-brainstorm / phased-plan / shark-loop —
   0066's death was pre-assumption-map, earlier than the single 0065 stamp), and the
   loop persists BEST-DRAFT.md + a round marker at every round start — a mid-loop
   death now loses at most one round. SKILL.md's launch section replaced: the
   background-Bash prescription (the launch path all 9 deaths shared) is superseded
   by the 0067-proven Windows Scheduled-Task breakaway, with the honest note that
   in-process guards cannot catch a job-object SIGKILL.
2. **Revise path by band/family/delta (0040's verbatim ask; 0043/0053/0056/0058/0060/
   0070-e1/0075-e4/0076-e4).** LITE (always under the 20KB byte threshold → always the
   fragile schema-JSON path → paid 0-change rounds), grok seats, and rounds with <=2
   blocking findings now take the markdown/search-replace path at any size (0068's
   8.5-minute full re-emit for "1 change(s)"). FULL+multi-finding+small stays
   schema-first. Pinned in stage1 tests.
3. **Fresh-eyes BLOCKER accountability (0011 item 4 — the 0046/0049/0052/0055/0060
   cap-burn mechanism).** A single cold-pass persona's BLOCKER now holds the lock only
   when it names the North-Star criterion it blocks (`criterion`, new schema field) or
   is topic-corroborated by a non-demoted Shark finding; otherwise it is recorded
   loudly as advisory. Shark ≥2-agree, the Judge, and the user gate untouched.
4. **`approved:true` emit-and-return (0069).** A human-lockable / round-cap HALT under
   `approved: true` now emits the best draft as the handoff on the REAL outputDir
   (writeDocTrio + the machine well-formedness gate, which still fails closed) instead
   of re-tanking and throwing without docs; `approveImplementationPlan` accepts a
   human-lockable loop WITH explicit approval (the human-lockable design: the user is
   the convergence authority), stamped `humanLockable: true` in the approval record.
   Retires the out-of-tree force-emit-handoff.mjs. e2e test runs through the REAL gate.
5. **`draftToText` + `assertPlanText` into crucible-lib (0063 P0 C-B).** The canonical
   serializer (handles the `best_draft` object shape) + a corrupt/short refusal now
   live in the ENGINE; `writeDocTrio` routes all three docs through them — the engine
   can never write `[object Object]` or a stub plan. The 8 launcher-local copies are
   now redundant consumers.
6. **Honest substrate stamp (0070-e1 item 3).** The status table's hardcoded
   "(agy 5:1)" literal is replaced by a per-seat stamp derived from the live routes
   (`sharks∥(grok) + judge(grok) + synthesizer(claude)` etc.).

Suite: 292/0 (was 289; +4 new pins, 1 test updated to the new fresh-eyes contract).

provenance: genuine-execution (direct-fix session, tests green)
