// trio-shared/brownfield-intake/approvedProseBinding.mjs — Wave 4: the deterministic,
// NON-SEMANTIC, BIJECTIVE binding check between a re-derived PlanArtifact and the
// APPROVEd prose.
//
// Run on the approve-with-edits path BEFORE RUN (rederiveFromProse.mjs), AFTER the
// schema and verbatim-anchor checks: a re-derive emission can be schema-valid and fully
// verbatim-anchored against the grounded sources and STILL describe a plan the human
// never approved. This check refuses that emission with literal string containment
// ONLY — never semantic span->slot matching — bound in BOTH directions and PER SLOT:
//
//   (a) SOUNDNESS (emission -> prose): every string value of every emitted plan
//       element — scope.statement, scope.axis, each branch.question/rationale, each
//       sourcesToBeat.title/why, each foresight field (dropped/counterfactualCost/
//       stamp), and each seed's idType:id and title — must appear VERBATIM in the
//       APPROVED prose as a whitespace-collapsed substring (exactly the Wave-3
//       renderer's "every plan element value appears verbatim in the prose body" rule;
//       renderPlanProse.mjs emits each of these values literally into the body).
//   (b) COMPLETENESS (prose -> emission): the APPROVED prose is re-parsed by the
//       DETERMINISTIC inverse of the Wave-3 renderer's line grammar (one numbered
//       block per branch, one list line per source-to-beat, one list line per seed;
//       "None derived." / "None provided." mean zero), and the COUNT of branch,
//       source-to-beat and seed lines in the approved prose must equal
//       branches.length / sourcesToBeat.length / seeds.length — a shortfall is a
//       binding failure NAMING the dropped slot, so an emission that silently deletes
//       approved plan elements can never RUN.
//   (c) SLOT ALIGNMENT: each value must be contained in the SPECIFIC approved-prose
//       line/block for its OWN slot — for INDEXED elements, its own index
//       (branches[i].question and branches[i].rationale in the i-th branch block;
//       sourcesToBeat[i].title/why in the i-th source-to-beat line; seeds[i].idType:id
//       and seeds[i].title in the SAME seed line) AND for the SINGLE-SLOT elements,
//       its own LABELED renderer line (scope.statement in the scope-statement line;
//       scope.axis in the `**AXIS (win condition):**` line; foresight.dropped in the
//       `**Dropped/reordered:**` line; foresight.counterfactualCost in the
//       `**Counterfactual cost:**` line; foresight.stamp in the `**Stamp:**` line) —
//       not merely somewhere in the prose blob — so approved values cannot be
//       cross-wired between ANY two named slots and still bind.
//
// A value or slot that fails any direction is a BINDING FAILURE the caller turns into
// a stamped ABORT. Anchors are deliberately NOT bound here: they are never rendered
// into the prose (coverage is an advisory sidecar) and are checked against the
// grounded sources by ./verbatimAnchorCheck.mjs instead.
//
// Pure and total: never throws, whatever the input shape. Structural conformance is
// the schema validator's job (./validatePlanArtifact.mjs) — this check runs AFTER the
// schema passes and walks the artifact defensively. A human edit that mangles the
// renderer's line grammar beyond recognition parses to slot counts that cannot match
// the emission, so the outcome is a fail-safe ABORT — never a silent RUN of an
// unapproved plan.

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function collapseWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

// The deterministic inverse of renderPlanProse.mjs's line grammar.
const SECTION_HEADINGS = {
  Scope: 'scope',
  'Candidate branches / questions': 'branches',
  'Sources to beat': 'sourcesToBeat',
  'Foresight receipt': 'foresight',
  Seeds: 'seeds',
};
const HEADING_RE = /^##\s+(.+?)\s*$/;
const BRANCH_START_RE = /^\s*\d+[.)]\s/; // renderPlanProse: `${i + 1}. **Question:** …`
const LIST_ITEM_RE = /^\s*-\s+/; // renderPlanProse: `- **title** — why` / `- idType:id — title`
const NONE_MARKERS = new Set(['None derived.', 'None provided.']);
const SCOPE_AXIS_LABEL = '**AXIS (win condition):**'; // renderPlanProse's labeled axis line
const FORESIGHT_LABELS = {
  // renderPlanProse's three labeled foresight-receipt lines.
  '**Dropped/reordered:**': 'foresightDropped',
  '**Counterfactual cost:**': 'foresightCounterfactualCost',
  '**Stamp:**': 'foresightStamp',
};

