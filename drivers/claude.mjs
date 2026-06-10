// drivers/claude.mjs — the DEFAULT trio model backend: headless `claude -p` on the
// subscription (NO ANTHROPIC_API_KEY => subscription usage). This is the canonical
// home of the existing `claude -p` behavior that previously lived inline in
// `crucible/bin/agent.mjs` and Foreman's `run-live.mjs`; both now route through this
// module so the Claude path stays byte-for-byte equivalent (Wave 4 non-regression).
//
// The seam is:
//   - ENV-GATED: the live process is only spawned when CRUCIBLE_AGENT_LIVE=1, so an
//     accidental import/test never launches a real (billable) agent.
//   - STUBBABLE: `makeAgentSeam({ runClaude })` accepts an injected transport, so
//     tests drive the full schema/retry/abstain logic with zero subprocesses.
// The returned `agent(prompt, opts)` honors Workflow's contract: it returns text by
// default, and the validated object when `opts.schema` is supplied (retry-once then
// ABSTAIN on unparseable schema replies, exactly like run-live's C1 hardening).
//
// `claudeDriver` is the registry entry consumed by `drivers/index.mjs`; its
// `runAgent({ prompt, schema, freshContext })` is the pluggable interface. claude -p
// spawns a fresh sub-agent process, so `freshContext` is satisfied natively
// (subAgentCapable: true) and the flag is accepted as a no-op for this backend.

import { spawn } from 'node:child_process';

import { HaltError } from '../foreman/bin/foreman-lib.mjs';
import { attestStamp } from './attest.mjs';

const BASE_ARGS = [
  '-p', '--output-format', 'stream-json', '--verbose',
  '--permission-mode', 'acceptEdits',
];
const DEFAULT_ALLOWED_TOOLS = 'Bash,Edit,Write,Read,Glob,Grep';

/** Pull the first JSON object out of a model reply (bare, fenced, or embedded). */
export function extractJson(text) {
  if (typeof text !== 'string') return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch { /* try substring */ }
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return null;
}

/**
 * Parse the full `claude -p --output-format stream-json --verbose` stdout into
 * `{ text, rec }`. PURE + testable (symmetric to gemini-cli's `parseGeminiCliFrames`),
 * so the SR-5 attestation logic is unit-tested with no subprocess.
 *
 * Served-model discovery (Phase 1.3): the Claude stream exposes the served model on
 * (in order of authority) the `result` envelope's `model`, then each `assistant`
 * message's `message.model`, then the `system`/init envelope's `model`. Whichever is
 * present POSITIVELY attests (`model_attested:true`); if NONE exposes a served-model id
 * the stamp DEGRADES (SR-5 — never fabricate). Today `claude -p` emits the model on the
 * assistant/init frames, so the positive branch is exercised live; the degrade branch
 * is the documented fallback if a future CLI build drops the field.
 * @param {string} stdout            raw newline-delimited JSON frames
 * @param {object} [meta]
 * @param {string} [meta.label]
 * @param {?number}[meta.cli_status] process exit code
 * @returns {{ text:string, rec:object }}
 */
export function parseClaudeFrames(stdout, { label = '(unlabeled)', cli_status = null } = {}) {
  let finalEnv = null, lastText = '', tools = 0, servedModel = null;
  for (const raw of String(stdout).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.type === 'system' && typeof o.model === 'string' && o.model) {
      servedModel = servedModel || o.model;
    } else if (o.type === 'assistant' && o.message?.content) {
      if (typeof o.message.model === 'string' && o.message.model) servedModel = o.message.model;
      for (const x of o.message.content) {
        if (x.type === 'tool_use') { tools++; }
        else if (x.type === 'text' && x.text?.trim()) { lastText = x.text.trim(); }
      }
    } else if (o.type === 'result') {
      finalEnv = o;
      if (typeof o.model === 'string' && o.model) servedModel = o.model; // most authoritative
    }
  }
  const rec = {
    label, cli_status,
    ok: !!finalEnv && finalEnv.is_error === false,
    duration_ms: finalEnv?.duration_ms ?? null, tools,
    output_tokens: finalEnv?.usage?.output_tokens ?? null,
    cost_usd: finalEnv?.total_cost_usd ?? null,
    ...attestStamp(servedModel), // SR-5 served-model stamp
  };
  return { text: finalEnv?.result ?? lastText ?? '', rec, _finalEnv: finalEnv };
}

