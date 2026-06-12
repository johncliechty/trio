// drivers/reliability.mjs — Foreman Wave 1 (Phase A, part 1): the RELIABILITY
// WRAPPER applied at the agent-injection boundary.
//
// `makeReliableAgent({ agent })` wraps an injected `agent(prompt, opts) => Promise`
// seam with two behaviors, and nothing else:
//
//   (1) TYPED retry. When an inner call throws a TRANSPORT fault, the fault is
//       classified through the Wave-7 taxonomy `classifyExit()` (REUSED verbatim
//       from foreman/bin/transport.mjs — never re-derived here) to obtain
//       `{ class, recoverable }`. The wrapper retries the SAME call with backoff
//       IFF `recoverable === true`, up to `maxAttempts`; a non-recoverable fault
//       (a genuine error, a missing binary, an unannotated logic error) is NEVER
//       retried — it propagates on the first throw.
//
//   (2) ROUND-AWARE idempotency. A logical call is keyed by (round, role,
//       call-sequence). The key memoizes the in-flight/settled call so a duplicate
//       dispatch of ONE logical call returns the SAME promise — zero double
//       execution of the underlying agent. Transport-level retries (1) live INSIDE
//       a single logical call, so a retried call still resolves exactly once.
//       Crucially `round` is the OUTERMOST scope of the key: two same-prompt,
//       same-role calls in DIFFERENT rounds are DIFFERENT logical calls and BOTH
//       execute — there is NO cross-round dedup (this is what protects the
//       multi-round Synthesizer-brief delivery; a retry must never silently stand
//       in for a fresh round's call).
//
// The wrapper is TRANSPARENT on the success path: with no fault and no explicit
// call-sequence/idempotency key it invokes the inner agent exactly once, with the
// prompt + opts unchanged, and returns its result as-is. So applying it at an
// injection site never perturbs the wrapped seam's observable behavior — it only
// adds resilience on faults.

import { classifyExit } from '../foreman/bin/transport.mjs';

/**
 * Classify a thrown fault through the Wave-7 transport taxonomy and report whether
 * a retry could plausibly succeed. REUSES `classifyExit` as the single source of
 * truth — this function only adapts a thrown error onto its input shape:
 *
 *   - `err.classification` — a precomputed `{ class, recoverable }` (e.g. attached
 *     by the live transport): trusted as-is.
 *   - `err.exit` — a `classifyExit()` INPUT object
 *     (`{ spawnError, timedOut, code, signal, finalEnv }`): routed through it.
 *   - anything else — routed through `classifyExit({})`, which (by the taxonomy's
 *     totality) yields `unknown` / `recoverable:false`: an unannotated error is NOT
 *     a recognized recoverable transport fault, so it is never blindly retried.
 *
 * @param {*} err
 * @returns {{ class:string, recoverable:boolean }}
 */
export function classifyFault(err) {
  if (err && typeof err === 'object') {
    const pre = err.classification;
    if (pre && typeof pre === 'object' && typeof pre.recoverable === 'boolean') {
      return { class: pre.class, recoverable: pre.recoverable };
    }
    const input = err.exit && typeof err.exit === 'object' ? err.exit : null;
    if (input) {
      const c = classifyExit(input);
      return { class: c.class, recoverable: c.recoverable };
    }
  }
  const c = classifyExit({}); // totality backstop -> unknown / non-recoverable
  return { class: c.class, recoverable: c.recoverable };
}

/** The round-aware idempotency key. `round` is OUTERMOST so a key never spans rounds. */
export function idempotencyKey({ round = null, role = null, seq = null } = {}) {
  return `round=${JSON.stringify(round)}|role=${JSON.stringify(role)}|seq=${JSON.stringify(seq)}`;
}

/**
 * Wrap an injected agent seam with typed retry + round-aware idempotency.
 *
 * @param {object}   o
 * @param {Function} o.agent                       the injected `agent(prompt, opts)` seam
 * @param {number}   [o.maxAttempts=3]             1 initial try + (maxAttempts-1) retries
 * @param {number}   [o.baseDelayMs=200]           base for the default exponential backoff
 * @param {Function} [o.backoff]                   `(attemptN) => ms` (attemptN starts at 1)
 * @param {Function} [o.sleep]                     `(ms) => Promise` (injectable for tests)
 * @param {Function} [o.classify=classifyFault]    `(err) => { class, recoverable }`
 * @param {Function} [o.log=()=>{}]
 * @returns {(prompt:string, opts?:object)=>Promise<any>} the reliability-wrapped seam
 */
export function makeReliableAgent({
  agent,
  maxAttempts = 3,
  baseDelayMs = 200,
  backoff = (attemptN) => baseDelayMs * 2 ** (attemptN - 1),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  classify = classifyFault,
  log = () => {},
} = {}) {
  if (typeof agent !== 'function') {
    throw new TypeError('makeReliableAgent requires an agent() function');
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new TypeError('makeReliableAgent: maxAttempts must be a positive integer');
  }

  // key -> the in-flight/settled promise for that ONE logical call (the idempotency
  // memo). A logical call without an explicit call-sequence gets a fresh per-call
  // sequence, so distinct dispatches never collide — dedup is opt-in via a stable
  // (round, role, seq) tuple, exactly scoping it to "transport retries of one call".
  const inflight = new Map();
  let autoSeq = 0;

  // One logical call: run the inner agent with typed-retry + backoff. Retries here
  // are the SAME logical call (one memo entry), so a retried call resolves once.
  async function runOnce(prompt, opts) {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await agent(prompt, opts);
      } catch (err) {
        const { class: cls, recoverable } = classify(err);
        if (!recoverable) {
          // Non-recoverable: never retry — propagate on the first throw.
          throw err;
        }
        if (attempt >= maxAttempts) {
          log(`reliability: ${cls} still failing after ${attempt} attempt(s) — giving up`);
          throw err;
        }
        const waitMs = backoff(attempt);
        log(`reliability: recoverable ${cls} on attempt ${attempt} — retrying after ${waitMs}ms backoff`);
        await sleep(waitMs);
      }
    }
  }

  return function reliableAgent(prompt, opts = {}) {
    // Round-aware idempotency key. An explicit call-sequence (opts.seq /
    // opts.callSeq / opts.idempotencyKey) makes the key STABLE across dispatches
    // (so duplicates of one logical call dedup); absent one, a fresh sequence keeps
    // every dispatch distinct (transparent — no accidental dedup of real calls).
    const explicitSeq = opts.seq ?? opts.callSeq ?? opts.idempotencyKey;
    const seq = explicitSeq !== undefined && explicitSeq !== null ? explicitSeq : `auto#${autoSeq++}`;
    const key = idempotencyKey({ round: opts.round ?? null, role: opts.role ?? null, seq });

    const existing = inflight.get(key);
    if (existing) return existing; // dedup: zero double-execution of one logical call

    const p = runOnce(prompt, opts);
    inflight.set(key, p);
    // Evict on rejection so a permanently-failed key is not cached as a poison
    // pill — a later, legitimately fresh attempt of that logical call may run. A
    // FULFILLED call stays memoized (that is the idempotency guarantee).
    p.then(null, () => { inflight.delete(key); });
    return p;
  };
}

export default makeReliableAgent;
