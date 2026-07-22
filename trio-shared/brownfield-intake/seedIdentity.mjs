// trio-shared/brownfield-intake/seedIdentity.mjs — Wave 6: strict seed-identity
// validation with the pinned precedence DOI -> PMID -> arXiv-id -> normalized-title-hash.
//
// Seeds are user-supplied identity that crosses a process boundary (Wave 10 hands them
// to snowball/PRISMA child processes), so this module is the mandatory checkpoint
// BEFORE any child-process handoff: only identifiers that pass STRICT per-type format
// validation may be handed off; a malformed identifier is rejected with a named reason
// and contributes nothing downstream. arXiv ids are ADMITTED to strict validation
// (new-style `2203.15556[vN]` and old-style `hep-th/9901001[vN]`), per the plan.
//
// The precedence order and the admitted idType tokens are the schema's own
// (planArtifact.schema.mjs SEED_ID_TYPES) — one source of truth, no drift. The title
// normalization spec is PINNED here (NFKC -> lowercase -> every non-alphanumeric run
// becomes one space -> trim) and snapshot-frozen by test/seed-identity.test.mjs;
// changing it changes title-hash identities and requires a plan amendment.
//
// Validation is total: validateSeed / validateSeedsForHandoff return structured
// pass/fail and never throw on bad DATA (throwing is reserved for caller programming
// errors), matching validatePlanArtifact.mjs.

import crypto from 'node:crypto';

import { SEED_ID_TYPES } from './planArtifact.schema.mjs';

/** The pinned identity precedence, highest first: doi, pmid, arxiv, title-hash. */
export const SEED_ID_PRECEDENCE = SEED_ID_TYPES;

/**
 * Strict per-type formats, applied AFTER per-type normalization.
 * @type {Readonly<Record<string, RegExp>>}
 */
export const SEED_ID_FORMATS = Object.freeze({
  doi: /^10\.\d{4,9}\/\S+$/,
  pmid: /^[1-9]\d{0,7}$/,
  // New-style (2007+) `YYMM.NNNN[N][vN]` OR old-style `archive[.SC]/YYMMNNN[vN]`.
  arxiv: /^(\d{4}\.\d{4,5}(v\d+)?|[a-z]+(?:[.-][a-z]+)*\/\d{7}(v\d+)?)$/,
  'title-hash': /^[0-9a-f]{64}$/,
});

