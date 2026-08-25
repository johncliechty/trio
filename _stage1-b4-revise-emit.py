# -*- coding: utf-8 -*-
import json
from pathlib import Path

draft = r'''# Master Plan — Track B4 ramanujan bands (Stage-1 draft, lockable)

**Track:** B4 — Ramanujan depth bands via @foundry/triage
**Status:** Stage-1 revise (Round 2) — closed contract; no OR hedges on production unlock policy
**Foreman GREEN artifact (sole Track B4 wave-close gate):** `foundry/triage/test/b4-ramanujan-smoke.mjs`
  required suite list (all must pass under that smoke or as imports it runs):
  (1) knobs matrix LITE/FULL/SPIKE + SPIKE aliases → frozen rows;
  (2) unlock refuse negatives (certifier never true; named error);
  (3) structural sole-resolve inclusion (production entries obtain knobs only via lock → resolveRamanujanDepthKnobs; not grep-as-guard);
  (4) honesty-law label presence invariant (Statement / non-goal — not SC4);
  (5) prose-block drift check vs BAND_MAPPINGS.ramanujan.

---

## North Star (verbatim)

# North Star — Track B4 ramanujan bands

**Statement:** Ramanujan must honor locked process depth via @foundry/triage:
LITE = direct answer + honesty labels with certifier **off** and fewer verify arms;
FULL/SPIKE may arm the certifier; honesty-law labels are never thinned — proven under Foreman tests.

## Success criteria

1. Depth lock yields ramanujan knobs (verifyArms / certifier) from mapping.mjs.
2. LITE: certifier false and verifyArms < FULL.verifyArms (live knobs).
3. FULL/SPIKE: certifier true per mapping (when depth locked).
4. Production path refuses silent certifier spend without depth lock (or defaults honestly stamped).
5. Automated hermetic tests GREEN under Foreman.

## Non-goals

- Weakening honesty-law labels; Legal/Financial engines; freelancing engine mid-run.

---

## Locked product decisions (implement without mid-wave product debate)

These are **LOCK**, not options. An operator implements P1–P4 from this table alone.

| ID | Decision | Locked value | Acceptance |
|----|----------|--------------|------------|
| **L1 — SC4 unlocked policy** | Exactly one production policy when depth is not locked | **Refuse-closed** | Named error code `RAMANUJAN_CERTIFIER_REQUIRES_DEPTH_LOCK`; `certifierEnabled` / knobs.certifier **never true** without a depth lock; no default-full path; **no honest-stamp production path in Track B4** (stamp deferred / out of scope — refuse is the sole fulfillment of NS SC4 for this track) |
| **L2 — SC4 criteria home** | Success-criteria list is North Star SC1–SC5 **verbatim** (above). Honesty-law labels live in **Statement** and **Non-goals** only — not as a substitute SC4 | P-honesty phase must not renumber or claim SC4 | Plan text + tests cite SC numbers correctly |
| **L3 — SPIKE key** | One canonical `BAND_MAPPINGS.ramanujan` row key | Canonical pin string **`SPIKE`** (same as `DEPTH_BANDS.SPIKE` / `DEPTH_BANDS.SPIKE_FIRST` property value today). Table cells are FULL / LITE / SPIKE only. Alias inputs `SPIKE-FIRST`, `SPIKE_FIRST`, `SPIKEFIRST`, `spike-first` normalize via `normalizeDepthStrict` / `canonicalizeDepth` **at the lock boundary** before table read | Live asserts: every alias token → same frozen `{verifyArms, certifier}` as `SPIKE` |
| **L4 — Sole production call graph** | Only allowed knobs path | **`depth lock → resolveRamanujanDepthKnobs(depth) → Object.freeze({ depth, verifyArms, certifier })`**. Skill helper `resolveRamanujanBand` may obtain lock then call that sole resolve. **Forbidden:** `knobsForSkill('ramanujan', …)` / hard-coded `verifyArms`/`certifier` / env certifier toggles at production arm sites; obtaining knobs without a prior depth lock | Tests fail if production entry returns knobs without a prior lock; structural inclusion test (module graph / required-import contract), not prose OR |
| **L5 — Depth precedence (total order)** | First non-empty wins; then refuse | See **Depth precedence table** below | Unit tests for each rank and for empty → throw |
| **L6 — Frozen mapping numerics** | Do not remap in B4 | LITE `{verifyArms:1, certifier:false}`; FULL `{3,true}`; SPIKE `{2,true}` (current mapping.mjs) | Load-time + matrix asserts |
| **L7 — Ship atomicity** | No intermediate ship leaves silent FULL+certifier | **Phase 1 is one atomic shippable unit** (seam + purge + refuse). Do not merge Phase 1 to main / close a wave until refuse-closed is live and default-full is deleted | Gate: unlock negatives GREEN before Phase 1 done |

### Depth precedence table (total order)

When resolving production Ramanujan depth for knobs:

| Rank | Source | Notes |
|------|--------|--------|
| 1 | Explicit call pin `opts.depth` / `confirmedDepth` | Highest; must pass `normalizeDepthStrict` |
| 2 | Existing `triageLock.depth` / `resolveSkillLock` result when caller already holds a lock object | Lock object depth only — not recommend() advisory |
| 3 | `process.env.FOUNDRY_TRIAGE_DEPTH` | Portfolio shared lock env |
| 4 | `process.env.RAMANUJAN_DEPTH` | Skill-local env pin |
| 5 | *(none)* | **Refuse-closed:** throw `RAMANUJAN_CERTIFIER_REQUIRES_DEPTH_LOCK`; do **not** read mapping; do **not** arm certifier; do **not** stamp a default band |

`recommend()` / unlocked advisory must never be treated as a depth lock. Tier env (`RAMANUJAN_TIER` / `FOUNDRY_TRIAGE_TIER`) does **not** unlock certifier and does **not** substitute for depth.

---

## Outcome (one paragraph)

Track B4 makes every production Ramanujan entry honor locked process depth via @foundry/triage only: lock (precedence table) → `resolveRamanujanDepthKnobs` → frozen `{depth, verifyArms, certifier}` from `BAND_MAPPINGS.ramanujan`. LITE freezes certifier=false and verifyArms < FULL; FULL and SPIKE arm certifier per mapping when depth is locked; unlocked depth **refuses** (named error) so silent certifier spend is impossible. Honesty-law labels stay full-strength under every band (Statement / non-goal). Near term ships the atomic production path, hermetic matrix + refuse negatives + sole-resolve structure, label invariant, prose parity, and one Foreman-required B4 smoke. Deferred: honest-stamp default-depth alternative, freelancing certifier mid-run, Legal/Financial bands, remapping non-ramanujan skills.

---

## Phase 1 — P1 — Atomic production path (sole resolve + purge + refuse-closed)

**North Star:** SC1 + SC4 (verbatim refuse half; L1 locks refuse as sole SC4 fulfillment).
**Why atomic:** Shipping resolve alone while `triage-band.mjs` still defaults `knobsForSkill('ramanujan','FULL','Heavy')` reintroduces silent FULL+certifier — forbidden by L7.

### Near-term specifics

**1a — Sole resolve seam (`foundry/triage/mapping.mjs`)**

- Add `resolveRamanujanDepthKnobs(depth)` next to `ramanujanKnobs` / mirror of `resolveJumperDepthKnobs`:
  1. `d = normalizeDepthStrict(depth)` (aliases → `SPIKE`; unknown → `TRIAGE_UNKNOWN_DEPTH` with `ACCEPTED_DEPTH_SET`)
  2. Read **only** via `ramanujanKnobs(d)` → `knobsForSkill('ramanujan')` → `BAND_MAPPINGS.ramanujan[d]`
  3. Assert integer `verifyArms ≥ 1` and boolean `certifier`
  4. Return `Object.freeze({ depth: d, verifyArms, certifier })`
- No silent FULL fallback inside resolve.
- Export from `foundry/triage/index.mjs`.
- Load-or-init (or module assert): every ramanujan row has shape above; `LITE.certifier === false` and `LITE.verifyArms < FULL.verifyArms` as table invariants.
- Canonical row keys: FULL, LITE, SPIKE only (L3). Document that `DEPTH_BANDS.SPIKE_FIRST` is a property alias of the SPIKE pin string — not a second table cell.

**1b — Refuse-closed production band helper (`skills/ramanujan/src/triage-band.mjs`)**

- Rewrite `resolveRamanujanBand` to:
  1. Resolve depth by **L5 precedence table** only
  2. If no depth at rank 1–4 → throw Error with `code: 'RAMANUJAN_CERTIFIER_REQUIRES_DEPTH_LOCK'` (and human message naming how to lock: pin depth / FOUNDRY_TRIAGE_DEPTH / RAMANUJAN_DEPTH)
  3. Else `const knobs = resolveRamanujanDepthKnobs(depth)`; return `{ knobs, certifierEnabled: knobs.certifier, verifyArms: knobs.verifyArms, source: 'lock', depth: knobs.depth }`
- **Delete** the happy-path branch `knobsForSkill('ramanujan','FULL','Heavy')` / `source: 'default-full'`.
- **Delete** any path that sets certifier true without a resolved depth lock.

**1c — Production entry purge**

- Inventory every Ramanujan production entry (skill invocation, orchestrator, verify-router, proof-auto-certifier, certifier-queue, dispatch, SKILL.md run instructions) and force certifier/verifyArms reads through `resolveRamanujanBand` → `resolveRamanujanDepthKnobs` only.
- Certifier spend sites (lean-certifier, proof-auto-certifier, cross-family arm entry) read `certifierEnabled` / `knobs.certifier` from the resolved frozen object only — no `process.env.RAMANUJAN_CERTIFIER`, no hard-coded `true`.
- Structural inclusion test (Phase 2): production modules that arm certifier must import/call the sole resolve path; fail closed if a second knobs construction site appears in production trees (AST/import contract preferred over brittle whole-repo grep; optional grep may assist but is not the gate).

### Deferred (explicitly)

- Honest-stamp default-depth policy (alternate SC4 fulfillment) — **out of Track B4**; would require a plan amendment and new metadata schema.
- Changing numeric mapping values (L6).
- Non-ramanujan skills through this helper.
- Interactive UI for depth pin (use existing `resolveSkillLock` / env only).
- Certifier engine internals; mid-run depth rebind; subscription/quota behavior.

### Phase 1 done when

- Unlock with no depth → throw `RAMANUJAN_CERTIFIER_REQUIRES_DEPTH_LOCK`; certifier never true.
- Locked LITE/FULL/SPIKE return frozen mapping knobs.
- `default-full` path is gone from production code.

---

## Phase 2 — P2 — Hermetic knob matrix + refuse negatives + sole-resolve structure

**North Star:** SC2 + SC3 + SC4 (negatives) + SC1 (structure).
**Operator note:** No product decision remains — L1–L7 are frozen. Implement tests against locked policy only.

### Near-term specifics

- Add `foundry/triage/test/ramanujan-band-knobs.test.mjs` (and/or `skills/ramanujan/test/triage-band-knobs.test.mjs` hermetic):
  - For depths `LITE`, `FULL`, `SPIKE` and aliases `SPIKE-FIRST`, `SPIKE_FIRST`, `SPIKEFIRST`: lock/pin depth, call `resolveRamanujanDepthKnobs` / live `resolveRamanujanBand`, assert deep equality of `verifyArms` and `certifier` to `BAND_MAPPINGS.ramanujan[canonical]`.
  - Live (not table-only): `LITE.certifier === false` and `LITE.verifyArms < FULL.verifyArms`.
  - Live: `FULL.certifier === true` and `SPIKE.certifier === true` when depth locked; all SPIKE aliases match SPIKE row.
- **Refuse negatives (SC4 acceptance, not prose):**
  - Unlocked `resolveRamanujanBand({})` throws with `code === 'RAMANUJAN_CERTIFIER_REQUIRES_DEPTH_LOCK'`.
  - No code path under test returns `certifier: true` / `certifierEnabled: true` without a depth from ranks 1–4.
  - Precedence unit tests: each rank wins over lower ranks; empty → throw; tier-only env does not unlock.
- **Structural sole-resolve inclusion:** production entry modules that previously constructed knobs must call `resolveRamanujanDepthKnobs` (or `resolveRamanujanBand` which exclusively calls it). Test fails if knobs are obtainable from a production helper without lock. Not “grep-as-guard” as the sole acceptance; use import/export contract or allowlisted call sites enumerated in the test file.
- Hermetic: no network, no real Lean/z3 spawn; import `@foundry/triage` / file URL into mapping only.

### Deferred (explicitly)

- End-to-end live certifier correctness under each band (covered elsewhere).
- Performance/load tests on multi-arm verify.

### Phase 2 done when

- Matrix + refuse negatives + sole-resolve structure GREEN under `node --test`.

---

## Phase 3 — P3 — Honesty-law label invariant (Statement / non-goal — **not SC4**)

**North Star home:** Statement (“honesty-law labels are never thinned”) + Non-goals (“Weakening honesty-law labels”).
**Does not claim SC4.** Depth may change only `verifyArms` / `certifier`; label fields stay present and non-empty under LITE and FULL.

### Near-term specifics

- Add label-invariant hermetic test with the same fixture prompt(s) under LITE vs FULL: assert honesty-law label fields (rung / evidence labels / honesty stamps as emitted by honesty-ui or claim-ledger surfaces) are present and non-empty on both; only verifyArms and certifier may differ in the band-knob slice.
- Pin field names from the live honesty surface (`honesty-ui.mjs` / claim-ledger / SKILL honesty-law contract) — fail if LITE omits or blanks a label FULL keeps.
- Document in SKILL.md / generated triage block: LITE = direct answer + honesty labels, certifier off, fewer verify arms; labels are not a ceremony knob.

### Deferred (explicitly)

- Changing honesty-law rung taxonomy or adding new rungs.
- UI redesign of label presentation beyond presence/non-empty invariant.

### Phase 3 done when

- Label invariant GREEN; prose says labels are never thinned (non-goal).

---

## Phase 4 — P4 — Prose parity + Foreman Track B4 GREEN gate (SC5)

**North Star:** SC5 (and residual SC1 prose parity).
**Sole Foreman wave-close artifact:** `foundry/triage/test/b4-ramanujan-smoke.mjs`.

### Near-term specifics

- Ensure `scripts/regenerate-prose-blocks.mjs` (or existing prose-block path) regenerates `foundry/triage/generated/ramanujan.triage-block.md` from `BAND_MAPPINGS.ramanujan`; CI/test fails if checked-in prose knobs drift (extend `wave6-prose-manifest.test.mjs` or sibling).
- SKILL.md triage section embeds or links generated block; hand-written verifyArms/certifier numbers must match mapping or be removed.
- Implement **`foundry/triage/test/b4-ramanujan-smoke.mjs`** as the single Track B4 Foreman GREEN entry:
  - Imports/runs (or inlines equivalent asserts for) the required suite list in the plan header: knob matrix, unlock refuse negatives, structural sole-resolve inclusion, honesty label invariant, prose drift.
  - Exit non-zero on any mismatch vs frozen rows, LITE certifier/verifyArms invariants, refuse-closed failure, or prose drift.
- Wire smoke into foundry/triage and/or ramanujan Foreman gate (`foreman.config.json` / package test script) as **required GREEN** for Track B4 wave close.
- Run `node --test` on the new suite + smoke; Foreman closes only when all hermetic assertions pass.

### Deferred (explicitly)

- Portfolio-wide prose regen for other skills (Wave-6 territory).
- Non-hermetic live-model Foreman waves for ramanujan product behavior.
- Legal-Beagle / Financial-Analyst engines and any other Track B skills.
- Honest-stamp alternate unlock policy (requires amendment).

### Phase 4 done when

- `b4-ramanujan-smoke.mjs` is GREEN and listed as the sole Track B4 Foreman close gate; SC5 satisfied.

---

## Phase / SC map (no SC renumber drift)

| Phase | Ships | North Star SC | Notes |
|-------|-------|---------------|-------|
| P1 | Atomic production path | SC1, SC4 | Refuse-closed only (L1) |
| P2 | Matrix + negatives + structure | SC2, SC3, SC4, SC1 | Operator-implementable; no product fork |
| P3 | Honesty labels | Statement + non-goal | **Not SC4** |
| P4 | Prose + Foreman smoke | SC5 (+ prose SC1) | Named GREEN artifact |

---

## Explicitly out of scope (non-goals restated)

- Weakening or thinning honesty-law labels by depth.
- Legal-Beagle / Financial-Analyst (or other skills’) band work.
- Freelancing / rebinding certifier or depth knobs mid-run after lock.
- Honest-stamp default-depth production path (alternate SC4 reading) — not in B4 without amendment.
- Remapping `BAND_MAPPINGS` numerics or non-ramanujan tables.
'''

