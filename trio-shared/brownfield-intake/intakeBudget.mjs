// trio-shared/brownfield-intake/intakeBudget.mjs — Wave 6: pre-flight token estimate +
// budget bounding for the shared brownfield-intake front-end.
//
// The budget decision happens UPFRONT, at the intake door, BEFORE any Gandalf call —
// never as a blocking mid-run prompt (there is no prompt anywhere in this module; every
// function is pure and synchronous):
//
//   - over budget, no auto-truncate flag  -> FAIL FAST with a narrow-your-roots message;
//     the caller must not invoke Gandalf on a fail-fast decision;
//   - over budget, explicit autoTruncate  -> DETERMINISTIC truncation — declared roots
//     first (earlier-declared roots keep their content; the cut falls on later material),
//     stable path sort within a root, and a head-of-file span for the file the budget
//     boundary lands in — and the decision carries a TRUNCATED stamp the artifact must
//     surface (honesty posture: a truncated intake never presents as complete);
//   - within budget -> proceed unchanged.
//
// Token estimation is a pinned deterministic heuristic (ceil(chars / CHARS_PER_TOKEN)),
// good enough for bounding; exactness is not claimed anywhere.
//
// This module also OWNS the derive-context arithmetic every later wave cites.
// The identity accounts for the per-source data-fencing framing the trust boundary
// (Wave 6, trustBoundary.mjs) wraps around EVERY fenced block — a cost that scales
// with the NUMBER of sources, not their size — AND reserves window space for the
// fenced intent block the content route carries alongside the summary and for the
// derive call's OWN emission:
//   SUMMARY_MAX = DERIVE_CONTEXT - DERIVE_PROMPT_OVERHEAD - INTENT_CONTEXT_CAP
//                 - SEED_CONTEXT_CAP - DERIVE_OUTPUT_RESERVE
//                 - (FENCE_FRAMING_TOKENS * MAX_FENCED_BLOCKS)
// with DERIVE_OUTPUT_RESERVE >= ceil(DERIVE_MAX_OUTPUT_CHARS / CHARS_PER_TOKEN) and
// MAX_FENCED_BLOCKS enforced as a HARD cap on source count at the budget gate (on
// the LLM derive route AND the seeds-only bootstrap route), so the grounded summary
// (Wave 7) plus intent plus seed context plus all fence framing plus the emission
// fit the single bounded derive call BY CONSTRUCTION — the input never consumes the
// whole window and the output always has room.

/** Pinned chars-per-token heuristic divisor for the deterministic estimate. */
export const CHARS_PER_TOKEN = 4;

/** Token budget of the ONE bounded derive call's context window (Wave 8). */
export const DERIVE_CONTEXT = 200_000;

/** Tokens reserved for the derive call's own prompt/instructions. */
export const DERIVE_PROMPT_OVERHEAD = 8_000;

/** Cap on the fenced intent block the content route carries alongside the summary
 *  (and the intent-only route derives from) — reserved in the identity so a
 *  Wave-7-legal summary at SUMMARY_MAX plus an in-cap intent always fits (Wave 8). */
export const INTENT_CONTEXT_CAP = 4_000;

/** Cap on seed metadata/abstract context fed to the derive call (Wave 8). */
export const SEED_CONTEXT_CAP = 12_000;

/** Output budget cap for the ONE derive call's emission (chars; mirrors Wave 4's
 *  REDERIVE_MAX_OUTPUT_CHARS bound). */
export const DERIVE_MAX_OUTPUT_CHARS = 400_000;

/**
 * Window space reserved for the derive call's OWN emission:
 * DERIVE_OUTPUT_RESERVE >= ceil(DERIVE_MAX_OUTPUT_CHARS / CHARS_PER_TOKEN), so an
 * emission at the output cap always has room after the fenced input is sent.
 */
export const DERIVE_OUTPUT_RESERVE = Math.ceil(DERIVE_MAX_OUTPUT_CHARS / CHARS_PER_TOKEN);

/**
 * Nominal per-block cost (tokens) of the trust boundary's data-fencing framing
 * (trustBoundary.mjs fenceUntrustedData: injection-neutralizing preamble + hash-bound
 * open/close markers + block separators — ~660 chars + the sourceId, ~168 tokens at
 * CHARS_PER_TOKEN). Scales with the NUMBER of fenced blocks, not their size. The
 * derive budget gate ALSO verifies the ACTUAL emitted fenced payload, so an atypically
 * long sourceId can never quietly exceed this nominal constant.
 */
