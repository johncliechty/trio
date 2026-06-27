// drivers/index.mjs — the pluggable model-backend registry + the single `runAgent`
// seam the trio engines call. One interface, swappable backends:
//
//   runAgent({ prompt, schema, freshContext, driver })
//
// The backend is selected by (in order): an explicit `driver` argument, the
// `TRIO_DRIVER` env var, else the default `'claude'`. Wave 4 ships only the Claude
// backend (the existing `claude -p` behavior, untouched — the non-regression
// guarantee); Wave 5 adds gemini/openai/grok by calling `registerDriver(...)`.
//
// A driver is `{ name, subAgentCapable, runAgent({ prompt, schema, freshContext }) }`.
// `runAgent` returns the model's text by default, or a schema-validated object when
// `schema` is supplied (the Claude backend retries once then ABSTAINs).

import { HaltError } from '../foreman/bin/foreman-lib.mjs';
import { makeReliableAgent } from './reliability.mjs';
import { claudeDriver } from './claude.mjs';
import { geminiCliDriver } from './gemini-cli.mjs';
import { geminiDriver } from './gemini.mjs';
import { openaiDriver } from './openai.mjs';
import { grokDriver } from './grok.mjs';
import { defaultRunGemini, extractJson } from '../foreman/bin/drivers/driver-gemini.mjs';

export const geminiCliNativeDriver = {
  name: 'gemini-cli-native',
  subAgentCapable: true,
  structuredOutput: 'cli-subagent (prompt-suffix)',
  async runAgent(opts = {}) {
    const { prompt, schema, label, log = () => {} } = opts;
    const run = opts.runGemini || ((p, l) => defaultRunGemini(p, l, opts));
    
    const schemaSuffix = schema
      ? `\n\nRespond with ONLY a single raw JSON object (no markdown fences, no prose) ` +
        `that conforms to this JSON Schema:\n${JSON.stringify(schema)}`
      : '';
      
    const { text } = await run(prompt + schemaSuffix, label);
    if (!schema) return text;
    
    let obj = extractJson(text);
    if (!obj) {
      log(`   !! ${label} reply was not valid JSON — retrying once (strict reprompt)`);
      const strict = `${prompt}\n\nYour previous reply was NOT valid JSON. Respond with ONLY a single raw JSON ` +
        `object conforming to this JSON Schema — no prose, no fences:\n${JSON.stringify(schema)}`;
      obj = extractJson((await run(strict, `${label}#retry`)).text);
    }
    if (!obj) {
      log(`   !! ${label} still unparseable — ABSTAIN (answerable:no) → engine HALTs for human review`);
      return {
        answerable: 'no',
        note: `reviewer ${label} response was not parseable JSON after one retry — cannot verify findings; HALT for human review`,
        findings: []
      };
    }
    return obj;
  }
};

const DEFAULT_DRIVER = process.env.ANTIGRAVITY_AGENT ? 'gemini-cli' : 'claude';

/** name -> driver object. Seeded with the always-present Claude default. */
const REGISTRY = new Map([[claudeDriver.name, claudeDriver]]);

/**
 * Register (or replace) a backend. Wave 5's gemini/openai/grok modules call this.
 * @param {{name:string, subAgentCapable?:boolean, runAgent:Function}} driver
 */
export function registerDriver(driver) {
  if (!driver || typeof driver.name !== 'string' || typeof driver.runAgent !== 'function') {
    throw new TypeError('registerDriver requires a { name, runAgent } driver object');
  }
  REGISTRY.set(driver.name, driver);
  return driver;
}

// Wave 5: register the additive non-Claude backends. They live behind the same
// `runAgent` interface and are selected by `TRIO_DRIVER` (the Claude default is
// unaffected). Registering here (rather than self-registering on import) keeps the
// registry's contents explicit and order-stable for the capability matrix.
// `gemini-cli` is the sub-agent-capable Gemini HOST backend (login-based `gemini -p`);
// `gemini` remains the raw-HTTP API worker. Both register; they never collide on name.
registerDriver(geminiCliDriver);
registerDriver(geminiDriver);
registerDriver(openaiDriver);
registerDriver(grokDriver);
registerDriver(geminiCliNativeDriver);

/** The backend names currently registered (default `claude` always present). */
export function listDrivers() {
  return [...REGISTRY.keys()];
}

/**
 * The capability matrix: one row per registered backend describing whether it can
 * spawn real fresh sub-agent contexts (`subAgentCapable` — true only for the
 * CLI-spawning Claude backend; the raw-API backends approximate isolation with a
 * fresh stateless request) and HOW it produces structured output (CLI sub-agent
 * prompt vs JSON-mode / function-calling). Derived from the registered drivers so
 * a newly registered backend appears automatically.
 * @returns {{name:string, subAgentCapable:boolean, structuredOutput:string}[]}
 */
export function capabilityMatrix() {
  return [...REGISTRY.values()].map((d) => ({
    name: d.name,
    subAgentCapable: !!d.subAgentCapable,
    structuredOutput: d.structuredOutput ?? 'unknown',
  }));
}

