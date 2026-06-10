// drivers/gemini-cli.mjs — the Gemini CLI HOST backend: headless `gemini -p` on the
// user's Pro/Ultra login (NO GEMINI_API_KEY => subscription/login usage). This is the
// Gemini analog of `claude.mjs`: a real sub-agent-spawning CLI driver (contrast the
// raw-HTTP `gemini.mjs` WORKER driver, which needs GEMINI_API_KEY and is NOT
// sub-agent-capable). Selected via `TRIO_DRIVER=gemini-cli`.
//
// Auth posture (John's rule, 2026-06-10): the Pro/Ultra LOGIN is the default — this
// driver passes NO key and relies on the logged-in `gemini` session. An API key is a
// human-approved backup only (use the `gemini.mjs` HTTP worker for that), never the
// default here. Note: the consumer login tiers migrate to the Antigravity CLI on
// 2026-06-18; the `gemini` binary keeps working on paid API-key / Code Assist / Vertex
// auth past that date. This driver targets the `gemini` binary either way.
//
// Model rule: the trio runs under whatever CLI session hosts it, using a DESIGNATED
// model for that family. A spawned `gemini -p` child cannot read the parent session's
// in-session `/model` pick, so the model is passed EXPLICITLY via `-m` (resolution:
// opts.model -> TRIO_MODEL_<ROLE>/TRIO_MODEL -> GEMINI_MODEL -> DEFAULT_GEMINI_CLI_MODEL).
//
// Attestation (criterion 3 / SR-5): the SERVED model is read from the result
// envelope's `stats.models` KEY (the request may say `-m auto`, but the envelope names
// the model that actually ran). Unattestable (no `stats.models`) => `model_attested:
// false` and `model_served: null` so the stamp can read `degraded` rather than claim.
//
// The seam is ENV-GATED (CRUCIBLE_AGENT_LIVE=1 — the same trio-wide gate the Claude
// driver uses) so an accidental import/test never spawns a real (billable) agent, and
// STUBBABLE (`makeGeminiCliSeam({ runGemini })`) so tests drive the full
// schema/retry/abstain logic with zero subprocesses.
//
// Tool gating: per-role tool allow-lists (the Claude driver's DEFAULT_ALLOWED_TOOLS
// analog) are DEFERRED by design. gemini's `--allowed-tools` is deprecated in favor of
// its Policy Engine (`--policy`); tool surface here is governed by `--approval-mode`
// (read-only roles pass `plan`). Wiring the Policy Engine per role is a follow-up for
// the build/fix lanes, tracked with the gate adapter — not the worker landing.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { HaltError } from '../foreman/bin/foreman-lib.mjs';
import { extractJson } from './claude.mjs';

// Validated live on this host (2026-06-10, gemini 0.44.1). Invocation:
//   `gemini --skip-trust --output-format stream-json --approval-mode <mode> -m <model> -p " "`
//   with the FULL PROMPT piped on STDIN.
// `--skip-trust` is MANDATORY for headless work — without it Gemini treats the project
// folder as untrusted, forces read-only, and overrides the approval mode. NOTE on `-p`:
// it is the headless SWITCH and requires a value, but per `gemini --help` that value is
// "Appended to input on stdin (if any)" — so the prompt is delivered via STDIN (no argv
// length limit, no shell-quoting exposure) and `-p` carries only a tiny sentinel.
export const GEMINI_CLI_BASE_ARGS = ['--skip-trust', '--output-format', 'stream-json'];

// A capable, designated Gemini 3.1 model (the model `-m auto` actually served in the
// 2026-06-10 smoke). Override per call (opts.model) or per env (TRIO_MODEL/GEMINI_MODEL).
export const DEFAULT_GEMINI_CLI_MODEL = 'gemini-3.1-pro-preview';

// `auto_edit` auto-approves file edits (the Claude `acceptEdits` analog) — the right
// default for execute/fix roles. Read-only roles (reviewers/judges) should pass `plan`;
// fully unattended build roles that also run shell tools may need `yolo` to avoid an
// approval hang in headless mode.
export const DEFAULT_GEMINI_APPROVAL_MODE = 'auto_edit';

/**
 * Resolve the designated model for this call. opts.model wins, then a per-role env
 * (`TRIO_MODEL_<ROLE>`), then `TRIO_MODEL`, then `GEMINI_MODEL`, then the default.
 */