/** Prefixes stripped (case-insensitively) before strict validation, per type. */
const ID_PREFIXES = Object.freeze({
  doi: [/^doi:\s*/i, /^https?:\/\/(dx\.)?doi\.org\//i],
  pmid: [/^pmid:\s*/i],
  arxiv: [/^arxiv:\s*/i, /^https?:\/\/arxiv\.org\/abs\//i],
  'title-hash': [],
});

/**
 * The PINNED title normalization: Unicode NFKC, lowercase, every run of
 * non-alphanumeric characters collapsed to a single space, trimmed. This exact string
 * is what gets hashed for a title-hash identity — snapshot-frozen by the Wave-6 test.
 *
 * @param {string} title
 * @returns {string}
 */
export function normalizeTitleForHash(title) {
  if (typeof title !== 'string') {
    throw new TypeError('normalizeTitleForHash: title must be a string');
  }
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * The title-hash identity for a title: sha256 hex of the pinned normalized form.
 * @param {string} title
 * @returns {string}
 */
export function titleHashFor(title) {
  return crypto.createHash('sha256').update(normalizeTitleForHash(title), 'utf8').digest('hex');
}

/** Normalize a raw identifier for its type (prefix-strip + case) WITHOUT validating it. */
export function normalizeSeedId(idType, rawId) {
  if (typeof rawId !== 'string') return rawId;
  let id = rawId.trim();
  for (const prefix of ID_PREFIXES[idType] ?? []) id = id.replace(prefix, '');
  if (idType === 'doi' || idType === 'arxiv' || idType === 'title-hash') id = id.toLowerCase();
  return id;
}

/**
 * @typedef {object} ValidatedSeed
 * @property {('doi'|'pmid'|'arxiv'|'title-hash')} idType
 * @property {string} id The normalized, strictly-validated identifier.
 * @property {string} title The seed's human-readable title (trimmed).
 */

/**
 * Strictly validate ONE seed. Total: returns pass/fail, never throws on bad data.
 *
 * @param {unknown} seed Candidate `{ idType, id, title }`.
 * @returns {{ ok: true, seed: Readonly<ValidatedSeed> }
 *   | { ok: false, rejection: { seed: unknown, reason: string } }}
 */
export function validateSeed(seed) {
  const fail = (reason) => ({ ok: false, rejection: { seed, reason } });
  if (typeof seed !== 'object' || seed === null || Array.isArray(seed)) {
    return fail('seed must be an object { idType, id, title }');
  }
  const { idType, id, title } = seed;
  if (!SEED_ID_PRECEDENCE.includes(idType)) {
    return fail(`unknown idType "${String(idType)}" — must be one of ${SEED_ID_PRECEDENCE.join(', ')}`);
  }
  if (typeof title !== 'string' || title.trim() === '') {
    return fail('seed title must be a non-empty string');
  }
  if (typeof id !== 'string' || id.trim() === '') {
    return fail(`missing ${idType} identifier value`);
  }
  const normalized = normalizeSeedId(idType, id);
  if (!SEED_ID_FORMATS[idType].test(normalized)) {
    return fail(
      `malformed ${idType} identifier "${id}" — fails strict ${idType} format validation ` +
        '(rejected before any child-process handoff)',
    );
  }
  if (idType === 'title-hash' && normalized !== titleHashFor(title)) {
    return fail(
      'title-hash identifier does not equal the sha256 of the pinned normalized title — ' +
        'a title-hash identity is always derived, never free-form',
    );
  }
  return { ok: true, seed: Object.freeze({ idType, id: normalized, title: title.trim() }) };
}

/**
 * Derive ONE seed identity from whatever identifiers the caller supplies, under the
 * pinned precedence doi -> pmid -> arxiv -> title-hash. STRICT, no silent fallthrough:
 * if a higher-precedence identifier is SUPPLIED but malformed, the seed is REJECTED —
 * it never silently degrades to a lower-precedence identity. With no doi/pmid/arxiv
 * supplied, the identity is the normalized-title-hash derived from the title.
 *
 * @param {object} raw `{ doi?, pmid?, arxiv?, title }`.
 * @returns {{ ok: true, seed: Readonly<ValidatedSeed> }
 *   | { ok: false, rejection: { seed: unknown, reason: string } }}
 */
export function deriveSeedIdentity(raw) {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, rejection: { seed: raw, reason: 'seed input must be an object' } };
  }
  const { title } = raw;
  for (const idType of ['doi', 'pmid', 'arxiv']) {
    const supplied = raw[idType];
    if (supplied === undefined || supplied === null || supplied === '') continue;
    return validateSeed({ idType, id: supplied, title });
  }
  if (typeof title !== 'string' || title.trim() === '') {
    return {
      ok: false,
      rejection: { seed: raw, reason: 'seed carries no identifier and no title to hash' },
    };
  }
  return validateSeed({ idType: 'title-hash', id: titleHashFor(title), title });
}

/** Deterministic identity key for cross-seed dedupe (Wave 10 consumes this). */
export function seedIdentityKey(seed) {
  return `${seed.idType}:${seed.id}`;
}

/**
 * Compare two seeds by the pinned identity precedence (lower return = higher
 * precedence). Ties broken by the normalized id — deterministic, never fuzzy.
 */
export function compareSeedPrecedence(a, b) {
  const pa = SEED_ID_PRECEDENCE.indexOf(a.idType);
  const pb = SEED_ID_PRECEDENCE.indexOf(b.idType);
  if (pa !== pb) return pa - pb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The mandatory pre-handoff checkpoint: strictly validate EVERY seed destined for a
 * child process. Only the returned `seeds` (normalized, frozen) may be handed off;
 * every malformed seed lands in `rejected` with a named reason and must be surfaced,
 * never forwarded. `ok` is true iff nothing was rejected.
 *
 * @param {unknown[]} seeds Candidate seeds `{ idType, id, title }`.
 * @returns {{ ok: boolean, seeds: ReadonlyArray<Readonly<ValidatedSeed>>,
 *   rejected: Array<{ seed: unknown, reason: string }> }}
 */
export function validateSeedsForHandoff(seeds) {
  if (!Array.isArray(seeds)) {
    throw new TypeError('validateSeedsForHandoff: seeds must be an array');
  }
  const validated = [];
  const rejected = [];
  for (const seed of seeds) {
    const res = validateSeed(seed);
    if (res.ok) validated.push(res.seed);
    else rejected.push(res.rejection);
  }
  return { ok: rejected.length === 0, seeds: Object.freeze(validated), rejected };
}
