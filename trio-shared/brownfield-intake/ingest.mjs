// trio-shared/brownfield-intake/ingest.mjs — Wave 7: opt-in brownfield content ingest.
//
// Ingests arbitrary provided content — folders, docs, half-finished drafts, loose
// notes AND papers — into per-item ingest records with PER-ITEM PROVENANCE: a stable
// source id, the file's real path, the kept span offsets, and the token estimate, so
// every anchor the grounded summary (./groundedSummary.mjs) later emits can be traced
// back through the item to the exact bytes of a named source file (verbatim span
// anchors threaded intake -> summary).
//
// Every byte routes ENTIRELY through the Wave-6 floor — no second security or budget
// site exists here:
//
//   - ./trustBoundary.mjs — file-set resolution and every read run offline with
//     real-path-within-root enforcement; symlink escapes, traversal, and absolute
//     requests are rejected with named security reasons and contribute ZERO bytes;
//   - ./intakeBudget.mjs — the pre-flight budget decision happens at the door:
//     fail-fast (the caller must not summarize; items is empty) or explicit
//     deterministic auto-truncate carrying the TRUNCATED stamp, never a prompt.
//
// Intake is STRICTLY OPT-IN: with no declared roots (or an empty resolved set) the
// result carries contentPresent=false and zero items — and brownfield CONTENT is the
// SOLE trigger for a Gandalf call (./groundedSummary.mjs enforces that seeds/intent
// NEVER trigger intake). Pure apart from trust-boundary file reads; synchronous; total
// in the module's established style (throws only on caller programming errors).

import { resolveIngestFileSet, readIngestFile } from './trustBoundary.mjs';
import { preflightIntakeBudget } from './intakeBudget.mjs';

export const INGEST_VERSION = 'brownfield-intake/ingest/1';

/** Advisory item kinds for display/telemetry. NEVER a gate: every kind ingests the same way. */
export const ITEM_KINDS = Object.freeze(['note', 'draft', 'doc', 'paper']);

/**
 * Deterministic, advisory kind classification from the root-relative path alone
 * (filename hints first, then extension). Display metadata only — no ingest behavior
 * branches on it.
 *
 * @param {string} relPath Root-relative posix path.
 * @returns {'note'|'draft'|'doc'|'paper'}
 */
export function classifyItemKind(relPath) {
  if (typeof relPath !== 'string') {
    throw new TypeError('classifyItemKind: relPath must be a string');
  }
  const base = relPath.split('/').pop().toLowerCase();
  if (base.includes('draft')) return 'draft';
  if (base.includes('note')) return 'note';
  if (base.includes('paper') || base.includes('abstract') || /\.(pdf|tex|bib)$/.test(base)) {
    return 'paper';
  }
  if (base.endsWith('.txt')) return 'note';
  return 'doc';
}

/**
 * The stable per-item source id: declared-root index + root-relative posix path.
 * Deterministic across runs and unique across roots (two roots may hold the same
 * relative path). This exact id is what summary anchors name.
 *
 * @param {number} rootIndex Index of the declared root the item belongs to.
 * @param {string} relPath Root-relative posix path.
 * @returns {string}
 */
export function makeSourceId(rootIndex, relPath) {
  if (!Number.isInteger(rootIndex) || rootIndex < 0 || typeof relPath !== 'string') {
    throw new TypeError('makeSourceId: rootIndex must be a non-negative integer and relPath a string');
  }
  return `r${rootIndex}/${relPath}`;
}

/** Unambiguous (root, path) map key — JSON-encoded so no separator can ever collide. */
function entryKey(root, relPath) {
  return JSON.stringify([root, relPath]);
}

/**
 * @typedef {object} IngestItem
 * @property {string} sourceId Stable source id (makeSourceId(rootIndex, path)).
 * @property {'note'|'draft'|'doc'|'paper'} kind Advisory display kind.
 * @property {string} root The declared root's REAL path.
 * @property {number} rootIndex Index of the declared root, in declared order.
 * @property {string} path Root-relative posix path (the named source FILE).
 * @property {string} realPath The file's verified REAL path (provenance back to bytes).
 * @property {string} text The kept text (full file, or the budget's head-of-file span).
 * @property {number} tokens Estimated tokens of the kept text.
 * @property {{ start: number, end: number }} span Char offsets of the kept span within
 *   the raw file — summary anchors offset into `text`; `span.start + anchorStart` is
 *   the absolute raw-file offset (the intake -> summary provenance thread).
 * @property {boolean} headOnly True iff only a head-of-file span survived the budget.
 */

