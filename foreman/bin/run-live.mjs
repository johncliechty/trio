#!/usr/bin/env node
// run-live.mjs — drive a REAL project to done with LIVE `claude -p` sub-agents on the
// subscription, through Foreman's production agent() seam (C1/C2 hardened), with budget
// caps + git hygiene + a durable status log. Generalized from foreman-targets/_calib-run.mjs.
//
//   node run-live.mjs <projectDir> [--reviewers N] [--cap K] [--max-waves N]
//        [--max-wallclock-min M] [--git] [--branch NAME] [--status <file>]
//        [--allowed-tools "Bash,Edit,Write,Read,Glob,Grep"]
//
// GROUND TRUTH stays the orchestrator-run gate (the discovered test command); sub-agents
// only drive execute/review/fix. NO ANTHROPIC_API_KEY in env => subscription usage; the
// per-call `$` is a subscription EQUIVALENT-cost estimate, not a metered API charge.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
function flag(name, def) { const i = argv.indexOf(name); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def; }
const PROJECT = path.resolve(argv.find((a) => !a.startsWith('--')) || process.cwd());
const REVIEWERS = Number(flag('--reviewers', '2'));
const CAP = Number(flag('--cap', '3'));
const MAX_WAVES = flag('--max-waves', null);
const MAX_WALL_MIN = flag('--max-wallclock-min', null);
const USE_GIT = argv.includes('--git');
const BRANCH = flag('--branch', null);
const STATUS_FILE = flag('--status', path.join(PROJECT, '_foreman-status.log'));
const ALLOWED = flag('--allowed-tools', 'Bash,Edit,Write,Read,Glob,Grep');

const CLAUDE_ARGS = ['-p', '--output-format', 'stream-json', '--verbose',
  '--permission-mode', 'acceptEdits', '--allowedTools', ALLOWED,
  // The orchestrator owns ALL git (commit-on-GO, branch, reconcile). Secondary guard
  // (the prompt is the primary one) using the documented space-form pattern.
  '--disallowedTools', 'Bash(git *)'];

function emit(line) {
  const stamp = new Date().toISOString().slice(11, 19);
  const out = `[${stamp}] ${line}\n`;
  process.stdout.write(out);
  try { fs.appendFileSync(STATUS_FILE, out); } catch { /* never crash on logging */ }
}

const calls = [];

function extractJson(text) {
  if (typeof text !== 'string') return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch { /* try substring */ }
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return null;
}

function runClaude(fullPrompt, label) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const secs = () => Math.round((Date.now() - t0) / 1000);
    emit(`┌ ${label} … launching agent`);
    const child = spawn('claude', CLAUDE_ARGS, { cwd: PROJECT });
    let buf = '', finalEnv = null, tools = 0, lastText = '';
    const tick = setInterval(() => emit(`│ ${label} … working — ${secs()}s, ${tools} tool call(s) so far`), 20000);
    child.stdout.on('data', (d) => {
      buf += d.toString();
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        let o; try { o = JSON.parse(line); } catch { continue; }
        if (o.type === 'assistant' && o.message?.content) {
          for (const x of o.message.content) {
            if (x.type === 'tool_use') {
              tools++;
              const hint = x.input?.file_path ? ` ${String(x.input.file_path).split(/[\\/]/).pop()}`
                : x.input?.command ? ` ${String(x.input.command).slice(0, 44)}` : '';
              emit(`│ ${label} → ${x.name}${hint}  (${secs()}s)`);
            } else if (x.type === 'text' && x.text?.trim()) { lastText = x.text.trim(); }
          }
        } else if (o.type === 'result') { finalEnv = o; }
      }
    });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      clearInterval(tick);
      const u = finalEnv?.usage || {};
      const rec = {
        label, cli_status: code, ok: !!finalEnv && finalEnv.is_error === false,
        duration_ms: finalEnv?.duration_ms ?? null, tools,
        output_tokens: u.output_tokens ?? null, cost_usd: finalEnv?.total_cost_usd ?? null,
        permission_denials: Array.isArray(finalEnv?.permission_denials) ? finalEnv.permission_denials.length : null,
      };
      calls.push(rec);
      emit(`└ ${label} done — code ${code}, ok ${rec.ok}, ${tools} tools, out ${rec.output_tokens}tok, ` +
        `~$${(rec.cost_usd ?? 0).toFixed(4)} est (subscription equiv, not an API charge), ${rec.duration_ms}ms` +
        (rec.permission_denials ? `, denials ${rec.permission_denials}` : ''));
      if (!finalEnv) emit(`   !! no result envelope. stderr=${stderr.slice(0, 300)}`);
      resolve({ text: finalEnv?.result ?? lastText ?? '', rec });
    });
    child.stdin.write(fullPrompt);
    child.stdin.end();
  });
}