export function resolveGeminiModel({ model, role, env = process.env } = {}) {
  const roleKey = role ? `TRIO_MODEL_${String(role).toUpperCase()}` : null;
  return (
    model ||
    (roleKey && env[roleKey]) ||
    env.TRIO_MODEL ||
    env.GEMINI_MODEL ||
    DEFAULT_GEMINI_CLI_MODEL
  );
}

/** Build the `gemini` argv (pure/testable): base args + approval mode + `-m <model>`. */
export function buildGeminiCliArgs({ model, approvalMode = DEFAULT_GEMINI_APPROVAL_MODE } = {}) {
  return [...GEMINI_CLI_BASE_ARGS, '--approval-mode', approvalMode, '-m', model ?? DEFAULT_GEMINI_CLI_MODEL];
}

/**
 * Resolve how to launch gemini. `gemini` ships as an npm shim (`gemini.cmd` on Windows)
 * wrapping `node .../@google/gemini-cli/bundle/gemini.js`. Spawning that bundle with
 * `node` directly (shell:false) lets us pass an arbitrary-content prompt (JSON, quotes,
 * newlines) as ONE clean positional arg with no shell quoting — the Windows `.cmd`
 * shim would otherwise require `shell:true` and mangle the prompt. Falls back to the
 * `gemini` shim (shell on win32) when the bundle can't be located.
 * @returns {{ mode:'node', entry:string } | { mode:'shell' }}
 */
export function resolveGeminiEntry(env = process.env) {
  if (env.GEMINI_CLI_JS && existsSync(env.GEMINI_CLI_JS)) return { mode: 'node', entry: env.GEMINI_CLI_JS };
  const rel = ['node_modules', '@google', 'gemini-cli', 'bundle', 'gemini.js'];
  const candidates = [];
  if (process.platform === 'win32' && env.APPDATA) candidates.push(path.join(env.APPDATA, 'npm', ...rel));
  if (env.npm_config_prefix) candidates.push(path.join(env.npm_config_prefix, 'lib', ...rel));
  if (env.HOME) candidates.push(path.join(env.HOME, '.npm-global', 'lib', ...rel));
  for (const c of candidates) if (existsSync(c)) return { mode: 'node', entry: c };
  return { mode: 'shell' };
}

/**
 * Parse a Gemini stream-json STDOUT dump into `{ text, rec }` (pure/testable — no
 * subprocess). Frame shapes (verified live 2026-06-10):
 *   { type:'init',    model:<requested> }                       // argv model, NOT served
 *   { type:'message', role:'user'|'assistant', content:<str> }  // assistant text (delta:true)
 *   { type:'result',  status:'success'|..., stats:{ ... models:{ <SERVED>:{...} } } }
 * The SERVED model is the KEY of `stats.models` — the attestation source.
 * @param {string} stdout            raw newline-delimited JSON frames
 * @param {object} [meta]
 * @param {string} [meta.label]
 * @param {?number}[meta.cli_status] process exit code
 * @returns {{ text:string, rec:object }}
 */
export function parseGeminiCliFrames(stdout, { label = '(unlabeled)', cli_status = null } = {}) {
  let assistant = '';
  let result = null;
  for (const raw of String(stdout).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.type === 'message' && o.role === 'assistant' && typeof o.content === 'string') {
      assistant += o.content;
    } else if (o.type === 'result') {
      result = o;
    }
  }
  const stats = result?.stats ?? {};
  // Attestation guard (SR-5 "unattestable => degrade, never claim"): only a PLAIN object
  // keyed by model id attests. An array (typeof [] === 'object', Object.keys -> "0"), a
  // null, or a non-string/empty key must NOT produce a confident-but-fabricated stamp.
  const m = stats.models;
  const servedKeys = (m && typeof m === 'object' && !Array.isArray(m)) ? Object.keys(m) : [];
  const firstKey = servedKeys[0];
  const modelServed = (typeof firstKey === 'string' && firstKey.length) ? firstKey : null;
  // More than one served model in a single envelope is a multi-model run we can't
  // single-stamp; surface it rather than silently picking [0].
  const multiModel = servedKeys.length > 1;
  const rec = {
    label,
    cli_status,
    ok: result?.status === 'success',
    status: result?.status ?? null,
    duration_ms: stats.duration_ms ?? null,
    tools: stats.tool_calls ?? 0,
    output_tokens: stats.output_tokens ?? null,
    input_tokens: stats.input_tokens ?? null,
    total_tokens: stats.total_tokens ?? null,
    // The Gemini envelope carries NO total cost (unlike Claude's total_cost_usd); cost
    // must be derived from tokens × per-model pricing downstream, so it is honestly null.
    cost_usd: null,
    // Attestation: served model read from the envelope, never from argv.
    model_served: modelServed,
    model_attested: modelServed !== null,
    multi_model: multiModel,
  };
  // Assistant deltas are the response; fall back to a `result.response` field if a
  // future CLI build emits the answer only on the result envelope.
  const text = assistant.trim() || (typeof result?.response === 'string' ? result.response.trim() : '');
  return { text, rec };
}