export const FENCE_FRAMING_TOKENS = 168;

/**
 * Hard cap on the number of fenced source blocks (summary + intent + seeds) a single
 * derive call may carry — enforced at the budget gate as a source-COUNT cap (on BOTH
 * the LLM derive route and the seeds-only bootstrap route) so fence framing (which
 * scales with count) stays bounded by construction.
 */
export const MAX_FENCED_BLOCKS = 32;

/**
 * Maximum grounded-summary size, defined so summary + prompt overhead + fenced
 * intent + seed context + all per-block fence framing + the derive call's own
 * emission fit the derive context by construction:
 * SUMMARY_MAX = DERIVE_CONTEXT - DERIVE_PROMPT_OVERHEAD - INTENT_CONTEXT_CAP
 *               - SEED_CONTEXT_CAP - DERIVE_OUTPUT_RESERVE
 *               - (FENCE_FRAMING_TOKENS * MAX_FENCED_BLOCKS).
 */
export const SUMMARY_MAX =
  DERIVE_CONTEXT -
  DERIVE_PROMPT_OVERHEAD -
  INTENT_CONTEXT_CAP -
  SEED_CONTEXT_CAP -
  DERIVE_OUTPUT_RESERVE -
  FENCE_FRAMING_TOKENS * MAX_FENCED_BLOCKS;

/**
 * Default pre-flight cap on TOTAL ingested content (tokens) fed to the Gandalf
 * summarize stage. Overridable per call (`budgetTokens`).
 */
export const DEFAULT_INTAKE_TOKEN_BUDGET = 150_000;

/** Stamp carried by every auto-truncate decision (and threaded onto the artifact). */
export const TRUNCATED_STAMP = 'brownfield-intake/truncated/1';

/**
 * Deterministic token estimate for a text: ceil(chars / CHARS_PER_TOKEN).
 * @param {string} text
 * @returns {number}
 */