changelog = [
    "LOCKED L1: single production unlocked policy = refuse-closed (RAMANUJAN_CERTIFIER_REQUIRES_DEPTH_LOCK); removed OR/hedge and deferred honest-stamp out of Track B4 so P2 needs no mid-wave product decision.",
    "Restored North Star success criteria SC1–SC5 verbatim in the plan; re-homed honesty-law labels to Statement/Non-goals; P3 no longer claims SC4.",
    "LOCKED L3: canonical BAND_MAPPINGS.ramanujan SPIKE pin only; SPIKE-FIRST/SPIKE_FIRST/SPIKEFIRST normalize at lock boundary; live alias equality asserts required.",
    "LOCKED L4: sole production call graph depth lock → resolveRamanujanDepthKnobs → frozen knobs; structural sole-resolve inclusion tests (not grep-as-guard).",
    "LOCKED L5: total-order depth precedence table (opts.depth → triageLock → FOUNDRY_TRIAGE_DEPTH → RAMANUJAN_DEPTH → refuse); tier-only does not unlock.",
    "Merged former P1+P2 into atomic Phase 1 (seam + purge + refuse) so no shippable intermediate reintroduces default-full FULL+certifier (L7).",
    "Renumbered phases: P1 atomic path, P2 matrix/negatives/structure, P3 honesty invariant, P4 prose + Foreman gate.",
    "Named sole Track B4 Foreman GREEN artifact foundry/triage/test/b4-ramanujan-smoke.mjs with required suite list (matrix, refuse negatives, sole-resolve structure, label invariant, prose drift).",
    "Froze mapping numerics LITE 1/false, FULL 3/true, SPIKE 2/true; document operator can implement without product debate via L1–L7 table.",
    "Removed dual/abbreviated success-criteria list that conflicted with verbatim North Star SC4.",
]

out = {"draft": draft, "changelog": changelog}
out_path = Path(__file__).with_name("_stage1-b4-revise-out.json")
text = json.dumps(out, ensure_ascii=False)
json.loads(text)  # validate
out_path.write_text(text, encoding="utf-8")
print("OK", out_path, "bytes", len(text.encode("utf-8")))
