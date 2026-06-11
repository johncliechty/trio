#!/usr/bin/env node
// tools/gemini-host-hop.mjs — Phase 0.5 / Wave-6: drive ONE Foreman wave with the
// execute/review/fix sub-agents running as headless `gemini -p` (GEMINI AS HOST). The
// orchestrator still runs the ground-truth gate (never a sub-agent). EACH sub-agent's
// SERVED model is attested per SR-5 (captured from the gemini envelope, not argv) and
// written to <project>/_gemini-attestation.json. This is the plan's A3 de-risk + the
// Wave-6 dogfood vehicle.
//
//   GEMINI_API_KEY=... TRIO_MODEL=gemini-3.1-pro-preview CRUCIBLE_AGENT_LIVE=1 \
//     node tools/gemini-host-hop.mjs <projectDir> [--cap K] [--reviewers N] [--status FILE]

import fs from 'node:fs';
import path from 'node:path';

import { extractJson } from '../drivers/claude.mjs';
import { defaultRunGeminiCli } from '../drivers/gemini-cli.mjs';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const PROJECT = path.resolve(argv.find((a) => !a.startsWith('--')) || process.cwd());
const CAP = Number(flag('--cap', '2'));
const REVIEWERS = Number(flag('--reviewers', '1'));
const STATUS = flag('--status', path.join(PROJECT, '_gemini-hop-status.log'));
const ATTEST_FILE = path.join(PROJECT, '_gemini-attestation.json');

const emit = (s) => {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${s}`;
  console.log(line);
  try { fs.appendFileSync(STATUS, line + '\n'); } catch { /* best-effort */ }
};

if (process.env.CRUCIBLE_AGENT_LIVE !== '1') { console.error('set CRUCIBLE_AGENT_LIVE=1'); process.exit(2); }
if (!process.env.GEMINI_API_KEY) { console.error('set GEMINI_API_KEY (backup auth)'); process.exit(2); }

const { runProject } = await import(new URL('../foreman/bin/project-engine.mjs', import.meta.url));
const { makeForemanDriver } = await import(new URL('../drivers/index.mjs', import.meta.url));

// SR-5 attestation sink: every gemini sub-agent call records the SERVED model from its
// envelope. An injected agent (not a driver-built seam) so the rec is captured rather
// than discarded; the schema/retry/abstain contract mirrors the drivers.
const attestations = [];
function record(label, role, rec) {
  attestations.push({
    label, role: role ?? null,
    model_served: rec.model_served ?? null,
    model_attested: rec.model_attested === true,
    degraded: rec.degraded ?? (rec.model_served == null),
    status: rec.status ?? null,
  });
}
async function geminiAgent(prompt, opts = {}) {
  const label = opts.label || 'agent';
  const suffix = opts.schema
    ? `\n\nRespond with ONLY a single raw JSON object (no prose/fences) conforming to this JSON Schema:\n${JSON.stringify(opts.schema)}`
    : '';
  const first = await defaultRunGeminiCli(prompt + suffix, label, { env: process.env, target: PROJECT, model: process.env.TRIO_MODEL, role: opts.role, log: emit });
  record(label, opts.role, first.rec);
  if (!opts.schema) return first.text;
  let obj = extractJson(first.text);
  if (!obj) {
    const retry = await defaultRunGeminiCli(`${prompt}\n\nYour previous reply was NOT valid JSON. Reply with ONLY a single raw JSON object conforming to:\n${JSON.stringify(opts.schema)}`, `${label}#retry`, { env: process.env, target: PROJECT, model: process.env.TRIO_MODEL, role: opts.role, log: emit });
    record(`${label}#retry`, opts.role, retry.rec);
    obj = extractJson(retry.text);
  }
  if (!obj) return { answerable: 'no', note: `${label}: unparseable JSON after retry — HALT for human review`, findings: [] };
  return obj;
}

try { fs.writeFileSync(STATUS, ''); } catch { /* fresh */ }
emit('=== GEMINI-HOST FOREMAN RUN ===');
emit(`project: ${PROJECT}`);
emit(`host: gemini-cli (injected, attesting) · model ${process.env.TRIO_MODEL || '(default)'} · auto_edit(execute/fix)/plan(review) · reviewers ${REVIEWERS} · fixIterCap ${CAP}`);

const driver = await makeForemanDriver({ agent: geminiAgent });

let result, threw = null;
try {
  result = await runProject({
    projectDir: PROJECT, driver, reviewerCount: REVIEWERS, fixIterCap: CAP,
    budgetConfig: { maxWaves: 1, maxWallClockMs: null }, git: false, log: emit,
  });
} catch (e) {
  threw = { name: e?.name, message: e?.message, reason: e?.reason };
  emit(`!! runProject THREW: ${threw.name}: ${threw.message}${threw.reason ? ' — ' + threw.reason : ''}`);
}

const attested = attestations.filter((a) => a.model_attested);
const families = [...new Set(attested.map((a) => a.model_served))];
const artifact = {
  host: 'gemini-cli', project: PROJECT, status: result?.status ?? (threw ? 'THREW' : 'n/a'),
  sub_agent_calls: attestations.length, all_attested: attestations.length > 0 && attestations.every((a) => a.model_attested),
  served_models: families, attestations,
};
try { fs.writeFileSync(ATTEST_FILE, JSON.stringify(artifact, null, 2) + '\n'); emit(`attestation artifact -> ${ATTEST_FILE}`); } catch { /* best-effort */ }

emit(`=== DONE === status=${artifact.status} · waves=${(result?.waveResults || []).map((w) => `${w.wave}:${w.status}`).join(',') || 'none'} · ` +
  `halt=${result?.haltReason ?? '-'} · sub_agents=${attestations.length} all_attested=${artifact.all_attested} served=${families.join(',')}`);
console.log('RUN_JSON_START');
console.log(JSON.stringify({
  threw, status: result?.status ?? null, haltReason: result?.haltReason ?? null,
  waveResults: (result?.waveResults || []).map((w) => ({ wave: w.wave, status: w.status, green: w.green, tap: w.tap, halt: w.haltReason || null })),
  attestation: { sub_agent_calls: attestations.length, all_attested: artifact.all_attested, served_models: families },
}, null, 2));
console.log('RUN_JSON_END');
