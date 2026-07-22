// trio-shared/brownfield-intake/verbatimAnchorCheck.mjs — Wave 4: the deterministic
// VERBATIM-ANCHOR check.
//
// The model AUTHORS its own anchors at derive/re-derive time; deterministic code NEVER
// does semantic span->slot matching. This module only CHECKS, word-for-word, that each
// model-emitted anchor's `quote` appears verbatim in the grounded text of its named
// `sourceId` (the grounded summary or seed text supplied by the caller).
//
// "Word-for-word" is DEFINED (IMPLEMENTATION-PLAN Wave 4) as ALL of:
//   (a) the collapsed quote is at least DEFAULT_MIN_QUOTE_LENGTH characters —
//       reusing literature-review's existing minimum (src/quoteExtractor.mjs:14,
//       value 10); a sub-minimum span is an anchor FAILURE, not a pass;
//   (b) the quote, with every whitespace run collapsed to a single space, appears as a
//       contiguous substring of the source text collapsed the same way, with the match
//       TOKEN-BOUNDARY-ALIGNED in the collapsed source (no mid-word fragments): the
//       character before the match start and after the match end, when present, must
//       not be a word character (letter or digit) — a mid-word span is an anchor
//       FAILURE, not a pass.
// Every non-whitespace character must match exactly — case, punctuation, and diacritics
// are all significant. No case folding, no fuzzy matching, no paraphrase tolerance,
// no semantic matching of any kind.
//
// Pure and total: never throws, whatever the input shape. Structural conformance
// (anchors present, non-empty strings) is the schema validator's job
// (./validatePlanArtifact.mjs) — this check runs AFTER the schema passes and walks the
// artifact defensively.

/**
 * Minimum collapsed-quote length for a groundable anchor. Mirrors literature-review's
 * `DEFAULT_MIN_QUOTE_LENGTH` (src/quoteExtractor.mjs:14) BY VALUE — the shared module
 * cannot import the skill's src/ (both skills consume this module, never the reverse),
 * so the parity is pinned by a literature-review test instead.
 */
export const DEFAULT_MIN_QUOTE_LENGTH = 10;

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function collapseWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

function isWordChar(ch) {
  return typeof ch === 'string' && WORD_CHAR.test(ch);
}

/**
 * Classify `quote` against `sourceText` under the word-for-word definition above.
 * Deterministic and total; the reason names WHICH rule failed.
 *
 * @param {unknown} quote
 * @param {unknown} sourceText
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function classifyVerbatimSpan(quote, sourceText) {
  if (typeof quote !== 'string' || typeof sourceText !== 'string') {
    return { ok: false, reason: 'quote and source text must both be strings' };
  }
  const needle = collapseWhitespace(quote);
  if (needle === '') {
    return { ok: false, reason: 'empty/blank quote never matches' };
  }
  if (needle.length < DEFAULT_MIN_QUOTE_LENGTH) {
    return {
      ok: false,
      reason:
        `collapsed quote is ${needle.length} characters — shorter than the minimum groundable ` +
        `span (DEFAULT_MIN_QUOTE_LENGTH = ${DEFAULT_MIN_QUOTE_LENGTH}); a sub-minimum span is an anchor failure`,
    };
  }
  const haystack = collapseWhitespace(sourceText);
  let found = false;
  for (let idx = haystack.indexOf(needle); idx !== -1; idx = haystack.indexOf(needle, idx + 1)) {
    found = true;
    if (!isWordChar(haystack[idx - 1]) && !isWordChar(haystack[idx + needle.length])) {
      return { ok: true };
    }
  }
  if (found) {
    return {
      ok: false,
      reason:
        'quote occurs only as a mid-word fragment of the collapsed source — the match is not ' +
        'token-boundary-aligned; a mid-word span is an anchor failure',
    };
  }
  return {
    ok: false,
    reason:
      'quote is not a word-for-word span of the grounded text for this sourceId ' +
      '(only whitespace differences are tolerated; no semantic matching)',
  };
}

/**
 * Is `quote` a word-for-word span of `sourceText` under the full definition —
 * whitespace-run-insensitive contiguous substring, every non-whitespace character
 * exact, at least DEFAULT_MIN_QUOTE_LENGTH collapsed characters, token-boundary-aligned
 * (no mid-word fragments)? Empty/blank quotes never match.
 *
 * @param {unknown} quote
 * @param {unknown} sourceText
 * @returns {boolean}
 */
