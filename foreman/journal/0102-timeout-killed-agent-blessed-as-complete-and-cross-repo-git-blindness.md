---
id: 0102-timeout-killed-agent-blessed-as-complete-and-cross-repo-git-blindness
skill: foreman@2026-08-13
situation: >
  A per-call-timeout SIGKILL of the execute agent — 20 minutes, 60 tool calls, ZERO
  bytes written — was logged `execute: agent execute complete` and auto-advanced to the
  gate. The gate would have returned GREEN (it re-proves the tree, and the PREVIOUS
  wave's tree is green), committing an empty wave as done. Caught by a human relay
  five minutes into that gate, not by any guard.
context: >
  Anchor steward-e1 build (C:\dev\Anchor, branch foreman/steward-e1), wave 2 of 2 —
  "Turn-completion hook + joint negative-path test + the drawn blocked-turn state".
  Heavy tier, Fable 5 on execute/fix, GROK on review/judge. This build existed
  BECAUSE the previous 12-wave build shipped a criterion (E1) whose four instruments
  were all absent while every wave reported GREEN — so shipping a second empty wave
  would have reproduced, inside the remediation, the exact defect being remediated.
observation: >
  THE FAILURE, precisely. `execute:w2 done — class timeout-killed, code SIGKILL,
  ok false, 60 tools, out nulltok, 1200050ms`. Both trees clean afterward: nothing
  written. Foreman's next log line was `execute: agent execute complete`, then
  `waiting on agent:gate 0m`. The orchestrator treated a killed agent as a finished
  step.

  WHY THE EXISTING GUARD MISSED IT. Journal 0082 (W12, usage-limit killed every
  sub-agent AT LAUNCH) produced the rule "an ok:false / 0-tools / <2s agent result
  must become a loud agent-launch-failure halt". That guard is shaped around
  LAUNCH death: zero tools, sub-second duration. This agent ran 20 minutes and made
  60 tool calls before dying. It sailed straight through. The 0082 lesson was
  encoded too narrowly — the discriminating field is `ok:false`, FULL STOP. Tool
  count and duration are corroborating detail, never the predicate.

  WHY THE GATE CANNOT CATCH IT. This is the structural half. Foreman's ground-truth
  gate re-proves the WHOLE tree, so after a no-op wave it re-proves the previous
  wave's already-green tree and returns GREEN honestly. A whole-tree gate is
  blind by construction to "this wave added nothing" — the vacuous-GREEN guard
  (wave's new source has no test naming it) also cannot fire, because there IS no
  new source. An empty wave is invisible to every downstream check. The ONLY
  place it is visible is the agent result itself.

  ROOT CAUSE OF THE KILL. `--call-timeout-min` defaults to 20 in run-live.mjs, and
  `bin/go.ps1` does not expose or pass it. Wave 2 spanned TWO repos (Anchor +
  the Ecgberht sibling carrying the converse seam): it had to read both trees
  before writing a line. Attempt 2, with 45 minutes, spent 28 minutes orienting
  and finished clean in 43 — MORE THAN DOUBLE the default. This was never a
  marginal overrun. Every attempt would have died at 20 minutes, each one handing
  back a blessable "complete", indefinitely. Chamber W11 burned two windows on
  the identical shape (same fix: --call-timeout-min 45).

  THE SECOND DEFECT — CROSS-REPO GIT BLINDNESS. Foreman's git handling is scoped
  to the launch project. Wave 2 legitimately wrote to the Ecgberht sibling
  (engine/steward-conversation.mjs, scripts/seal-chamber-bridge.mjs, and a new
  test/e1-turn-completion.test.mjs). Foreman committed the Anchor side and
  reported the wave GREEN with the sibling left DIRTY and nothing complaining.
  The wave's own gate passed because the gate reads the working tree, not the
  index. Had the human not noticed before tagging, the release would have shipped
  an enforcement hook whose engine half existed only on one disk. A wave that
  writes outside its repo currently has NO commit guarantee and NO warning.
lesson: >
  (1) `ok:false` IS THE PREDICATE. Any agent result that is not ok — killed,
  timed out, transport-failed, refused — must raise a named halt and must NEVER
  advance the intra-wave step. Do not qualify it with tool counts or elapsed
  time; 0082 qualified it and 0102 walked through the qualification.

  (2) NO-OP DETECTION MUST BE ITS OWN CHECK, INDEPENDENT OF THE AGENT RESULT.
  Diff the tree before and after execute. Zero changed files = the wave produced
  nothing = halt, whatever the agent claimed. This catches the honest-but-empty
  case too (an agent that returns ok:true having written nothing), which the
  ok:false rule alone does not. Cheap: Foreman already shells git for its own
  commits.

  (3) HUNG-AGENT HANDLING NEEDS A LIVENESS PROBE, NOT JUST A DEADLINE. Today the
  only instrument is a wall-clock guillotine that cannot tell "deep in legitimate
  work" from "wedged". It kills both and reports them identically. What
  distinguishes them is already in the stream: TOOL-CALL PROGRESS. An agent
  making calls is alive; an agent silent for N minutes is hung. Proposal —
  (a) track last-tool-call timestamp per agent; (b) STALL timeout (no tool call
  for ~5m) = hung → kill and halt as `agent-stalled`, a real failure; (c) the
  wall-clock deadline becomes a soft budget that, when the agent is demonstrably
  ALIVE, extends once with a logged warning rather than killing productive work;
  (d) either way the result is ok:false and rule (1) applies. A killed agent must
  never be silently equivalent to a finished one, and a WORKING agent must never
  be killed for being slow when the real signal — is it still making calls — is
  sitting unread in the status stream.

  (4) SCALE THE DEFAULT TO THE WAVE, AND EXPOSE THE KNOB. 20 minutes is a
  single-repo default. A cross-repo or large-survey wave needs 45+. At minimum
  go.ps1 must pass `--call-timeout-min` through; better, derive a floor from the
  plan (multi-repo wave ⇒ ≥45m) so the operator is not required to know.

  (5) A WAVE THAT WRITES OUTSIDE ITS REPO MUST DECLARE AND COMMIT IT. Detect
  writes in sibling repos (the plan already names them as normative inputs);
  either commit them with the wave or HALT naming the dirty sibling. Reporting
  GREEN over an uncommitted sibling is a false completion — the same class of
  lie as the empty wave, one directory over.
outcome: >
  Caught by the relay, not the machine. Engine killed mid-gate, `.foreman/run.lock`
  cleared, checkpoint intact at wave 2 / execute / iter 0 (it had not stamped), and
  run-live.mjs relaunched DIRECTLY — bypassing go.ps1 — with --call-timeout-min 45.
  Attempt 2 closed `ok true, code 0, 139 tools, 43m`, gate GREEN on iter 0 with the
  test counts GROWING (engine 1135→1146, pytest 3173→3197 — the counter-proof an
  empty wave cannot produce), Grok review 0 blockers. The sibling repo was committed
  by hand before the tag (Ecgberht 4c08056). Shipped as Anchor v1.2.2.
  NONE OF THE FIVE FIXES ABOVE ARE IMPLEMENTED — this entry is the record, not the
  remedy. (1) and (2) are the cheap high-value pair; (3) is the design worth doing
  properly.
provenance: genuine-execution
---

# 0102 — a killed agent blessed as complete, and a wave that wrote where Foreman wasn't looking

Two distinct false-completion defects, found in one wave, in a build whose entire
purpose was remediating an earlier false completion.

The first: an execute agent SIGKILLed at the 20-minute per-call default, having
written nothing, logged as `execute complete` and advanced to a gate that would
have certified the empty wave GREEN — because a whole-tree gate re-proving the
PREVIOUS wave's green tree returns green honestly. Nothing downstream can see an
empty wave. The 0082 guard missed it because 0082 encoded the lesson as
"0 tools / sub-2s / ok:false" when the load-bearing term was always `ok:false`.

The second: the wave legitimately wrote into a sibling repo, Foreman committed
only its own, and reported GREEN over a dirty sibling. The release would have
shipped a hook whose engine half was never committed.

The through-line: **Foreman treats "the agent returned" as "the step happened."**
It does not ask whether the agent succeeded, whether anything changed, or whether
what changed was captured. Three separate questions, none of them asked.

And on hangs specifically — the current design has one instrument, a wall-clock
deadline, which cannot distinguish a wedged agent from a productive one and kills
both with the same message. The signal that separates them is already in the
status stream, unread: an agent still making tool calls is alive. Stall-detection
should be the kill criterion; wall-clock should be a budget that bends for an
agent demonstrably working.