// Default per-call wall-clock ceiling (12 min) — kills a child that hangs (e.g. a
// headless approval prompt under a too-permissive approval mode) so the orchestrator
// never blocks forever. Override via opts.timeoutMs (0 disables).
export const DEFAULT_GEMINI_TIMEOUT_MS = 12 * 60 * 1000;

// `-p` is the headless SWITCH and REQUIRES a value, but its value is *appended to stdin*
// (gemini 0.44.1 help: "Appended to input on stdin (if any)"). So the FULL prompt is
// written to stdin (no argv length limit) and `-p` carries only this tiny sentinel —
// which also keeps the prompt OFF any shell command line (the shell fallback is safe).
const PROMPT_STDIN_SENTINEL = ' ';

/**
 * Live transport: spawn `gemini`, write the full prompt to STDIN (so there is no argv
 * length limit and no shell-quoting exposure), and resolve `{ text, rec }` once the
 * process closes. ENV-GATED — throws unless CRUCIBLE_AGENT_LIVE=1 so it can never fire
 * by accident (tests inject a stub `runGemini` instead).
 * @param {string} fullPrompt
 * @param {string} label
 * @param {object} [o]
 * @param {object} [o.env=process.env]
 * @param {string} [o.target=process.cwd()]  cwd for the live sub-agent
 * @param {string} [o.model]                 designated model (resolved if omitted)
 * @param {string} [o.role]                  role name for per-role model resolution
 * @param {string} [o.approvalMode]
 * @param {number} [o.timeoutMs]             wall-clock kill ceiling (0 disables)
 * @param {Function}[o.log=()=>{}]
 * @returns {Promise<{ text:string, rec:object }>}
 */