/**
 * @typedef {object} ApprovedProseSlots
 * @property {string|null} scopeStatement The whitespace-collapsed scope-statement
 *   block (every Scope-section line BEFORE the labeled AXIS line); null if absent.
 * @property {string|null} scopeAxis The collapsed value of the `**AXIS (win
 *   condition):**` labeled line (plus human-wrapped continuations); null if absent.
 * @property {string[]} branches One whitespace-collapsed block per branch (the numbered
 *   question line plus its continuation lines, e.g. the rationale line).
 * @property {string[]} sourcesToBeat One whitespace-collapsed line per source-to-beat.
 * @property {string|null} foresightDropped The `**Dropped/reordered:**` labeled value.
 * @property {string|null} foresightCounterfactualCost The `**Counterfactual cost:**` labeled value.
 * @property {string|null} foresightStamp The `**Stamp:**` labeled value.
 * @property {string[]} seeds One whitespace-collapsed line per seed.
 */

/**
 * Re-parse an approved prose plan body by the deterministic inverse of the Wave-3
 * renderer's line grammar. Deterministic and total: a non-string parses to zero slots
 * everywhere; unrecognizable lines are stray prose, never slots. A missing labeled
 * line parses to null — which can never contain a value, so a mangled grammar binds
 * fail-safe to ABORT downstream, never to a silent RUN.
 *
 * @param {unknown} approvedProse
 * @returns {ApprovedProseSlots}
 */
export function parseApprovedProseSlots(approvedProse) {
  /** @type {ApprovedProseSlots} */
  const slots = {
    scopeStatement: null,
    scopeAxis: null,
    branches: [],
    sourcesToBeat: [],
    foresightDropped: null,
    foresightCounterfactualCost: null,
    foresightStamp: null,
    seeds: [],
  };
  if (typeof approvedProse !== 'string') return slots;

  let section = null;
  let axisSeen = false;
  let lastForesightKey = null;
  for (const line of approvedProse.split('\n')) {
    const heading = line.match(HEADING_RE);
    if (heading) {
      section = Object.hasOwn(SECTION_HEADINGS, heading[1]) ? SECTION_HEADINGS[heading[1]] : null;
      continue;
    }
    if (section === null) continue;
    const collapsed = collapseWhitespace(line);
    if (collapsed === '' || NONE_MARKERS.has(collapsed)) continue;

    if (section === 'scope') {
      if (collapsed.startsWith(SCOPE_AXIS_LABEL)) {
        slots.scopeAxis = collapseWhitespace(collapsed.slice(SCOPE_AXIS_LABEL.length));
        axisSeen = true;
      } else if (axisSeen) {
        // A human-wrapped continuation of the labeled AXIS line.
        slots.scopeAxis = slots.scopeAxis === '' ? collapsed : `${slots.scopeAxis} ${collapsed}`;
      } else {
        // Every Scope-section line before the AXIS label is the scope-statement block.
        slots.scopeStatement = slots.scopeStatement === null ? collapsed : `${slots.scopeStatement} ${collapsed}`;
      }
    } else if (section === 'foresight') {
      const label = Object.keys(FORESIGHT_LABELS).find((l) => collapsed.startsWith(l));
      if (label) {
        lastForesightKey = FORESIGHT_LABELS[label];
        slots[lastForesightKey] = collapseWhitespace(collapsed.slice(label.length));
      } else if (lastForesightKey !== null) {
        // A human-wrapped continuation of the previous labeled foresight line.
        slots[lastForesightKey] =
          slots[lastForesightKey] === '' ? collapsed : `${slots[lastForesightKey]} ${collapsed}`;
      }
      // An unlabeled line before the first label is stray prose, not a slot.
    } else if (section === 'branches') {
      if (BRANCH_START_RE.test(line)) {
        slots.branches.push(collapsed);
      } else if (slots.branches.length > 0) {
        // Continuation of the current branch block (the rationale line, or a wrap).
        slots.branches[slots.branches.length - 1] += ` ${collapsed}`;
      }
      // A non-numbered line before the first branch is stray prose, not a slot.
    } else if (LIST_ITEM_RE.test(line)) {
      slots[section].push(collapsed);
    } else if (slots[section].length > 0) {
      // A human-wrapped continuation of the previous list line.
      slots[section][slots[section].length - 1] += ` ${collapsed}`;
    }
  }
  return slots;
}

