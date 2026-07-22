---
skill: foreman
id: 0047
situation: >
  NS-01 triage-rollout smoke (2026-07-22) after Phase A anti-thrash shipped on main.
  Wave 1 EXECUTE left forwarder tests + plan gate `node --test test/`. Gate RED on
  Windows Node v26 (MODULE_NOT_FOUND / directory not treated as recursive suite).
  FIX correctly made GREEN by adding test/index.mjs + test/package.json harness, then
  engine HALTed on test-immutability (FIX must not add test files).
context: >
  Human expected Phase A (lockable rounds, effort cap, prior-attempt credit,
  PLAN-AMENDMENT re-entry) to remove this class of intervention. It did not: Phase A
  does not cover (a) frozen gate commands that are platform-broken, or (b) the
  FIX-vs-test-immutability deadlock when the only natural fix is a test-tree harness.
  Same root class as journal 0038 / 0039 (node --test test/ on Win Node 26).
observation: >
  - Gate artifact: exit 1 then (after fix) exit 0 · 16/16 pass — product truth was GREEN.
  - HALT reason was process-law (test-immutability), not failing tests.
  - Agents are not steered that bare `node --test test/` is a known-bad frozen string
    on this host; EXECUTE ships it, FIX invents an illegal harness.
  - Operator had to clear a "frozen gate" without knowing why — Friction is on us.
  - Honest human clear path used: change plan test-command to explicit files
    `node --test test/recommend.test.mjs test/vocabulary.test.mjs`, delete the
    FIX-added harness, --clear-halt + resume.
outcome: friction
provenance: genuine-execution
---

# 0047 — triage-rollout: GREEN suite, test-immutability HALT (Phase A gap)

## What failed

Not the suite (16/16 after fix). The **contract between gate string and FIX rights**:

1. Frozen plan said `node --test test/`.
2. On this host that command does not discover `*.test.mjs` (Node v26 Windows).
3. FIX did the locally correct thing (entrypoint harness) and was punished correctly
   by Wave-7 test-immutability.

## Why Phase A did not prevent this

Phase A targeted **thrash** (vacuous-GREEN credit, effort caps, human-lockable
Shark rounds, PLAN-AMENDMENT re-entry). This incident is a different failure mode:

| Mode | Phase A? | This run |
|------|----------|----------|
| Vacuous GREEN / re-prove after amend | yes | not the halt |
| Round thrash / cap | yes | n/a |
| Broken frozen gate + FIX needs test edits | **no** | **the halt** |

So the human still had to intervene. Journal as **product gap**, not operator error.

## Sleep-cycle candidates (do not patch mid-run)

1. **Crucible / locate-plan preflight:** refuse or warn plan `test-command: node --test test/`
   (and bare `test/`) on Windows when Node major ≥ 22, suggest explicit globs/files.
2. **EXECUTE prompt:** hard note — never rely on directory recursion for `node --test`;
   list files or use a plan-declared pattern; harness files are EXECUTE deliverables only.
3. **FIX prompt / judge:** if gate RED is *only* MODULE_NOT_FOUND on the test path,
   surface PLAN-AMENDMENT-PROPOSAL for the gate string instead of inventing test harness.
4. Optional: allow FIX a **narrow** exception for "add test entrypoint only when inventory
   has zero loadable tests and plan gate is a directory" — high risk; prefer (1)–(3).

## Operator action taken (this session)

Option 1 human clear: plan + package.json gate → explicit files; removed
`test/index.mjs` + `test/package.json`; clear-halt + resume wave 1.