/**
 * Live transport: spawn `claude -p` and resolve `{ text, rec }` once the stream's
 * result envelope arrives. ENV-GATED — throws unless CRUCIBLE_AGENT_LIVE=1 so it
 * can never fire by accident (tests inject a stub instead).
 */
export function defaultRunClaude(fullPrompt, label, {
  env = process.env,
  target = process.cwd(),
  allowedTools = DEFAULT_ALLOWED_TOOLS,
  log = () => {},
} = {}) {
  if (env.CRUCIBLE_AGENT_LIVE !== '1') {
    throw new HaltError(
      'live agent seam is disabled',
      'set CRUCIBLE_AGENT_LIVE=1 to spawn a real `claude -p` sub-agent, or inject a stub `runClaude` (tests/orchestrator)',
    );
  }
  return new Promise((resolve) => {
    const child = spawn('claude', [...BASE_ARGS, '--allowedTools', allowedTools], { cwd: target });
    let out = '', stderr = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      const { text, rec, _finalEnv } = parseClaudeFrames(out, { label, cli_status: code });
      if (!_finalEnv) log(`!! ${label}: no result envelope. stderr=${stderr.slice(0, 300)}`);
      resolve({ text, rec });
    });
    child.stdin.write(fullPrompt);
    child.stdin.end();
  });
}

/**
 * Build the `agent()` seam.
 * @param {object} [o]
 * @param {?Function} [o.runClaude]  injected transport `(prompt,label)=>Promise<{text}>`
 *                                   (omit to use the env-gated live `claude -p`).
 * @param {object}    [o.env=process.env]
 * @param {string}    [o.target=process.cwd()]  cwd for the live sub-agent
 * @param {string}    [o.allowedTools]
 * @param {Function}  [o.log=()=>{}]
 * @returns {{ agent: (prompt:string, opts?:object)=>Promise<any> }}
 */
export function makeAgentSeam({
  runClaude = null,
  env = process.env,
  target = process.cwd(),
  allowedTools = DEFAULT_ALLOWED_TOOLS,
  log = () => {},
} = {}) {
  const run = runClaude || ((prompt, label) => defaultRunClaude(prompt, label, { env, target, allowedTools, log }));

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
 * The Claude registry entry (the trio's default backend).
 *
 * `runAgent` is the pluggable interface (`drivers/index.mjs` dispatches to it):
 * it builds the env-gated/stubbable `agent()` seam and invokes it once. A test or
 * orchestrator may inject `runClaude` (a stub transport) to drive the full
 * schema/retry/abstain logic with no subprocess. `freshContext` is accepted for
 * interface parity — claude -p spawns a fresh sub-agent process, so a fresh context
 * is the native behavior and the flag is a no-op for this backend.
 *
 * @type {{ name: string, subAgentCapable: boolean, structuredOutput: string,
 *          runAgent: (opts?: object) => Promise<any> }}
 */
export const claudeDriver = {
  name: 'claude',
  subAgentCapable: true,
  // Structured output comes from the CLI sub-agent: the schema is appended to the
  // prompt and the reply is parsed (retry-once-then-ABSTAIN). Contrast the raw-API
  // backends, which use native JSON-mode / function-calling.
  structuredOutput: 'cli-subagent (prompt-suffix)',
  async runAgent(opts = {}) {
    const { prompt, schema, label } = opts;
    // makeAgentSeam reads runClaude/env/target/allowedTools/log from the same opts
    // bag; an absent runClaude falls back to the env-gated live transport.
    const { agent } = makeAgentSeam(opts);
    return agent(prompt, { schema, label });
  },
};

export default claudeDriver;
