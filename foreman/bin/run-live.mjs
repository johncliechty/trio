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

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { classifyExit, makeTelemetryRecord } from './transport.mjs';
import { spawnGuarded, makeChildRegistry, acquireLock } from './proc-guard.mjs';

const argv = process.argv.slice(2);
function flag(name, def) { const i = argv.indexOf(name); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def; }
const PROJECT = path.resolve(argv.find((a) => !a.startsWith('--')) || process.cwd());
const REVIEWERS = Number(flag('--reviewers', '2'));
const CAP = Number(flag('--cap', '3'));
const MAX_WAVES = flag('--max-waves', null);
const MAX_WALL_MIN = flag('--max-wallclock-min', null);
const USE_GIT = argv.includes('--git');
const RESUME = argv.includes('--resume');
const BRANCH = flag('--branch', null);
const STATUS_FILE = flag('--status', path.join(PROJECT, '_foreman-status.log'));
const ALLOWED = flag('--allowed-tools', 'Bash,Edit,Write,Read,Glob,Grep');
// Wave 7: per-call hard timeout (SIGKILL a hung sub-agent) + the single-run lock.
const CALL_TIMEOUT_MIN = flag('--call-timeout-min', '20');
const CALL_TIMEOUT_MS = Number(CALL_TIMEOUT_MIN) > 0 ? Number(CALL_TIMEOUT_MIN) * 60000 : null;
const LOCK_FILE = flag('--lock', path.join(PROJECT, '.foreman', 'run.lock'));

const CLAUDE_ARGS = ['-p', ' ', '--output-format', 'stream-json', '--verbose',
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

// Wave 7 kill-on-exit: every spawned sub-agent is tracked here; an orchestrator
// teardown (clean exit OR SIGINT/SIGTERM) SIGKILLs any still-live child, so no
// leaked, wedged claude process survives the run (the induced-kill invariant).
const registry = makeChildRegistry({ log: emit });
registry.install();

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
    emit(`┌ ${label} … launching agent` + (CALL_TIMEOUT_MS ? ` (per-call timeout ${CALL_TIMEOUT_MIN}m)` : ''));
    // Spawn under the timeout + kill-on-exit guard (proc-guard). `done` resolves
    // with the typed-exit inputs; we attach our own stream-json listeners to the
    // returned child for the served-model/tool/usage telemetry.
    const isWin = process.platform === 'win32';
    const { child, done } = spawnGuarded({
      command: isWin ? 'claude.cmd' : 'claude', args: CLAUDE_ARGS, cwd: PROJECT, timeoutMs: CALL_TIMEOUT_MS, registry,
      spawnImpl: (cmd, args, opts) => spawn(cmd, args, { ...opts, shell: false, windowsHide: true })
    });
    let buf = '', finalEnv = null, tools = 0, lastText = '', servedModel = null, stderr = '';
    const tick = setInterval(() => emit(`│ ${label} … working — ${secs()}s, ${tools} tool call(s) so far`), 20000);
    if (typeof tick.unref === 'function') tick.unref();

    if (child) {
      child.stdout.on('data', (d) => {
        buf += d.toString();
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          let o; try { o = JSON.parse(line); } catch { continue; }
          if (o.type === 'system' && typeof o.model === 'string' && o.model) {
            servedModel = servedModel || o.model; // init/system envelope carries the served model
          }
          if (o.type === 'assistant' && o.message?.content) {
            if (typeof o.message.model === 'string' && o.message.model) servedModel = o.message.model;
            for (const x of o.message.content) {
              if (x.type === 'tool_use') {
                tools++;
                const hint = x.input?.file_path ? ` ${String(x.input.file_path).split(/[\\/]/).pop()}`
                  : x.input?.command ? ` ${String(x.input.command).slice(0, 44)}` : '';
                emit(`│ ${label} → ${x.name}${hint}  (${secs()}s)`);
              } else if (x.type === 'text' && x.text?.trim()) { lastText = x.text.trim(); }
            }
          } else if (o.type === 'result') {
            finalEnv = o;
            if (typeof o.model === 'string' && o.model) servedModel = o.model; // result envelope is authoritative
          }
        }
      });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.stdin.on('error', (err) => { emit(`!! ${label}: stdin EPIPE - child likely exited early. err=${err.message}`); });
      child.stdin.write(fullPrompt);
      child.stdin.end();
    }

    done.then(({ code, signal, timedOut, spawnError }) => {
      clearInterval(tick);
      // Wave 7: TYPE the outcome (exit-class taxonomy) and stamp a schema-valid
      // per-call telemetry record. Every call is classified — no unclassified exit.
      const classification = classifyExit({ spawnError, timedOut, code, signal, finalEnv });
      const u = finalEnv?.usage || {};
      const rec = makeTelemetryRecord({
        label,
        classification,
        cli_status: typeof code === 'number' ? code : null,
        signal: signal || null,
        duration_ms: finalEnv?.duration_ms ?? (Date.now() - t0),
        tools,
        output_tokens: u.output_tokens ?? null,
        cost_usd: finalEnv?.total_cost_usd ?? null,
        permission_denials: Array.isArray(finalEnv?.permission_denials) ? finalEnv.permission_denials.length : null,
        servedModel,
      });
      calls.push(rec);
      // SPIKE(foreman-parallel): passive per-call phase-timing sink for phase-report.mjs.
      // Append-only, off the hot path's critical work; the run never crashes on logging.
      try {
        fs.mkdirSync(path.join(PROJECT, '.foreman'), { recursive: true });
        fs.appendFileSync(path.join(PROJECT, '.foreman', 'phase-timings.jsonl'),
          JSON.stringify({ kind: 'call', label: rec.label, duration_ms: rec.duration_ms,
            output_tokens: rec.output_tokens, cost_usd: rec.cost_usd, ts: Date.now() }) + '\n');
      } catch { /* never crash the run on logging */ }
      emit(`└ ${label} done — class ${rec.exit_class}, code ${code ?? signal ?? '?'}, ok ${rec.ok}, ${tools} tools, ` +
        `out ${rec.output_tokens}tok, ~$${(rec.cost_usd ?? 0).toFixed(4)} est (subscription equiv, not an API charge), ` +
        `${rec.duration_ms}ms` + (rec.permission_denials ? `, denials ${rec.permission_denials}` : ''));
      if (!finalEnv) emit(`   !! ${classification.detail}${stderr ? `. stderr=${stderr.slice(0, 300)}` : ''}`);
      resolve({ text: finalEnv?.result ?? lastText ?? '', rec });
    });
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

