---
skill: foreman
id: 0048
situation: >
  NS-01 triage-rollout smoke (2026-07-22). Plan + gate lived under
  C:\dev\plans\2026-07-22-triage-rollout\ while the real deliverable
  (@foundry/triage core.mjs, package tests) lived under
  C:\dev\Skill Foundry\foundry\triage\. Foreman projectDir was the plans
  "control plane". Wave 1 suite went GREEN (forwarder tests imported the pin);
  reviewers ran; then vacuous-GREEN HALT — no in-project source change reachable
  by tests, no prior-attempt ledger (never had a GO). Human re-homed projectDir
  to the real package (docs still via foreman.config.json absolute paths).
context: >
  Same smoke day as journal 0047 (test-immutability / node --test test/). Phase A
  prior-attempt credit (0046) only helps after a proven same-wave GO ledger —
  it does not help a first-pass dual-root layout. Plan text had suggested
  "control plane + pin path" without locking Foreman cwd to the package that owns
  the code. Operator friction: look like a green wave, then a HALT that sounds
  like "you didn't write code" when code was written outside the hash root.
observation: >
  - listFiles / changedSince / reachableFromTests are all projectDir-scoped.
  - Outside-tree edits (Skill Foundry, trio) are invisible to vacuous-GREEN.
  - Control-plane forwarder tests (import pin suite) prove the pin at runtime
    but do not put pin paths in the wave hash-diff → systematic false vacuous.
  - git.enabled=false made this worse (no monorepo HEAD diff either).
  - Re-home to foundry/triage + stamp deliverable + explicit gate files unblocked
    wave 1 without an engine patch.
  - Path with space ("Skill Foundry") also broke naive argv launch (project
    truncated to C:\dev\Skill) — operator tooling bug, separate note.
  - Trio skills (foreman/crucible/researchPrime) were NOT moved; only the build
    target cwd for this effort changed. Waves 3–5 will edit trio in place as
    call sites — those waves will re-hit outside-tree vacuous unless projectDir
    or git boundary covers the trees being changed.
outcome: friction
provenance: genuine-execution
---

# 0048 — Dual-root "control plane" project → vacuous-GREEN (layout bug)

## What failed

Not the suite and not (this time) test-immutability. **Contract mismatch:**

| Layer | Path |
|-------|------|
| Foreman `projectDir` (hash root) | `plans/2026-07-22-triage-rollout/` |
| Real package / deliverable | `Skill Foundry/foundry/triage/` |
| Frozen docs | plans folder (fine) |

Gate GREEN via forwarders; vacuous-GREEN correctly refused GO under current law
because **this wave's in-project changed code set was empty / not exercised**.

## Why it is a product/engine gap (not operator confusion)

1. **Crucible / plan emit** allowed a Foreman-ready plan that implies dual homes
   (docs+gate in plans, code at a pin) without a single rule: *projectDir MUST be
   the tree that owns the wave's source deliverables.*
2. **Foreman** has no preflight: "gate command imports or exercises files outside
   projectDir" → warn or HALT-for-human *before* burn execute/review seats.
3. **Phase A ledger** does not cover first-pass dual-root (no prior GO to credit).
4. **Waves 3–5** (wire Crucible/Foreman/RP under trio) will hit the same class if
   projectDir stays only `foundry/triage` while edits land in `trio/`.

This is the same *family* as other vacuous false-positives (0010, 0015, 0043,
0045) but the root cause here is **layout**, not resume empty-diff alone.

## Sleep-cycle candidates (do not patch mid-run)

1. **Contract preflight (locate-plan / run-live):** if `test-command` or execute
   prompt paths resolve outside `projectDir`, HALT with plain-English:
   "project root must own the code under test, or enable a declared multi-root."
2. **Crucible Stage-2 / handoff:** refuse doc-trio where suggested project root
   ≠ package that contains `test-command` entrypoints; emit one root only.
3. **Optional multi-root config** (harder, North-Star careful):
   `foreman.config.json` `watchRoots: []` hashed into changedSince — only if
   containment and anti-scope rules stay honest.
4. **EXECUTE prompt:** ban "control plane forwarder only" as the sole gate for a
   wave whose deliverable is an external pin; either work in the pin or copy
   deliverable into projectDir.
5. **Operator launch:** document quoting for project paths with spaces
   (`Skill Foundry`); Start-Process argv splitting created `C:\dev\Skill` noise.

## Operator action taken (this session)

- Did **not** move trio Foreman/Crucible/researchPrime packages.
- Set Foreman projectDir to `C:\dev\Skill Foundry\foundry\triage\`.
- Kept plans as docs via `foreman.config.json` `docs` absolute paths.
- Added plan stamp `NS01_WAVE1_STAMP` so execute must edit in-root code.
- Journal 0047 remains the sibling gate/test-immutability incident.

## Honest status

Known class; not fixed in Phase A; needs a Foundry improvement cycle (or
strict plan discipline forever). Until then: **one project root = the package
that owns the source**, docs may live elsewhere via config.
