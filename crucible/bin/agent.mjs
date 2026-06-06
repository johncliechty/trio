// agent.mjs — Crucible's live `agent()` seam (Wave 1).
//
// Mirrors Foreman's run-live.mjs binding: a headless `claude -p --output-format
// stream-json` sub-agent on the subscription (NO ANTHROPIC_API_KEY => subscription
// usage). The seam is:
//   - ENV-GATED: the live process is only spawned when CRUCIBLE_AGENT_LIVE=1, so an
//     accidental import/test never launches a real (billable) agent.
//   - STUBBABLE: `makeAgentSeam({ runClaude })` accepts an injected transport, so
//     tests drive the full schema/retry/abstain logic with zero subprocesses.
// The returned `agent(prompt, opts)` honors Workflow's contract: it returns text by
// default, and the validated object when `opts.schema` is supplied (retry-once then
// ABSTAIN on unparseable schema replies, exactly like run-live's C1 hardening).

import { spawn } from 'node:child_process';

import { HaltError } from '../../foreman/bin/foreman-lib.mjs';

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
    let buf = '', finalEnv = null, lastText = '', tools = 0;
    child.stdout.on('data', (d) => {
      buf += d.toString();
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        let o; try { o = JSON.parse(line); } catch { continue; }
        if (o.type === 'assistant' && o.message?.content) {
          for (const x of o.message.content) {
            if (x.type === 'tool_use') { tools++; }
            else if (x.type === 'text' && x.text?.trim()) { lastText = x.text.trim(); }
          }
        } else if (o.type === 'result') { finalEnv = o; }
      }
    });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      const rec = {
        label, cli_status: code,
        ok: !!finalEnv && finalEnv.is_error === false,
        duration_ms: finalEnv?.duration_ms ?? null, tools,
        output_tokens: finalEnv?.usage?.output_tokens ?? null,
        cost_usd: finalEnv?.total_cost_usd ?? null,
      };
      if (!finalEnv) log(`!! ${label}: no result envelope. stderr=${stderr.slice(0, 300)}`);
      resolve({ text: finalEnv?.result ?? lastText ?? '', rec });
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