/**
 * Ingest the declared roots into per-item records, entirely through the Wave-6 trust
 * boundary and budget floor. No Gandalf call happens here or anywhere downstream unless
 * the returned items are non-empty (content is the sole trigger — opt-in).
 *
 * @param {object} [options]
 * @param {string[]} [options.roots] Declared ingest roots, in declared order. Empty
 *   means NO brownfield content was provided (contentPresent=false, zero items).
 * @param {string[]} [options.requests] Explicit root-relative path requests (resolved
 *   against the first root through the same boundary checks).
 * @param {number} [options.budgetTokens] Intake token budget override.
 * @param {boolean} [options.autoTruncate] EXPLICIT opt-in to deterministic truncation.
 * @returns {Readonly<{
 *   ingestVersion: string,
 *   ok: boolean,
 *   decision: 'no-content'|'within-budget'|'fail-fast'|'auto-truncate',
 *   contentPresent: boolean,
 *   items: ReadonlyArray<IngestItem>,
 *   rejected: Array<{ path: string, reason: string, detail?: string }>,
 *   dropped: Array<{ root: string, path: string }>,
 *   estimatedTokens: number,
 *   keptTokens: number,
 *   budgetTokens: number|null,
 *   truncated: boolean,
 *   stamp: object|null,
 *   reason: string|null,
 * }>} ok is false ONLY on a fail-fast budget decision (the caller stops at the door).
 */
export function ingestContent({ roots = [], requests = [], budgetTokens, autoTruncate = false } = {}) {
  if (!Array.isArray(roots) || roots.some((r) => typeof r !== 'string')) {
    throw new TypeError('ingestContent: roots must be an array of strings');
  }

  const fileSet = resolveIngestFileSet({ roots, requests });
  const rejected = [...fileSet.rejected];

  // Read the resolved entries' bytes — readIngestFile is the trust boundary's ONLY
  // byte-reading path and re-verifies real-path-within-root at read time.
  /** @type {Array<{ entry: object, text: string }>} */
  const reads = [];
  for (const entry of fileSet.files) {
    const read = readIngestFile(entry.root, entry.path);
    if (read.ok) reads.push({ entry, text: read.text });
    else rejected.push(read.rejection);
  }

  if (reads.length === 0) {
    return Object.freeze({
      ingestVersion: INGEST_VERSION,
      ok: true,
      decision: 'no-content',
      contentPresent: false,
      items: Object.freeze([]),
      rejected,
      dropped: [],
      estimatedTokens: 0,
      keptTokens: 0,
      budgetTokens: budgetTokens ?? null,
      truncated: false,
      stamp: null,
      reason: null,
    });
  }

  // The budget floor works in REAL-root space (the trust boundary already realpath'd
  // every entry). Preserve declared-root ORDER: real roots listed by original rootIndex.
  const realRootByIndex = [];
  const entryByKey = new Map();
  for (const { entry } of reads) {
    realRootByIndex[entry.rootIndex] = entry.root;
    entryByKey.set(entryKey(entry.root, entry.path), entry);
  }
  const budgetRoots = realRootByIndex.filter((r) => typeof r === 'string');

  const budget = preflightIntakeBudget({
    roots: budgetRoots,
    files: reads.map(({ entry, text }) => ({ root: entry.root, path: entry.path, text })),
    ...(budgetTokens === undefined ? {} : { budgetTokens }),
    autoTruncate,
  });

  if (budget.decision === 'fail-fast') {
    return Object.freeze({
      ingestVersion: INGEST_VERSION,
      ok: false,
      decision: 'fail-fast',
      contentPresent: false,
      items: Object.freeze([]),
      rejected,
      dropped: [],
      estimatedTokens: budget.estimatedTokens,
      keptTokens: 0,
      budgetTokens: budget.budgetTokens,
      truncated: false,
      stamp: null,
      reason: budget.reason,
    });
  }

  const items = budget.files.map((kept) => {
    const entry = entryByKey.get(entryKey(kept.root, kept.path));
    return Object.freeze({
      sourceId: makeSourceId(entry.rootIndex, kept.path),
      kind: classifyItemKind(kept.path),
      root: kept.root,
      rootIndex: entry.rootIndex,
      path: kept.path,
      realPath: entry.realPath,
      text: kept.text,
      tokens: kept.tokens,
      span: { start: kept.span.start, end: kept.span.end },
      headOnly: kept.headOnly,
    });
  });

  return Object.freeze({
    ingestVersion: INGEST_VERSION,
    ok: true,
    decision: budget.decision,
    contentPresent: items.length > 0,
    items: Object.freeze(items),
    rejected,
    dropped: budget.decision === 'auto-truncate' ? budget.dropped : [],
    estimatedTokens: budget.estimatedTokens,
    keptTokens: budget.decision === 'auto-truncate' ? budget.keptTokens : budget.estimatedTokens,
    budgetTokens: budget.budgetTokens,
    truncated: budget.truncated,
    stamp: budget.decision === 'auto-truncate' ? budget.stamp : null,
    reason: null,
  });
}

/**
 * Is brownfield content present in an ingest result? THE opt-in predicate: a true
 * return is the only thing that may ever lead to a Gandalf call.
 *
 * @param {unknown} ingestResult
 * @returns {boolean}
 */
export function hasBrownfieldContent(ingestResult) {
  return Boolean(
    ingestResult &&
      typeof ingestResult === 'object' &&
      Array.isArray(ingestResult.items) &&
      ingestResult.items.length > 0,
  );
}
