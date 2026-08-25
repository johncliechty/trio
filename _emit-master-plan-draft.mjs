import { writeFileSync } from 'node:fs';

const draft = `# Master Plan (draft) — Track A: Verify substrate

**North Star (verbatim, locked):** The portfolio's shared triage substrate and live trio call sites must be *proven under engine paths*: every locked depth changes real ceremony knobs; unlocked headless fails closed; safety floors cannot be thinned by a LITE pin. Phase 1–2 freelanced wires are accepted only as raw material — this effort makes them *Foreman-verified*.

## Success criteria (North Star 1–6)

1. **Crucible Stage-0 path:** \`assessComplexity\` routes through \`@foundry/triage\` crucible-wire; HALT shape preserved; explicit depth lock yields that depth's knobs.
2. **Foreman inherit:** \`run-live\` uses \`inheritReviewerCount\`; LITE → ≥1 reviewer; never re-triages; no dark zero-reviewer path.
3. **researchPrime intake:** extension payload + Gate-1 lock; \`run-rounds\` honors \`maxRounds\` / \`includeAdjudication\` from locked extension (explicit CLI still wins).
4. **Band inequality smoke:** for each mapped skill in scope, LITE is strictly leaner than FULL on ≥1 numeric knob.
5. **Safety floors unthinned:** jumper killGates ≥3; zombie requireProofOfDeath; tidy PROTECTED patterns; RP governance.mjs byte-identity preserved.
6. **Automated gate:** \`node --test\` on \`@foundry/triage\` full suite GREEN; hermetic smoke script(s) under this project pass; residual list honest if any soft gap remains.

## Non-goals (do not re-litigate)

- Legal-Beagle / Financial-Analyst engines (Tracks C–D).
- Full band-thin redesign of every Foundry skill's internal map-reduce (Track B).
- Changing Shark Tank ≥2-agree semantics.
- GUI/dashboard depth pickers beyond CLI/env/lock surfaces already in scope.
- Reopening cf-slick ceremony redesign.
- Silent "looks fine" without tests.

## Risk taxonomy

| Risk | Operator contract |
|------|-------------------|
| **False green** | Smoke must \`import\` real call sites / wire modules; assert fails if import deleted or re-routed off wire |
| **Dilution** | Floor rows hard-fail if LITE zeros reviewers / drops killGates / clears requireProofOfDeath / strips PROTECTED / mutates governance.mjs |
| **Scope creep** | Anything outside closed inclusion table + criteria 1–6 → residual only; never GREEN |

## Foresight (after GREEN only)

Track B skill-by-skill C→F for residual rows whose proof class is CLI-only or partial — not opened in this effort.

---

# Operator-decidable contracts (frozen)

## A. Single GREEN / residual rule table

Aligns **criterion 6** with every soft-gap decision. Operator decides GREEN vs residual by **class**, not narrative.

| Gap class | Example | Blocks GREEN? | Residual? | Notes |
|-----------|---------|---------------|-----------|-------|
| **G0 — Suite red** | \`npm test\` in \`@foundry/triage\` exits non-zero | **YES** | no | Package suite is hard gate |
| **G1 — Smoke red** | Named hermetic smoke (included in gate command) exits non-zero | **YES** | no | Hermetic smokes are hard gate |
| **G2 — Wire deleted / dark path reopened** | Any criterion assert in §E fails | **YES** | no | Evidence bar is the assert list |
| **G3 — Safety floor thinned** | killGates <3, requireProofOfDeath false, PROTECTED missing, governance bytes differ | **YES** | no | Dilution premortem |
| **G4 — Closed-table skill missing inequality** | LITE not strictly leaner than FULL on inequality knob for a §B skill | **YES** | no | Criterion 4 |
| **R1 — CLI-only consumption** | Skill has mapping row + CLI/env pin but no live engine handoff path in this effort | no | **YES** | Track B foresight; must name skill |
| **R2 — Partial wire** | Wire imported at site A but not site B for same skill; or chain smoke §C.3 missing | no | **YES** | Must name both sites; must **not** claim full criterion GREEN for the missing site |
| **R3 — Cross-project multi-wave e2e** | Full Crucible→Foreman multi-wave live build | no | **YES** | Optional; not required if §C chain smoke + spies GREEN |
| **R4 — Out-of-table skills** | gandalf, ramanujan, literature-review, legal-beagle, financial-analyst | no | **YES** | Outside Track A inclusion; package inventory tests may still cover them but they do **not** gate criterion 4 |
| **R5 — Docs / prose only** | README wording, DECISION-RECEIPT narrative, SKILL.md polish | no | optional note | **Demoted** — never a GREEN artifact; never substitutes for harness rows |

**GREEN definition (criterion 6):** G0–G4 all pass **and** residual markdown lists every R1–R4 instance honestly (empty list only if none). Soft gaps never silently omit.

**Residual definition:** File \`RESIDUAL-TRACK-A.md\` under the triage package (or this effort's project root) with one row per R-class item: skill, gap class, what is proven, what is not, Track B pointer. Residual **must not** claim criteria 1–2 GREEN for any missing chain-smoke assert.

---

## B. Frozen closed inclusion table

**Closed set.** No open-ended "any other". Skills in this table gate criteria 4–5 for Track A. Adding a skill requires a plan amendment (new row + harness rows), not silent expansion.

| Skill | Depths under test | Proof class | Inequality numeric knob (LITE < FULL) | LITE value | FULL value | Safety-floor row (if any) |
|-------|-------------------|-------------|----------------------------------------|------------|------------|---------------------------|
| **crucible** | LITE, FULL (SPIKE-FIRST optional extra) | **engine-path** | \`sharkRounds\` | 1 | 3 | none (ceremony only) |
| **foreman** | LITE, FULL, SPIKE-FIRST; aliases LIGHT/HEAVY/MID | **engine-path** | \`reviewers\` | 1 | 2 | floor: reviewers ≥ 1 at every recognized depth incl. LITE/LIGHT |
| **researchPrime** | LITE, FULL | **engine-path** | \`maxRounds\` (also \`includeAdjudication\` false vs true) | 2 / false | 8 / true | floor: \`governance.mjs\` byte-identity vs baseline |
| **jumper** | LITE, FULL | **mapping + floor** | \`ideaRounds\` | 2 | 5 | floor: \`killGates ≥ 3\` at LITE, FULL, SPIKE-FIRST |
| **zombie-hunter** | LITE, FULL | **mapping + floor** | \`reaperPasses\` | 1 | 3 | floor: \`requireProofOfDeath === true\` at every depth |
| **tidy-idy** | LITE, FULL | **mapping + floor** | \`debatePasses\` (also \`maxRemovalsPerBatch\`) | 1 / 10 | 2 / 25 | floor: PROTECTED pattern set present under LITE (not stripped) |

**Proof class meanings (operator-decidable):**

| Proof class | What must execute | What is residual if missing |
|-------------|-------------------|----------------------------|
| **engine-path** | Hermetic smoke imports live call site *or* package wire re-exported by live bin, applies lock/handoff fixture, asserts knobs | If only pure \`mapping.mjs\` helper tested → **R2** and do **not** claim criteria 1–3 GREEN for that skill |
| **mapping + floor** | Package mapping suite + harness floor rows for inequality + named safety invariant | CLI-only thin consumption → **R1**; still **G3/G4** if floor/inequality fails |

**Explicitly not in closed table (R4):** gandalf, ramanujan, literature-review, legal-beagle, financial-analyst. Package \`MAPPED_SKILLS\` may still assert their mapping inventory in suite tests; those rows do not expand Track A criterion 4 scope.

---

## C. Hermetic executable smoke contract

### C.0 Invariants (all smokes)

- **No network.** No live model calls, no Anchor job_runner, no subscription CLIs.
- **No real human locks.** Fixtures synthesize lock records / handoff JSON in-process via \`createLockRecord\` / \`buildHandoffTriageEmit\` / static fixture objects — never interactive Stage-0.
- **Real modules only.** Every smoke \`import\`s modules under:
  - \`foundry/triage/*.mjs\` (wires + mapping + lock)
  - and/or live bins: \`crucible/bin/stage0.mjs\`, \`foreman/bin/run-live.mjs\`, \`researchPrime/bin/intake.mjs\`, \`researchPrime/bin/run-rounds.mjs\`
- **Forbidden as sole proof:** re-implementing knobs in the smoke; importing only \`core.mjs\` for criteria 1–3.

### C.1 HALT unlocked-headless fixture (criterion 1 — fail-closed)

| Field | Frozen assert |
|-------|----------------|
| Invoke | \`assessComplexity\` from live \`crucible/bin/stage0.mjs\` **or** re-export path that stage0 imports from \`crucible-wire.mjs\` (assert stage0 source still imports wire) |
| Input | headless / unlocked intake (no depth lock; no interactive pin) |
| Assert | \`result.halt.halt_for_human === true\` **or** thrown err with \`err.halt_for_human === true\` |
| Assert | \`pending_action\` / lock-pending shape preserved (field present; value is confirm-complexity-band / lock class — match existing crucible-wire contract) |
| Anti-dark | Fail if path silently returns FULL knobs and proceeds without halt |

### C.2 Stage-0 lock → knobs (criterion 1)

| Field | Frozen assert |
|-------|----------------|
| Invoke | \`createLockRecord\` / \`resolveStage0TriageLock\` + \`assessComplexity\` with explicit depth pin LITE and FULL |
| Assert LITE | \`bandKnobs.sharkRounds === 1\` (or mapped LITE ceremony knobs from \`crucibleKnobs('LITE')\`) |
| Assert FULL | \`bandKnobs.sharkRounds === 3\` |
| Assert handoff | emit contains \`triage_track\` + \`triage.{tier,depth}\` Foreman-consumer shape |
| Anti-dark | Delete/rename crucible-wire import in stage0 → static source assert fails |

### C.3 Chain smoke: Stage-0 lock → handoff artifact → run-live inherit (criteria 1–2 **together**)

**Required for claiming criteria 1 and 2 GREEN.** If this chain is not implemented, residual **R2** must say criteria 1–2 are **not** fully GREEN (package unit alone is insufficient for the North Star "engine path" bar).

| Step | Action | Assert that fails if wire deleted / dark path reopened |
|------|--------|--------------------------------------------------------|
| 1 | Build lock + handoff via Stage-0 wire path (LITE pin) | handoff.depth / triage_track === LITE |
| 2 | Pass handoff artifact into Foreman inherit surface used by \`run-live\` (\`inheritReviewerCount(cfg)\` as run-live imports it) | \`inherited.reviewers >= 1\`; \`inherited.applied === true\`; \`inherited.depth === 'LITE'\` |
| 3 | **Spy:** wrap/monkey-patch or static+call-count probe so inherit path does **not** call \`recommend\` or \`assessComplexity\` | call count === 0 on both |
| 4 | Matrix rows: LITE, LIGHT, FULL, SPIKE-FIRST, MID | no row yields 0 reviewers; LITE/LIGHT ≥ 1 |
| 5 | Static gate | \`run-live.mjs\` source still contains \`inheritReviewerCount\` import from foreman-wire |

### C.4 researchPrime intake + run-rounds (criterion 3)

| Step | Assert |
|------|--------|
| Extension payload | Gate-1 / intake extension from \`researchprime-wire\` carries \`maxRounds\` + \`includeAdjudication\` for locked depth |
| run-rounds apply | When CLI knobs absent, live apply path uses extension values (LITE: maxRounds=2, includeAdjudication=false; FULL: 8 / true) |
| CLI wins | Explicit CLI maxRounds / includeAdjudication overrides extension when both present |
| Intake-only | Triage sources never import \`governance.mjs\` (existing Wave-5 check remains hard) |

### C.5 Band inequality + floors (criteria 4–5) — harness-driven

For each §B row: assert LITE numeric inequality knob < FULL; run safety-floor row if present. Failure → G3 or G4.

### C.6 Smoke file location (locked at P0)

- Package tests: \`foundry/triage/test/*.test.mjs\` (existing stage0-wire, foreman-inherit, rp-intake-mapping, plus new chain/hermetic files as needed).
- All hermetic contracts ship **inside** the package suite so one command covers them (see §D).

---

## D. One named gate command (GREEN artifact — **before** P1 product file authoring)

**Name:** \`track-a-verify-gate\`

**Command (frozen):**

\`\`\`
npm test --prefix "C:/dev/Skill Foundry/foundry/triage"
\`\`\`

which expands to (package.json \`test\` script; new hermetic files **must** be added to this script list):

\`\`\`
node --test test/recommend.test.mjs test/vocabulary.test.mjs test/lock.test.mjs test/stage0-wire.test.mjs test/foreman-inherit.test.mjs test/rp-intake-mapping.test.mjs test/wave6-prose-manifest.test.mjs [+ new hermetic/chain test files from this plan]
\`\`\`

**Operator rule:**

1. **P0 first:** extend/add hermetic tests so the **same** \`npm test --prefix …/foundry/triage\` command covers §C contracts (chain smoke, HALT fixture, inclusion-table inequality + floors, precedence rows).
2. **No criterion-1–5 product edits claim done** until this command is the GREEN artifact (exit 0 after harness + product fixes).
3. Document the command once in \`RESIDUAL-TRACK-A.md\` header (operator runbook) — docs alone are not the gate.

**GREEN artifact:** exit code 0 from \`track-a-verify-gate\` + residual file present (may be empty of R-rows if none).

---

## E. Evidence quality bar — exact assert per North Star criterion

If the wire were deleted or the dark path reopened, **this assert fails**:

| # | Criterion | Exact assert (failure mode) |
|---|-----------|------------------------------|
| 1 | Stage-0 path | (a) \`crucible/bin/stage0.mjs\` source matches import of \`crucible-wire\`; (b) unlocked headless → \`halt_for_human === true\`; (c) LITE lock → \`sharkRounds === 1\`, FULL → \`=== 3\`; (d) handoff shape \`triage_track\` + \`triage.depth\` |
| 2 | Foreman inherit | (a) \`run-live.mjs\` source matches \`inheritReviewerCount\` import; (b) LITE inherit → \`reviewers >= 1\`; (c) spy: 0 calls to \`recommend\`/\`assessComplexity\` on inherit path; (d) no matrix row yields 0 reviewers for LITE/LIGHT |
| 3 | RP intake + rounds | (a) extension payload fields present for depth; (b) apply path uses them without CLI; (c) CLI override wins; (d) sources never import governance.mjs |
| 4 | Band inequality | For each §B skill: \`BAND_MAPPINGS[skill].LITE[knob] < BAND_MAPPINGS[skill].FULL[knob]\` (boolean false < true counts for includeAdjudication) |
| 5 | Safety floors | jumper: all depths \`killGates >= 3\`; zombie: all depths \`requireProofOfDeath === true\`; tidy: PROTECTED patterns non-empty under LITE; RP: live \`governance.mjs\` bytes === \`fixtures/researchprime-governance.baseline.mjs\` (paths already used by package suite) |
| 6 | Automated gate | \`track-a-verify-gate\` exit 0; residual file honest for R1–R4 |

---

## F. Precedence matrix (mandatory harness rows — not docs-only)

| Surface | Winner | Loser | Assert |
|---------|--------|-------|--------|
| Foreman reviewers | explicit \`--reviewers\` / CLI count | inherit from handoff | when CLI present, final count === CLI; inherit not applied as override |
| Foreman depth source | \`triage.depth\` when locked | \`triage_track\` string | inherit prefers triage.depth (existing package test remains) |
| Foreman no-handoff | defaultCount / safe fallback ≥ MIN_REVIEWERS | dark 0 | never 0 |
| RP rounds | explicit CLI maxRounds | extension maxRounds | CLI wins |
| RP adjudication | explicit CLI includeAdjudication | extension flag | CLI wins |
| Stage-0 depth | explicit lock / pin | recommend default | locked depth's knobs returned; no re-triage after lock |

All six rows are **executable** tests in the harness. Demote any README-only precedence prose.

---

## G. Floor matrix (mandatory harness rows)

| ID | Floor | Depths | Assert |
|----|-------|--------|--------|
| F1 | Foreman MIN_REVIEWERS | LITE, LIGHT, FULL, SPIKE-FIRST, MID, HEAVY | reviewers ≥ 1 |
| F2 | jumper killGates | LITE, FULL, SPIKE-FIRST | killGates ≥ 3 |
| F3 | zombie requireProofOfDeath | LITE, FULL, SPIKE-FIRST | === true |
| F4 | tidy PROTECTED | LITE (and FULL) | protected pattern set present / not stripped under LITE |
| F5 | RP governance byte-identity | n/a | live file(s) === baseline fixture |
| F6 | HALT unlocked headless | n/a | halt_for_human true; no silent FULL proceed |

---

# Phased work (P0–P5)

## Phase 0 — P0 — Harness freeze + gate command (blocks all product claims)

**Goal:** Make GREEN decidable before writing criterion-specific product patches.

**Deliverables (operator checklist):**

1. Commit to closed inclusion table §B (no row edits without amendment).
2. Implement/extend table-driven harness rows: skill × depth × proof class × inequality knob × floor flags (§B + §G).
3. Implement hermetic smokes §C.1–C.5 under package \`test/\` (real imports, no network).
4. Wire chain smoke §C.3 (Stage-0 lock → handoff → inherit + spies) **or** immediately open residual R2 stating criteria 1–2 not fully claimable.
5. Name gate: \`track-a-verify-gate\` = \`npm test --prefix "C:/dev/Skill Foundry/foundry/triage"\` including new files in package.json test script.
6. Create \`RESIDUAL-TRACK-A.md\` skeleton with GREEN/residual rule table §A.

**Exit:** Gate command runs (may fail red until later phases fix product); harness contracts exist as code, not prose.

**Deferred:** product behavior changes beyond test fixtures; Track B; C–D engines.

## Phase 1 — P1 — Crucible Stage-0 path (criterion 1)

**Only after P0 harness exists.**

- Repair/extend so §C.1 + §C.2 + chain half for Stage-0 pass.
- Exact asserts: §E row 1.
- Fail closed on unlocked headless; lock→knobs for LITE/FULL; handoff shape.

**Deferred:** SPIKE-FIRST product orchestration; Stage-1/2 shark count redesign; cf-slick.

## Phase 2 — P2 — Foreman inherit path (criterion 2)

- §C.3 full chain + §F Foreman precedence rows + F1 floor.
- Exact asserts: §E row 2.
- Static source gate on run-live import kept hard.

**Deferred:** multi-wave live e2e (R3); wave-engine topology redesign.

## Phase 3 — P3 — researchPrime intake + run-rounds (criterion 3)

- §C.4 + RP precedence rows + F5 floor (byte-identity; no governance edits).
- Exact asserts: §E row 3.

**Deferred:** Shark ≥2-agree; governance.mjs edits; SPIKE product flow beyond mapped knobs.

## Phase 4 — P4 — Band inequality + safety floors (criteria 4–5)

- Drive §B closed table + §G floors as hard suite rows (G3/G4).
- Exact asserts: §E rows 4–5.
- Any §B skill only CLI-proven → residual R1, still must pass mapping inequality + floors.

**Deferred:** Track B map-reduce; new floors beyond F1–F6; expanding closed table without amendment.

## Phase 5 — P5 — Automated gate + residual honesty (criterion 6)

- **GREEN iff:** \`track-a-verify-gate\` exit 0 **and** \`RESIDUAL-TRACK-A.md\` lists every R1–R4 (or states none) **and** no G0–G4 open.
- Align language with North Star criterion 6: suite GREEN + hermetic smokes pass + residual honest.
- Orange foresight only after GREEN: residual skills → Track B C→F candidates.
- Refuse scope creep: Legal/Financial engines, cf-slick, Shark ≥2-agree, full map-reduce redesign stay non-goals.

**Exit criteria for whole effort:** §E all six rows green under one command; residual honest.

---

# Phase summary (operator view)

| Phase | Priority | North Star # | Hard exit |
|-------|----------|--------------|-----------|
| P0 | first | 6 (gate skeleton) | harness + named command + residual skeleton exist as code |
| P1 | P0 done | 1 | §E.1 asserts green |
| P2 | P0 done | 2 | §E.2 asserts green (chain or residual not claiming) |
| P3 | P0 done | 3 | §E.3 asserts green |
| P4 | P0 done | 4–5 | §E.4–5 asserts green |
| P5 | P1–P4 done | 6 | \`track-a-verify-gate\` exit 0 + residual honest |

---

# Refuse list (hard)

- Legal / Financial engine builds (Tracks C–D).
- Full Foundry internal map-reduce band-thin (Track B execution).
- Shark Tank ≥2-agree semantic changes.
- cf-slick reopening.
- GUI depth pickers as GREEN substitutes.
- Docs-only precedence/floor "coverage".
- Claiming criteria 1–2 GREEN without §C.3 chain (or explicit residual that refuses the claim).
- Expanding inclusion table without plan amendment.
`;