/**
 * @typedef {object} BindingFailure
 * @property {string} path Dotted path of the failing element value or slot (e.g.
 *   'scope.statement', 'branches[0].question', 'seeds[0].identity'; a bare
 *   'branches[2]' names a dropped approved slot).
 * @property {string|null} value The element's string value — for a dropped slot, the
 *   approved-prose line that has no emitted counterpart (null if not a string).
 * @property {string} reason Why the value or slot failed the binding check.
 */

/**
 * @typedef {object} BindingCheckResult
 * @property {boolean} ok True iff the emission binds bijectively to the approved
 *   prose: every value appears verbatim (soundness), every approved slot has an
 *   emitted counterpart (completeness), and every value — indexed or single-slot —
 *   sits in the approved line/block for its own slot (slot alignment).
 * @property {BindingFailure[]} failures Empty on pass; one entry per failure.
 */

/** (a)+(c) for every value: containment in the slot's OWN approved line/block. */
function bindSlotValue(path, value, slotText, slotDesc, collapsedProse, failures) {
  if (typeof value !== 'string') {
    failures.push({ path, value: null, reason: 'element value is not a string' });
    return;
  }
  const collapsed = collapseWhitespace(value);
  if (collapsed === '') {
    failures.push({ path, value, reason: 'element value is empty — nothing to bind to the approved prose' });
    return;
  }
  if (typeof slotText === 'string' && slotText.includes(collapsed)) return;
  if (collapsedProse.includes(collapsed)) {
    failures.push({
      path,
      value,
      reason:
        `slot-alignment failure: the value appears in the APPROVEd prose but NOT in the approved ${slotDesc} ` +
        'for its own slot — approved values cannot be cross-wired between slots and still bind ' +
        '(literal containment only, no semantic matching)',
    });
  } else {
    failures.push({
      path,
      value,
      reason:
        'value does not appear verbatim (whitespace-collapsed substring) in the APPROVEd prose — ' +
        'the emission describes a plan element the human never approved (literal containment only, ' +
        'no semantic matching)',
    });
  }
}

/**
 * (b) COMPLETENESS + (c) SLOT ALIGNMENT for one indexed kind (branches, sourcesToBeat,
 * seeds): the approved-prose slot count must equal the emitted count, and each emitted
 * element's values must sit in the approved line/block at its own index.
 *
 * @param {string} kind Artifact key ('branches' | 'sourcesToBeat' | 'seeds').
 * @param {string} slotDesc Human label for the approved line kind (used in reasons).
 * @param {unknown} emitted The artifact's array for this kind.
 * @param {string[]} proseSlots The approved prose's collapsed lines/blocks for this kind.
 * @param {(element: object) => Array<[string, unknown]>} fieldsOf Sub-path -> value pairs to bind.
 * @param {string} collapsedProse
 * @param {BindingFailure[]} failures
 */
function bindIndexedKind(kind, slotDesc, emitted, proseSlots, fieldsOf, collapsedProse, failures) {
  const list = Array.isArray(emitted) ? emitted : [];

  // (b) COMPLETENESS: every approved slot beyond the emission's length was dropped.
  for (let j = list.length; j < proseSlots.length; j++) {
    failures.push({
      path: `${kind}[${j}]`,
      value: proseSlots[j],
      reason:
        `dropped slot: the APPROVEd prose lists ${proseSlots.length} ${slotDesc} line(s) but the ` +
        `emission carries only ${list.length} — this approved ${slotDesc} has no emitted counterpart, ` +
        'and an emission that silently deletes approved plan elements can never RUN',
    });
  }

  list.forEach((element, i) => {
    if (!isPlainObject(element)) return; // structural defects are the schema validator's job
    if (i >= proseSlots.length) {
      // The other direction of (b): an emitted slot with no approved line at its index.
      failures.push({
        path: `${kind}[${i}]`,
        value: null,
        reason:
          `no approved ${slotDesc} exists at index ${i} — the APPROVEd prose lists only ` +
          `${proseSlots.length} ${slotDesc} line(s), so this emitted element was never approved`,
      });
      return;
    }
    for (const [subPath, value] of fieldsOf(element)) {
      bindSlotValue(`${kind}[${i}].${subPath}`, value, proseSlots[i], slotDesc, collapsedProse, failures);
    }
  });
}

