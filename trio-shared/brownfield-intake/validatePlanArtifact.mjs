// trio-shared/brownfield-intake/validatePlanArtifact.mjs — Wave 2: runtime PlanArtifact
// validator + canonical field-ordering.
//
// validatePlanArtifact(artifact) returns structured pass/fail with PER-FIELD reasons —
// it never throws, whatever the input. The schema it enforces is the module-owned
// contract in ./planArtifact.schema.mjs (the frozen gate never reads the artifact).
//
// canonicalizePlanArtifact / canonicalStringifyPlanArtifact impose the schema's
// deterministic key order so two artifacts with identical content — whatever the key
// insertion order they were built with — serialize BYTE-IDENTICALLY. Byte-stable
// serialization is what later waves hash, snapshot, and golden-diff against.

import {
  CANONICAL_KEY_ORDER,
  SEED_ID_TYPES,
  ADVISORY_ONLY_KEYS,
} from './planArtifact.schema.mjs';

/**
 * @typedef {object} ValidationReason
 * @property {string} path Dotted path of the offending field (e.g. 'foresight',
 *   'scope.anchors', 'branches[0].question'); 'artifact' for the root.
 * @property {string} reason Human-readable per-field reason.
 */

/**
 * @typedef {object} ValidationResult
 * @property {boolean} ok True iff the artifact conforms to the module-owned schema.
 * @property {ValidationReason[]} reasons Empty on pass; one entry per defect on fail.
 */

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Exact-surface check: every schema key present, no extras; advisory keys called out. */
function checkKeySurface(obj, kind, basePath, elementLabel, reasons) {
  const order = CANONICAL_KEY_ORDER[kind];
  for (const key of order) {
    if (!(key in obj)) {
      reasons.push({
        path: basePath === 'artifact' ? key : `${basePath}.${key}`,
        reason: `missing required field "${key}" — ${elementLabel} requires it`,
      });
    }
  }
  for (const key of Object.keys(obj)) {
    if (order.includes(key)) continue;
    const path = basePath === 'artifact' ? key : `${basePath}.${key}`;
    if (ADVISORY_ONLY_KEYS.includes(key)) {
      reasons.push({
        path,
        reason:
          `"${key}" must not appear on the PlanArtifact — coverage/provenance is an ` +
          'advisory sidecar derived from anchors, never a schema field',
      });
    } else {
      reasons.push({
        path,
        reason: `unexpected field "${key}" — ${elementLabel} admits no extra fields`,
      });
    }
  }
}

function checkNonEmptyString(obj, key, basePath, reasons) {
  if (!(key in obj)) return; // absence already reported by checkKeySurface
  const path = basePath === 'artifact' ? key : `${basePath}.${key}`;
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    reasons.push({ path, reason: `"${key}" must be a non-empty string` });
  }
}

/** Every plan element carries at least one model-emitted verbatim span anchor. */
function checkAnchors(obj, basePath, reasons) {
  if (!('anchors' in obj)) return; // absence already reported by checkKeySurface
  const path = `${basePath}.anchors`;
  const anchors = obj.anchors;
  if (!Array.isArray(anchors)) {
    reasons.push({ path, reason: '"anchors" must be an array of verbatim span anchors' });
    return;
  }
  if (anchors.length === 0) {
    reasons.push({
      path,
      reason:
        'missing anchors — every plan element carries at least one model-emitted ' +
        'verbatim span anchor',
    });
    return;
  }
  anchors.forEach((anchor, i) => {
    const anchorPath = `${path}[${i}]`;
    if (!isPlainObject(anchor)) {
      reasons.push({ path: anchorPath, reason: 'each anchor must be an object' });
      return;
    }
    checkKeySurface(anchor, 'anchor', anchorPath, 'an anchor', reasons);
    checkNonEmptyString(anchor, 'sourceId', anchorPath, reasons);
    checkNonEmptyString(anchor, 'quote', anchorPath, reasons);
  });
}

/**
 * Validate a candidate PlanArtifact against the module-owned schema.
 * Pure and total: never throws; returns structured pass/fail with per-field reasons.
 *
 * @param {unknown} artifact
 * @returns {ValidationResult}
 */