const changelog = [
  'Replaced narrative phase prose with operator-decidable contracts: GREEN/residual rule table (G0–G4 vs R1–R5) aligned to North Star criterion 6.',
  'Froze closed inclusion table: crucible, foreman, researchPrime, jumper, zombie-hunter, tidy-idy only — skill × depth × proof class × inequality knob × LITE/FULL values × safety floors; no open-ended any-other.',
  'Added hermetic smoke contract (no network/real locks): HALT unlocked-headless frozen field asserts; required Stage-0-lock → handoff → run-live inherit chain with spies (0 recommend/assessComplexity, LITE≥1) or explicit residual that does not claim criteria 1–2 GREEN.',
  'Named single GREEN gate command track-a-verify-gate = npm test --prefix foundry/triage (package suite + hermetic files); required before P1 product claims.',
  'Promoted precedence matrix and floor matrix to mandatory executable harness rows; demoted docs-only items to R5 non-gate.',
  'Added evidence quality bar §E: every North Star criterion names the exact assert that fails if the wire is deleted or dark path reopened.',
  'Restructured phases as P0 harness-first then P1–P5 criterion repair; Phase 5 language matches criterion 6 (suite + smokes + honest residual).',
  'Kept non-goals frozen: Legal/Financial, Track B redesign, Shark ≥2-agree, cf-slick, silent looks-fine.',
];

const out = JSON.stringify({ draft, changelog });
JSON.parse(out); // validate
writeFileSync(new URL('./_stage1-revise-out.json', import.meta.url), out, 'utf8');
process.stdout.write(out);