export function defaultRunGeminiCli(fullPrompt, label, {
  env = process.env,
  target = process.cwd(),
  model,
  role,
  approvalMode = DEFAULT_GEMINI_APPROVAL_MODE,
  timeoutMs = DEFAULT_GEMINI_TIMEOUT_MS,
  log = () => {},
} = {}) {
  if (env.CRUCIBLE_AGENT_LIVE !== '1') {
    throw new HaltError(
      'live agent seam is disabled',
      'set CRUCIBLE_AGENT_LIVE=1 to spawn a real `gemini -p` sub-agent, or inject a stub `runGemini` (tests/orchestrator)',
    );
  }
  const mdl = resolveGeminiModel({ model, role, env });
  // Only fixed flags + model id + the sentinel are on the command line; the prompt goes
  // to stdin. The shell fallback (win32, when the node bundle isn't found) is therefore
  // safe — there is no untrusted prompt text for cmd.exe to mangle.
  const args = [...buildGeminiCliArgs({ model: mdl, approvalMode }), '-p', PROMPT_STDIN_SENTINEL];
  const launch = resolveGeminiEntry(env);
  return new Promise((resolve) => {
    const child = launch.mode === 'node'
      ? spawn(process.execPath, [launch.entry, ...args], { cwd: target, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
      : spawn('gemini', args, { cwd: target, stdio: ['pipe', 'pipe', 'pipe'], shell: process.platform === 'win32', windowsHide: true });
    let buf = '', stderr = '', settled = false, timedOut = false;
    const finish = (payload) => { if (settled) return; settled = true; clearTimeout(timer); resolve(payload); };
    const timer = timeoutMs > 0 ? setTimeout(() => {
      timedOut = true;
      log(`!! ${label}: gemini exceeded ${timeoutMs}ms — killing child`);
      try { child.kill('SIGKILL'); } catch { /* already gone */ }
      finish({ text: '', rec: { label, cli_status: null, ok: false, status: 'timeout', requested_model: mdl, model_served: null, model_attested: false, cost_usd: null } });
    }, timeoutMs) : null;
    if (timer && typeof timer.unref === 'function') timer.unref();
    child.stdout.on('data', (d) => { buf += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      // Transport failure (e.g. gemini not found): surface a typed result rather than a
      // silent empty success, so the orchestrator can classify/retry it.
      finish({ text: '', rec: { label, cli_status: null, ok: false, status: 'transport-error', error: String(err?.message ?? err), requested_model: mdl, model_served: null, model_attested: false, cost_usd: null } });
    });
    // Deliver the full prompt over stdin (gemini appends the `-p` sentinel to it).
    try { child.stdin.write(fullPrompt); child.stdin.end(); } catch { /* error event handles it */ }
    child.on('close', (code) => {
      if (timedOut) return; // already settled by the timeout path
      const { text, rec } = parseGeminiCliFrames(buf, { label, cli_status: code });
      rec.requested_model = mdl;
      if (!rec.ok) log(`!! ${label}: gemini exit ${code}, status=${rec.status}. stderr=${stderr.slice(0, 300)}`);
      finish({ text, rec });
    });
  });
}

/**
 * Build the `agent()` seam for the Gemini CLI backend. Mirrors claude.mjs's
 * `makeAgentSeam`: structured output is prompt-suffix (the schema is appended, the
 * reply parsed with retry-once-then-ABSTAIN) so behavior matches every other backend.
 * @param {object} [o]
 * @param {?Function}[o.runGemini]  injected transport `(prompt,label)=>Promise<{text,rec}>`
 *                                  (omit to use the env-gated live `gemini -p`).
 * @param {object}  [o.env=process.env]
 * @param {string}  [o.target=process.cwd()]
 * @param {string}  [o.model]
 * @param {string}  [o.role]
 * @param {string}  [o.approvalMode]
 * @param {Function}[o.log=()=>{}]
 * @returns {{ agent: (prompt:string, opts?:object)=>Promise<any> }}
 */
export function makeGeminiCliSeam({
  runGemini = null,
  env = process.env,
  target = process.cwd(),
  model,
  role,
  approvalMode = DEFAULT_GEMINI_APPROVAL_MODE,
  log = () => {},
} = {}) {
  const run = runGemini
    || ((prompt, label) => defaultRunGeminiCli(prompt, label, { env, target, model, role, approvalMode, log }));

  async function agent(prompt, opts = {}) {
    const label = opts.label || '(unlabeled)';
    const schemaSuffix = opts.schema
      ? `\n\nRespond with ONLY a single raw JSON object (no markdown fences, no prose) ` +
        `that conforms to this JSON Schema:\n${JSON.stringify(opts.schema)}`
      : '';
    const { text } = await run(prompt + schemaSuffix, label);
    if (!opts.schema) return text;

    let obj = extractJson(text);
    if (!obj) {
      log(`   !! ${label} reply was not valid JSON — retrying once (strict reprompt)`);
      const strict = `${prompt}\n\nYour previous reply was NOT valid JSON and could not be parsed. ` +
        `Respond with ONLY a single raw JSON object that conforms to this JSON Schema — ` +
        `no prose, no markdown fences, nothing else:\n${JSON.stringify(opts.schema)}`;
      obj = extractJson((await run(strict, `${label}#retry`)).text);
    }
    if (!obj) {
      log(`   !! ${label} still unparseable after retry — ABSTAIN (answerable:no) -> engine HALTs for human review`);
      return {
        answerable: 'no',
        note: `reviewer ${label} response was not parseable JSON after one retry — cannot verify ` +
          `its findings; HALT for human review`,
        findings: [],
      };
    }
    return obj;
  }

  return { agent };
}

/**
 * The Gemini CLI registry entry — a real sub-agent-capable HOST backend (spawns a fresh
 * `gemini -p` process per call, so `freshContext` is native). Structured output is
 * prompt-suffix, identical contract to the Claude backend.
 * @type {{ name:string, subAgentCapable:boolean, structuredOutput:string,
 *          runAgent:(opts?:object)=>Promise<any> }}
 */
export const geminiCliDriver = {
  name: 'gemini-cli',
  subAgentCapable: true,
  structuredOutput: 'cli-subagent (prompt-suffix)',
  async runAgent(opts = {}) {
    const { prompt, schema, label } = opts;
    const { agent } = makeGeminiCliSeam(opts);
    return agent(prompt, { schema, label });
  },
};

export default geminiCliDriver;