export function isVerbatimSpan(quote, sourceText) {
  return classifyVerbatimSpan(quote, sourceText).ok;
}

/** Look up a sourceId's grounded text in a Map or plain-object corpus (own keys only). */
function sourceTextFor(groundedSources, sourceId) {
  if (groundedSources instanceof Map) return groundedSources.get(sourceId);
  if (isPlainObject(groundedSources) && typeof sourceId === 'string' && Object.hasOwn(groundedSources, sourceId)) {
    return groundedSources[sourceId];
  }
  return undefined;
}

/**
 * @typedef {object} AnchorFailure
 * @property {string} path Dotted path of the offending anchor (e.g. 'branches[0].anchors[1]').
 * @property {string|null} sourceId The anchor's claimed source id (null if not a string).
 * @property {string|null} quote The anchor's claimed quote (null if not a string).
 * @property {string} reason Why the anchor failed the word-for-word check.
 */

/**
 * @typedef {object} AnchorCheckResult
 * @property {boolean} ok True iff EVERY anchor on every anchored element quotes its
 *   named grounded source word-for-word.
 * @property {AnchorFailure[]} failures Empty on pass; one entry per failing anchor.
 */

/**
 * Deterministically check every model-emitted anchor on a PlanArtifact against the
 * grounded texts. Anchored elements are scope, each branch, each source-to-beat, and
 * the foresight receipt; seeds are user-supplied identity and carry no anchors by
 * design, so they are never walked.
 *
 * @param {unknown} artifact A (schema-validated) PlanArtifact candidate.
 * @param {Map<string,string>|Record<string,string>} groundedSources sourceId -> the
 *   grounded summary / seed text that anchors may quote from.
 * @returns {AnchorCheckResult}
 */
export function verbatimAnchorCheck(artifact, groundedSources) {
  /** @type {AnchorFailure[]} */
  const failures = [];

  if (!isPlainObject(artifact)) {
    return {
      ok: false,
      failures: [
        { path: 'artifact', sourceId: null, quote: null, reason: 'not a plan-artifact object' },
      ],
    };
  }

  /** @type {Array<[string, object]>} */
  const elements = [];
  if (isPlainObject(artifact.scope)) elements.push(['scope', artifact.scope]);
  if (Array.isArray(artifact.branches)) {
    artifact.branches.forEach((branch, i) => {
      if (isPlainObject(branch)) elements.push([`branches[${i}]`, branch]);
    });
  }
  if (Array.isArray(artifact.sourcesToBeat)) {
    artifact.sourcesToBeat.forEach((source, i) => {
      if (isPlainObject(source)) elements.push([`sourcesToBeat[${i}]`, source]);
    });
  }
  if (isPlainObject(artifact.foresight)) elements.push(['foresight', artifact.foresight]);

  for (const [elementPath, element] of elements) {
    const anchors = Array.isArray(element.anchors) ? element.anchors : [];
    anchors.forEach((anchor, i) => {
      const path = `${elementPath}.anchors[${i}]`;
      if (!isPlainObject(anchor)) {
        failures.push({ path, sourceId: null, quote: null, reason: 'anchor is not an object' });
        return;
      }
      const sourceId = typeof anchor.sourceId === 'string' ? anchor.sourceId : null;
      const quote = typeof anchor.quote === 'string' ? anchor.quote : null;
      const text = sourceTextFor(groundedSources, anchor.sourceId);
      if (typeof text !== 'string') {
        failures.push({
          path,
          sourceId,
          quote,
          reason: `unknown sourceId "${String(anchor.sourceId)}" — no grounded text to quote from`,
        });
        return;
      }
      const spanResult = classifyVerbatimSpan(anchor.quote, text);
      if (!spanResult.ok) {
        failures.push({ path, sourceId, quote, reason: spanResult.reason });
      }
    });
  }

  return { ok: failures.length === 0, failures };
}