export function estimateTokensForText(text) {
  if (typeof text !== 'string') {
    throw new TypeError('estimateTokensForText: text must be a string');
  }
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * @typedef {object} BudgetFileInput
 * @property {string} root The declared root this file belongs to (must be in `roots`).
 * @property {string} path Root-relative posix path (the stable sort key).
 * @property {string} text The file's full text (already read inside the trust boundary).
 */

/**
 * Impose the pinned deterministic truncation order: declared-root order first, then a
 * stable codepoint sort on the root-relative path. Pure; never mutates its input.
 *
 * @param {string[]} roots Declared roots, in declared order.
 * @param {BudgetFileInput[]} files
 * @returns {Array<BudgetFileInput & { rootIndex: number, tokens: number }>}
 */
export function orderFilesForBudget(roots, files) {
  if (!Array.isArray(roots) || roots.some((r) => typeof r !== 'string')) {
    throw new TypeError('orderFilesForBudget: roots must be an array of strings');
  }
  if (!Array.isArray(files)) {
    throw new TypeError('orderFilesForBudget: files must be an array');
  }
  const withKeys = files.map((file) => {
    if (typeof file !== 'object' || file === null || typeof file.text !== 'string') {
      throw new TypeError('orderFilesForBudget: each file must be { root, path, text }');
    }
    const rootIndex = roots.indexOf(file.root);
    if (rootIndex === -1) {
      throw new TypeError(`orderFilesForBudget: file root "${file.root}" is not a declared root`);
    }
    return { ...file, rootIndex, tokens: estimateTokensForText(file.text) };
  });
  return withKeys.sort(
    (a, b) => a.rootIndex - b.rootIndex || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
  );
}

/**
 * @typedef {object} KeptFileSpan
 * @property {string} root
 * @property {number} rootIndex
 * @property {string} path
 * @property {string} text The kept text (full file, or the head-of-file span).
 * @property {number} tokens Estimated tokens of the KEPT text.
 * @property {{ start: 0, end: number }} span Char offsets of the kept span.
 * @property {boolean} headOnly True iff only a head-of-file span survived.
 */

/**
 * The pre-flight budget decision. Pure and synchronous — NO prompt, NO approval wait,
 * NO network, NO Gandalf call: the caller acts on the returned decision.
 *
 * @param {object} options
 * @param {string[]} options.roots Declared roots, in declared order.
 * @param {BudgetFileInput[]} options.files The candidate ingest set.
 * @param {number} [options.budgetTokens] Token budget (default DEFAULT_INTAKE_TOKEN_BUDGET).
 * @param {boolean} [options.autoTruncate] EXPLICIT opt-in to deterministic truncation.
 * @returns {{ decision: 'within-budget', estimatedTokens: number, budgetTokens: number,
 *     files: KeptFileSpan[], truncated: false }
 *   | { decision: 'fail-fast', estimatedTokens: number, budgetTokens: number,
 *     reason: string, truncated: false }
 *   | { decision: 'auto-truncate', estimatedTokens: number, keptTokens: number,
 *     budgetTokens: number, files: KeptFileSpan[],
 *     dropped: Array<{ root: string, path: string }>, truncated: true,
 *     stamp: { truncated: true, stamp: string, reason: string } }}
 */
export function preflightIntakeBudget({
  roots,
  files,
  budgetTokens = DEFAULT_INTAKE_TOKEN_BUDGET,
  autoTruncate = false,
} = {}) {
  if (!Number.isInteger(budgetTokens) || budgetTokens <= 0) {
    throw new TypeError('preflightIntakeBudget: budgetTokens must be a positive integer');
  }
  const ordered = orderFilesForBudget(roots, files);
  const estimatedTokens = ordered.reduce((sum, f) => sum + f.tokens, 0);

  if (estimatedTokens <= budgetTokens) {
    return {
      decision: 'within-budget',
      estimatedTokens,
      budgetTokens,
      files: ordered.map((f) => ({
        root: f.root,
        rootIndex: f.rootIndex,
        path: f.path,
        text: f.text,
        tokens: f.tokens,
        span: { start: 0, end: f.text.length },
        headOnly: false,
      })),
      truncated: false,
    };
  }

  if (!autoTruncate) {
    return {
      decision: 'fail-fast',
      estimatedTokens,
      budgetTokens,
      reason:
        `pre-flight token estimate ${estimatedTokens} exceeds the intake budget of ` +
        `${budgetTokens} tokens — narrow your roots (declare fewer/smaller ingest roots ` +
        'or pass the explicit auto-truncate flag to keep a deterministic head of the ' +
        'declared content). Nothing was summarized; Gandalf was not called.',
      truncated: false,
    };
  }

  /** @type {KeptFileSpan[]} */
  const kept = [];
  /** @type {Array<{ root: string, path: string }>} */
  const dropped = [];
  let keptTokens = 0;
  for (const file of ordered) {
    const remaining = budgetTokens - keptTokens;
    if (remaining <= 0) {
      dropped.push({ root: file.root, path: file.path });
      continue;
    }
    if (file.tokens <= remaining) {
      kept.push({
        root: file.root,
        rootIndex: file.rootIndex,
        path: file.path,
        text: file.text,
        tokens: file.tokens,
        span: { start: 0, end: file.text.length },
        headOnly: false,
      });
      keptTokens += file.tokens;
    } else {
      // Head-of-file span: keep exactly the chars the remaining token budget covers.
      const keepChars = remaining * CHARS_PER_TOKEN;
      const text = file.text.slice(0, keepChars);
      const tokens = estimateTokensForText(text);
      kept.push({
        root: file.root,
        rootIndex: file.rootIndex,
        path: file.path,
        text,
        tokens,
        span: { start: 0, end: text.length },
        headOnly: true,
      });
      keptTokens += tokens;
    }
  }

  return {
    decision: 'auto-truncate',
    estimatedTokens,
    keptTokens,
    budgetTokens,
    files: kept,
    dropped,
    truncated: true,
    stamp: Object.freeze({
      truncated: true,
      stamp: TRUNCATED_STAMP,
      reason:
        `intake auto-truncated deterministically to fit the ${budgetTokens}-token budget ` +
        `(estimate was ${estimatedTokens}): declared-roots-first order, stable path sort, ` +
        `head-of-file spans; ${dropped.length} file(s) dropped, ` +
        `${kept.filter((f) => f.headOnly).length} kept head-only`,
    }),
  };
}
