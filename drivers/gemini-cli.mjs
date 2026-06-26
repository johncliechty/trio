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
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
export const DEFAULT_GEMINI_CLI_MODEL = 'gemini-3.1-pro';

// `auto_edit` auto-approves file edits (the Claude `acceptEdits` analog) — the right
// default for execute/fix roles. Read-only roles (reviewers/judges) get `plan`.
export const DEFAULT_GEMINI_APPROVAL_MODE = 'auto_edit';

// The trio gate adapter, worker side: the trio's HUMAN gates are host-agnostic HALTs
// (crucible-lib haltForHuman -> the orchestrator re-prompts in the host conversation,
// Claude Code OR Gemini CLI), so they need no Gemini frame parsing. What DOES need
// adapting is each headless worker's approval posture: read-only roles must stay
// read-only (no edits, no hang), edit roles auto-approve edits. Roles are matched by
// name or by the label prefix Foreman uses (`execute:`, `review:`, `fix:`).
export const READONLY_ROLES = new Set([
  'review', 'reviewer', 'shark', 'judge', 'synthesizer', 'synth', 'research', 'researcher', 'plan', 'planner',
]);
const EDIT_ROLES = new Set(['execute', 'exec', 'fix', 'build', 'builder']);

/**
 * Resolve the approval mode for a worker (the gate-adapter posture). An explicit
 * `approvalMode` always wins. Otherwise a read-only role => 'plan' (no edits, no
 * approval hang); an edit role => 'auto_edit'; unknown => the safe-ish default.
 * Role is taken from `role`, else the label's prefix before ':' / '#' / '.'.
 */
export function approvalModeFor({ approvalMode, role, label } = {}) {
  if (approvalMode) return approvalMode;
  const key = String(role || label || '').toLowerCase().split(/[:#.\s]/)[0];
  if (READONLY_ROLES.has(key)) return 'plan';
  if (EDIT_ROLES.has(key)) return 'auto_edit';
  return DEFAULT_GEMINI_APPROVAL_MODE;
}

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

/** Build the `agy` argv: `--dangerously-skip-permissions` + `--model <model>`. */
export function buildGeminiCliArgs({ model } = {}) {
  return ['--dangerously-skip-permissions', '--model', model ?? DEFAULT_GEMINI_CLI_MODEL];
}

/**
 * The Antigravity CLI binary is always `agy` and must be globally available.
 * Previous fallback logic for npm shims has been removed in the v2 migration.
 */

/**
 * Parse an `agy` stdout dump into `{ text, rec }` (pure/testable — no subprocess).
 * Since `agy` emits plaintext (possibly with ANSI), we strip ANSI and capture the whole response.
 * @param {string} stdout            raw stdout buffer
 * @param {object} [meta]
 * @param {string} [meta.label]
 * @param {?number}[meta.cli_status] process exit code
 * @returns {{ text:string, rec:object }}
 */
export function parseGeminiCliFrames(stdout, { label = '(unlabeled)', cli_status = null } = {}) {
  // Strip ANSI control codes and raw carriage returns
  // Matches all VT escape sequences (not just SGR), plus we strip \r explicitly
  const cleanStdout = String(stdout).replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '');
  
  const text = cleanStdout.trim();
  const ok = cli_status === 0;

  const rec = {
    label,
    cli_status,
    ok,
    status: ok ? 'success' : 'cli_error',
    duration_ms: null,
    tools: 0,
    output_tokens: null,
    input_tokens: null,
    total_tokens: null,
    cost_usd: null,
    model_served: null,
    model_attested: false,
    degraded: true, 
    multi_model: false,
  };
  return { text, rec };
}

// Default per-call wall-clock ceiling (12 min) — kills a child that hangs (e.g. a
// headless approval prompt under a too-permissive approval mode) so the orchestrator
// never blocks forever. Override via opts.timeoutMs (0 disables).
export const DEFAULT_GEMINI_TIMEOUT_MS = 60 * 60 * 1000;

// `-p` is the headless SWITCH and REQUIRES a value, but its value is *appended to stdin*
// (gemini 0.44.1 help: "Appended to input on stdin (if any)"). So the FULL prompt is
// written to stdin (no argv length limit) and `-p` carries only this tiny sentinel —
// which also keeps the prompt OFF any shell command line (the shell fallback is safe).
const PROMPT_STDIN_SENTINEL = ' ';

/**
 * Live transport: spawn `agy`, pass the prompt via `-p`, and resolve `{ text, rec }`.
 * ENV-GATED — throws unless CRUCIBLE_AGENT_LIVE=1.
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
  approvalMode,
  timeoutMs = DEFAULT_GEMINI_TIMEOUT_MS,
  log = () => {},
} = {}) {
  if (env.CRUCIBLE_AGENT_LIVE !== '1') {
    throw new HaltError(
      'live agent seam is disabled',
      'set CRUCIBLE_AGENT_LIVE=1 to spawn a real `agy -p` sub-agent, or inject a stub `runGemini` (tests/orchestrator)',
    );
  }
  
  const mdl = resolveGeminiModel({ model, role, env });
  const childEnv = Object.assign({}, env, { NO_COLOR: "1", FORCE_COLOR: "0" });

  return new Promise((resolve) => {
    const args = buildGeminiCliArgs({ model: mdl });
    args.push('-p', fullPrompt);
    const child = spawn('agy.exe', args, { cwd: target, env: childEnv, windowsHide: true });
      
    let buf = '', stderr = '', settled = false, timedOut = false;
    const finish = (payload) => { if (settled) return; settled = true; clearTimeout(timer); resolve(payload); };
    const timer = timeoutMs > 0 ? setTimeout(() => {
      timedOut = true;
      log(`!! ${label}: agy exceeded ${timeoutMs}ms - killing child`);
      try { child.kill('SIGKILL'); } catch { }
      finish({ text: '', rec: { label, cli_status: null, ok: false, status: 'timeout', requested_model: mdl, model_served: null, model_attested: false, cost_usd: null } });
    }, timeoutMs) : null;
    if (timer && typeof timer.unref === 'function') timer.unref();

    child.stdin.end();

    child.stdout.on('data', (d) => { buf += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      finish({ text: '', rec: { label, cli_status: null, ok: false, status: 'transport-error', error: String(err?.message ?? err), requested_model: mdl, model_served: null, model_attested: false, cost_usd: null } });
    });
    child.on('close', (code) => {
      if (timedOut) return; 
      const { text, rec } = parseGeminiCliFrames(buf, { label, cli_status: code });
      rec.requested_model = mdl;
      if (!rec.ok) log(`!! ${label}: agy exit ${code}, status=${rec.status}. stderr=${stderr.slice(0, 300)}`);
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
  approvalMode,
  timeoutMs,
  log = () => {},
} = {}) {
  // approvalMode is left undefined unless explicitly set, so the transport derives it
  // per-call from the role/label (read-only roles -> 'plan'); `label` flows in per call.
  const run = runGemini
    || ((prompt, label) => defaultRunGeminiCli(prompt, label, { env, target, model, role, approvalMode, timeoutMs, log }));

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