// BLOCKER-1 fix (Phase 1.1): resolve the engine TREE-RELATIVE to this file, never via
// an absolute `file:///C:/dev/foreman/...` archive path. `new URL(spec, import.meta.url)`
// pins resolution inside the canonical trio tree, so a renamed/removed archive can never
// be silently executed (asserted by drivers/test/canonical-no-escape.test.mjs).
const { runProject } = await import(new URL('./project-engine.mjs', import.meta.url));
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

// Wave 7: acquire the single-run lock. A lock held by a LIVE pid refuses a
// concurrent run; a lock left by a crashed/killed run (dead pid) is stale and is
// reclaimed. The lock RELEASES on exit (clean OR signalled — registered below),
// so a mid-wave kill never wedges the next --resume out.
try { fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true }); } catch { /* dir may exist */ }
let lock;
try {
  lock = acquireLock(LOCK_FILE, { label: `run-live ${PROJECT}` });
  emit(`lock: acquired ${LOCK_FILE} (pid ${process.pid})`);
} catch (e) {
  emit(`!! could not acquire run lock: ${e.reason || e.message}${e.detail ? ' — ' + e.detail : ''}`);
  process.exit(3);
}
process.on('exit', () => { try { lock.release(); } catch { /* best-effort */ } });

const budgetConfig = (MAX_WAVES != null || MAX_WALL_MIN != null) ? {
  maxWaves: MAX_WAVES != null ? Number(MAX_WAVES) : null,
  maxWallClockMs: MAX_WALL_MIN != null ? Number(MAX_WALL_MIN) * 60000 : null,
} : null;

let result, threw = null;
try {
  result = await runProject({
    projectDir: PROJECT,
    driver: await makeForemanDriver(process.env.TRIO_DRIVER ? { log: (s) => emit(s) } : { agent }),
    reviewerCount: REVIEWERS,
    fixIterCap: CAP,
    budgetConfig,
    resume: RESUME,
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

