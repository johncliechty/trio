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
import { claudeDriver } from './claude.mjs';

const DEFAULT_DRIVER = 'claude';

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

/** The backend names currently registered (default `claude` always present). */
export function listDrivers() {
  return [...REGISTRY.keys()];
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
 * @param {string}   [opts.driver]  explicit backend name (overrides TRIO_DRIVER)
 * @param {Function} [opts.agent]   pre-built `agent(prompt, opts)` to route as-is
 * @returns {Promise<{execute:Function, review:Function, fix:Function}>}
 */
export async function makeForemanDriver({ driver, agent, ...opts } = {}) {
  const { makeAgentDriver } = await import('../foreman/bin/wave-workflow.js');
  let seamAgent = agent;
  if (!seamAgent) {
    const backend = getDriver(driver);
    seamAgent = (prompt, o = {}) =>
      backend.runAgent({ ...opts, prompt, schema: o.schema, label: o.label, freshContext: true });
  }
  return makeAgentDriver({ agent: seamAgent });
}

export { claudeDriver };