// C1: retry-then-abstain on a malformed schema (review) reply.
async function agent(prompt, opts = {}) {
  const label = opts.label || '(unlabeled)';
  const schemaSuffix = opts.schema
    ? `\n\nRespond with ONLY a single raw JSON object (no markdown fences, no prose) ` +
      `that conforms to this JSON Schema:\n${JSON.stringify(opts.schema)}`
    : '';
  const { text } = await runClaude(prompt + schemaSuffix, label);
  if (!opts.schema) return text;
  let obj = extractJson(text);
  if (!obj) {
    emit(`   !! ${label} reply was not valid JSON — retrying once (strict reprompt)`);
    const strict = `${prompt}\n\nYour previous reply was NOT valid JSON. Respond with ONLY a single raw JSON ` +
      `object conforming to this JSON Schema — no prose, no fences:\n${JSON.stringify(opts.schema)}`;
    obj = extractJson((await runClaude(strict, `${label}#retry`)).text);
  }
  if (!obj) {
    emit(`   !! ${label} still unparseable — ABSTAIN (answerable:no) → engine HALTs for human review`);
    return { answerable: 'no', note: `reviewer ${label} response was not parseable JSON after one retry — cannot verify findings; HALT for human review`, findings: [] };
  }
  return obj;
}

const { runProject } = await import('file:///C:/dev/foreman/bin/project-engine.mjs');
// Wave 4: obtain the foreman driver seam through the trio driver registry (claude
// default) rather than calling makeAgentDriver directly. The instrumented `agent`
// above is injected unchanged, so the live `claude -p` path stays byte-for-byte
// equivalent; the registry is the seam through which a future TRIO_DRIVER selection
// would swap the backend.
const { makeForemanDriver } = await import('../../drivers/index.mjs');

try { fs.writeFileSync(STATUS_FILE, ''); } catch { /* fresh log */ }
emit(`=== FOREMAN LIVE RUN ===`);
emit(`project: ${PROJECT}`);
emit(`reviewers=${REVIEWERS} fixIterCap=${CAP} maxWaves=${MAX_WAVES ?? '∞'} maxWallClock=${MAX_WALL_MIN ?? '∞'}min git=${USE_GIT} branch=${BRANCH ?? 'foreman/run'}`);
emit(`binding: headless \`claude -p … --permission-mode acceptEdits --allowedTools ${ALLOWED}\` (cwd=project); ground truth = orchestrator gate`);

const budgetConfig = (MAX_WAVES != null || MAX_WALL_MIN != null) ? {
  maxWaves: MAX_WAVES != null ? Number(MAX_WAVES) : null,
  maxWallClockMs: MAX_WALL_MIN != null ? Number(MAX_WALL_MIN) * 60000 : null,
} : null;

let result, threw = null;
try {
  result = await runProject({
    projectDir: PROJECT,
    driver: await makeForemanDriver({ agent }),
    reviewerCount: REVIEWERS,
    fixIterCap: CAP,
    budgetConfig,
    git: USE_GIT ? (BRANCH ? { branch: BRANCH } : true) : false,
    log: (s) => emit(s),
  });
} catch (e) {
  threw = { name: e?.name, message: e?.message, reason: e?.reason };
  emit(`!! runProject THREW: ${threw.name}: ${threw.message}${threw.reason ? ' — ' + threw.reason : ''}`);
}

const tot = calls.reduce((a, c) => ({
  out: a.out + (c.output_tokens || 0), cost: a.cost + (c.cost_usd || 0),
  ms: a.ms + (c.duration_ms || 0), denials: a.denials + (c.permission_denials || 0),
}), { out: 0, cost: 0, ms: 0, denials: 0 });

emit(`=== DONE === status=${result?.status ?? (threw ? 'THREW' : 'n/a')} · ` +
  `waves=${(result?.waveResults || []).map((w) => `${w.wave}:${w.status}`).join(',') || 'none'} · ` +
  `stoppedAt=${result?.stoppedAt ?? '-'} · agent_calls=${calls.length} · denials=${tot.denials} · ` +
  `est_cost=$${tot.cost.toFixed(4)} (subscription equiv) · out_tokens=${tot.out}`);
if (result?.haltReason) emit(`HALT/STOP reason: ${result.haltReason}`);
if (result?.recommend) emit(`recommended next: ${result.recommend}`);

console.log('RUN_JSON_START');
console.log(JSON.stringify({
  threw, status: result?.status ?? null, stoppedAt: result?.stoppedAt ?? null,
  totalWaves: result?.totalWaves ?? null, haltReason: result?.haltReason ?? null,
  recommend: result?.recommend ?? null,
  waveResults: (result?.waveResults || []).map((w) => ({ wave: w.wave, title: w.title, status: w.status, green: w.green, tap: w.tap, iterations: w.iterations, halt: w.haltReason || null })),
  agent_calls: calls.length, totals: tot,
}, null, 2));
console.log('RUN_JSON_END');