/**
 * Resolve the active backend. Selection order: explicit `name` arg, then
 * `TRIO_DRIVER`, then the `claude` default. HALTs on an unknown name rather than
 * silently falling back, so a typo never quietly bills the wrong backend.
 * @param {?string} [name]
 * @param {object}  [env=process.env]
 */
export function getDriver(name = null, env = process.env) {
  const key = name || env.TRIO_DRIVER || DEFAULT_DRIVER;
  const driver = REGISTRY.get(key);
  if (!driver) {
    throw new HaltError(
      `unknown trio driver "${key}"`,
      `registered drivers: ${listDrivers().join(', ')}. Set TRIO_DRIVER to one of these (or leave it unset for the default "${DEFAULT_DRIVER}").`,
    );
  }
  return driver;
}

/**
 * The single engine seam. Dispatches to the selected backend's `runAgent`.
 * @param {object}  opts
 * @param {string}  opts.prompt
 * @param {object}  [opts.schema]        JSON Schema; when present the reply is parsed/validated
 * @param {boolean} [opts.freshContext]  request an isolated context (native for sub-agent-capable backends)
 * @param {string}  [opts.driver]        explicit backend name (overrides TRIO_DRIVER)
 * @returns {Promise<any>} model text, or the schema-validated object
 */
export async function runAgent(opts = {}) {
  const driver = getDriver(opts.driver);
  return driver.runAgent(opts);
}

/**
 * Build Foreman's `{ execute, review, fix }` driver routed through the registry —
 * i.e. the foreman driver seam on top of the selected backend (default `claude`).
 * Foreman's `makeAgentDriver` already wraps an injected `agent()`; this is the
 * registry-level way to obtain that seam so the foreman build path goes through the
 * driver registry rather than calling `makeAgentDriver` directly.
 *
 * Two modes:
 *   - inject `agent`  — route an existing, already-instrumented `agent()` through
 *     the seam unchanged (used by `run-live.mjs`, whose live `claude -p` transport
 *     carries bespoke status logging that must stay byte-for-byte equivalent).
 *   - omit `agent`    — build the agent from the registry-selected backend, so
 *     `TRIO_DRIVER` (or an explicit `driver`) chooses the model the build sub-agents
 *     run on. Extra opts (e.g. an injected `runClaude` stub, `env`, `target`, `log`)
 *     thread through to the backend's `runAgent`.
 * @param {object}   [opts]
 * @param {string}   [opts.driver]      explicit backend name (overrides TRIO_DRIVER)
 * @param {Function} [opts.agent]       pre-built `agent(prompt, opts)` to route as-is
 * @param {object|false} [opts.reliability]  Wave-1 reliability-wrapper opts, or `false` to opt out
 * @returns {Promise<{execute:Function, review:Function, fix:Function}>}
 */
export async function makeForemanDriver({ driver, agent, reliability, ...opts } = {}) {
  const { makeAgentDriver } = await import('../foreman/bin/wave-workflow.js');
  let seamAgent = agent;
  // Provider key for the Wave-2 per-provider breaker: the selected backend's name when
  // we build the seam, else 'injected' for an already-instrumented agent. A sick backend
  // is then degraded under its OWN bucket, never globally.
  let providerName = 'injected';
  if (!seamAgent) {
    const backend = getDriver(driver);
    providerName = backend.name;
    // Forward role + model per-call (nullish-fallback to driver-level opts) so the
    // per-role model tier (e.g. TRIO_MODEL_<ROLE>, resolved in the gemini-cli driver)
    // is actually reachable on the Foreman build path. Backends that ignore role/model
    // (e.g. the Claude session-default driver) are unaffected.
    seamAgent = (prompt, o = {}) =>
      backend.runAgent({
        ...opts, prompt, schema: o.schema, label: o.label,
        role: o.role ?? opts.role, model: o.model ?? opts.model, freshContext: true,
      });
  }
  // Wave 1: apply the reliability wrapper at THIS agent-injection boundary (both the
  // injected-agent and built-backend modes), so the Foreman build path gets typed
  // retry + round-aware idempotency. Transparent on the success path; pass
  // `reliability:false` to opt out.
  //
  // Wave 2: default a LIGHT per-provider breaker (keyed by the backend name) on so a
  // sick provider degrades for the session instead of being hammered — still inert
  // until N consecutive recoverable failures, so a healthy build is unaffected. The
  // idle sliver + anti-laundering telemetry stay opt-in via the `reliability` config
  // (live wiring of stdout-heartbeat / a telemetry sink is the runner's job). Any of
  // these can be overridden — or the breaker disabled with `reliability:{breaker:false}`.
  const reliableSeam = reliability === false
    ? seamAgent
    : makeReliableAgent({ agent: seamAgent, provider: providerName, breaker: {}, ...(reliability || {}) });
  return makeAgentDriver({ agent: reliableSeam });
}

export { claudeDriver, geminiCliDriver, geminiDriver, openaiDriver, grokDriver };