export function validatePlanArtifact(artifact) {
  /** @type {ValidationReason[]} */
  const reasons = [];

  if (!isPlainObject(artifact)) {
    reasons.push({
      path: 'artifact',
      reason: 'PlanArtifact must be a plain object',
    });
    return { ok: false, reasons };
  }

  checkKeySurface(artifact, 'artifact', 'artifact', 'a PlanArtifact', reasons);
  checkNonEmptyString(artifact, 'artifactVersion', 'artifact', reasons);

  if ('scope' in artifact) {
    if (!isPlainObject(artifact.scope)) {
      reasons.push({ path: 'scope', reason: '"scope" must be an object (scope/AXIS)' });
    } else {
      checkKeySurface(artifact.scope, 'scope', 'scope', 'the scope element', reasons);
      checkNonEmptyString(artifact.scope, 'statement', 'scope', reasons);
      checkNonEmptyString(artifact.scope, 'axis', 'scope', reasons);
      checkAnchors(artifact.scope, 'scope', reasons);
    }
  }

  if ('branches' in artifact) {
    if (!Array.isArray(artifact.branches)) {
      reasons.push({
        path: 'branches',
        reason: '"branches" must be an array of candidate branches/questions',
      });
    } else {
      artifact.branches.forEach((branch, i) => {
        const p = `branches[${i}]`;
        if (!isPlainObject(branch)) {
          reasons.push({ path: p, reason: 'each branch must be an object' });
          return;
        }
        checkKeySurface(branch, 'branch', p, 'a branch element', reasons);
        checkNonEmptyString(branch, 'question', p, reasons);
        checkNonEmptyString(branch, 'rationale', p, reasons);
        checkAnchors(branch, p, reasons);
      });
    }
  }

  if ('sourcesToBeat' in artifact) {
    if (!Array.isArray(artifact.sourcesToBeat)) {
      reasons.push({
        path: 'sourcesToBeat',
        reason: '"sourcesToBeat" must be an array of sources-to-beat',
      });
    } else {
      artifact.sourcesToBeat.forEach((source, i) => {
        const p = `sourcesToBeat[${i}]`;
        if (!isPlainObject(source)) {
          reasons.push({ path: p, reason: 'each source-to-beat must be an object' });
          return;
        }
        checkKeySurface(source, 'sourceToBeat', p, 'a source-to-beat element', reasons);
        checkNonEmptyString(source, 'title', p, reasons);
        checkNonEmptyString(source, 'why', p, reasons);
        checkAnchors(source, p, reasons);
      });
    }
  }

  if (!('foresight' in artifact)) {
    // checkKeySurface already pushed the generic missing-field reason; sharpen it so the
    // caller sees the missing FORESIGHT RECEIPT named explicitly (Wave-2 acceptance).
    const entry = reasons.find((r) => r.path === 'foresight');
    if (entry) {
      entry.reason =
        'missing required field "foresight" — the foresight receipt is a required ' +
        'PlanArtifact element';
    }
  } else if (!isPlainObject(artifact.foresight)) {
    reasons.push({
      path: 'foresight',
      reason: '"foresight" must be an object (the foresight receipt)',
    });
  } else {
    checkKeySurface(artifact.foresight, 'foresight', 'foresight', 'the foresight receipt', reasons);
    checkNonEmptyString(artifact.foresight, 'dropped', 'foresight', reasons);
    checkNonEmptyString(artifact.foresight, 'counterfactualCost', 'foresight', reasons);
    checkNonEmptyString(artifact.foresight, 'stamp', 'foresight', reasons);
    checkAnchors(artifact.foresight, 'foresight', reasons);
  }

  if ('seeds' in artifact) {
    if (!Array.isArray(artifact.seeds)) {
      reasons.push({ path: 'seeds', reason: '"seeds" must be an array (it MAY be empty)' });
    } else {
      // seeds MAY be empty: the intent-only route derives a plan with zero seeds.
      artifact.seeds.forEach((seed, i) => {
        const p = `seeds[${i}]`;
        if (!isPlainObject(seed)) {
          reasons.push({ path: p, reason: 'each seed must be an object' });
          return;
        }
        checkKeySurface(seed, 'seed', p, 'a seed', reasons);
        if ('idType' in seed && !SEED_ID_TYPES.includes(seed.idType)) {
          reasons.push({
            path: `${p}.idType`,
            reason: `"idType" must be one of ${SEED_ID_TYPES.join(', ')}`,
          });
        }
        checkNonEmptyString(seed, 'id', p, reasons);
        checkNonEmptyString(seed, 'title', p, reasons);
      });
    }
  }

  return { ok: reasons.length === 0, reasons };
}

/** Child node kinds per parent kind — drives the type-directed canonical walk. */
const CHILD_KINDS = {
  artifact: {
    scope: 'scope',
    branches: ['branch'],
    sourcesToBeat: ['sourceToBeat'],
    foresight: 'foresight',
    seeds: ['seed'],
  },
  scope: { anchors: ['anchor'] },
  branch: { anchors: ['anchor'] },
  sourceToBeat: { anchors: ['anchor'] },
  foresight: { anchors: ['anchor'] },
  seed: {},
  anchor: {},
};

/** Deterministic fallback for values outside the schema walk: sort object keys. */
function genericCanon(value) {
  if (Array.isArray(value)) return value.map(genericCanon);
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = genericCanon(value[key]);
  return out;
}

function canonNode(value, kind) {
  if (!isPlainObject(value)) return genericCanon(value);
  const order = CANONICAL_KEY_ORDER[kind];
  const known = order.filter((k) => k in value);
  const unknown = Object.keys(value).filter((k) => !order.includes(k)).sort();
  const out = {};
  for (const key of [...known, ...unknown]) {
    const childKind = CHILD_KINDS[kind][key];
    const v = value[key];
    if (Array.isArray(childKind) && Array.isArray(v)) {
      out[key] = v.map((el) => canonNode(el, childKind[0]));
    } else if (typeof childKind === 'string') {
      out[key] = canonNode(v, childKind);
    } else {
      out[key] = genericCanon(v);
    }
  }
  return out;
}

/**
 * Return a NEW artifact with every level's keys in the schema's canonical order
 * (CANONICAL_KEY_ORDER). Never mutates its input; deterministic for any input
 * (schema-unknown keys, rejected by validation anyway, sort lexicographically after
 * the known keys). Byte-stable serialization is guaranteed for schema-valid artifacts.
 *
 * @param {unknown} artifact
 * @returns {unknown} canonically-ordered deep copy
 */
export function canonicalizePlanArtifact(artifact) {
  return canonNode(artifact, 'artifact');
}

/**
 * Canonical byte-stable serialization: two artifacts with the same content in any key
 * order stringify byte-identically.
 *
 * @param {unknown} artifact
 * @returns {string}
 */
export function canonicalStringifyPlanArtifact(artifact) {
  return JSON.stringify(canonicalizePlanArtifact(artifact), null, 2);
}