/**
 * Deterministically bind a re-derived PlanArtifact to the APPROVED prose in BOTH
 * directions and PER SLOT — literal whitespace-collapsed containment only, NOT
 * semantic span->slot matching: a reworded, translated, or paraphrased value fails;
 * a dropped approved element fails; a cross-wired value fails.
 *
 * @param {unknown} artifact A (schema-validated) re-derived PlanArtifact candidate.
 * @param {unknown} approvedProse The prose plan body the one-shot gate APPROVEd.
 * @returns {BindingCheckResult}
 */
export function approvedProseBinding(artifact, approvedProse) {
  /** @type {BindingFailure[]} */
  const failures = [];

  if (typeof approvedProse !== 'string') {
    return {
      ok: false,
      failures: [
        { path: 'approvedProse', value: null, reason: 'approved prose is not a string — nothing to bind against' },
      ],
    };
  }
  if (!isPlainObject(artifact)) {
    return {
      ok: false,
      failures: [{ path: 'artifact', value: null, reason: 'not a plan-artifact object' }],
    };
  }

  const collapsedProse = collapseWhitespace(approvedProse);
  const slots = parseApprovedProseSlots(approvedProse);

  // Single-slot elements: (a) soundness + (c) alignment to each one's OWN labeled
  // renderer line — scope.statement and scope.axis cannot be exchanged, and no
  // foresight field can carry another slot's approved text, and still bind.
  if (isPlainObject(artifact.scope)) {
    bindSlotValue('scope.statement', artifact.scope.statement, slots.scopeStatement, 'scope-statement line', collapsedProse, failures);
    bindSlotValue('scope.axis', artifact.scope.axis, slots.scopeAxis, '`**AXIS (win condition):**` line', collapsedProse, failures);
  }
  if (isPlainObject(artifact.foresight)) {
    bindSlotValue('foresight.dropped', artifact.foresight.dropped, slots.foresightDropped, '`**Dropped/reordered:**` line', collapsedProse, failures);
    bindSlotValue('foresight.counterfactualCost', artifact.foresight.counterfactualCost, slots.foresightCounterfactualCost, '`**Counterfactual cost:**` line', collapsedProse, failures);
    bindSlotValue('foresight.stamp', artifact.foresight.stamp, slots.foresightStamp, '`**Stamp:**` line', collapsedProse, failures);
  }

  // Indexed elements: (a) soundness + (b) completeness + (c) slot alignment.
  bindIndexedKind(
    'branches',
    'branch block',
    artifact.branches,
    slots.branches,
    (branch) => [
      ['question', branch.question],
      ['rationale', branch.rationale],
    ],
    collapsedProse,
    failures,
  );
  bindIndexedKind(
    'sourcesToBeat',
    'source-to-beat line',
    artifact.sourcesToBeat,
    slots.sourcesToBeat,
    (source) => [
      ['title', source.title],
      ['why', source.why],
    ],
    collapsedProse,
    failures,
  );
  bindIndexedKind(
    'seeds',
    'seed line',
    artifact.seeds,
    slots.seeds,
    // The Wave-3 renderer emits each seed as `- idType:id — title`; both halves must
    // bind to the SAME seed line.
    (seed) => [
      [
        'identity',
        typeof seed.idType === 'string' && typeof seed.id === 'string' ? `${seed.idType}:${seed.id}` : null,
      ],
      ['title', seed.title],
    ],
    collapsedProse,
    failures,
  );

  return { ok: failures.length === 0, failures };
}
