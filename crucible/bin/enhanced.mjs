// enhanced.mjs — Crucible's cross-model ENHANCED mode (Wave 9).
//
// MASTER-PLAN §10 draws two substrate modes. Wave 3 built the per-role STAMP and an
// INJECTABLE probe seam on the Judge; Wave 9 binds the REAL capability-binding and
// adds the Synthesizer's reasoning-strength selection, so a run can actually upgrade
// independence when extra model families are reachable — and degrade-and-stamp when
// they are not.
//
//   - DEFAULT mode (subscription-only, like Foreman): only Claude is reachable. The
//     Judge is a same-model fresh-context persona; the Synthesizer is Claude
//     extended-thinking. Both are STAMPED so provenance is honest.
//   - ENHANCED mode (activated when extra model CLIs / API keys are reachable):
//       · the lock Judge is the strongest model from a family OTHER than the plan's
//         author — FAMILY-DIVERSE (Claude-authored ⇒ Gemini → GPT → Grok), removing
//         same-family self-preference at the single highest-leverage decision point;
//       · the Synthesizer takes the strongest REASONING model (Gemini Deep Think →
//         o-series → Claude extended-thinking).
//
// Capability-binding is TRY-AND-OBSERVE (the researchPrime idiom, mirrored from
// research.mjs): a family is reachable if its API key env var is set OR its CLI
// answers a probe. The probe transport is INJECTED so tests detect present-vs-absent
// with zero subprocesses. Missing keys NEVER block a run — it degrades to Default and
// says so (the stamp's `cross_model:false`).

import { spawnSync } from 'node:child_process';

import { HaltError } from './crucible-lib.mjs';
import { JUDGE_ROLE, stampRole, selectJudgeModel } from './judge.mjs';
import { SYNTHESIZER_ROLE } from './synthesizer.mjs';

// ---------------------------------------------------------------------------
// The cross-model registry — the extra families Enhanced mode can bind.
//
// `reasoning_rank` orders the Synthesizer choice (§10: Gemini Deep Think → o-series
// → Claude extended-thinking). `judge_rank` orders the family-diverse Judge choice
// (§10: Claude-authored ⇒ Gemini → GPT → Grok). Claude is NOT in this registry — it
// is the always-present substrate, added separately by `detectReachableModels`.
// ---------------------------------------------------------------------------

export const MODEL_REGISTRY = [
  { family: 'gemini', model: 'gemini-deep-think', reasoning_rank: 3, judge_rank: 3, detect: ['gemini'], envKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'] },
  { family: 'gpt', model: 'o-series', reasoning_rank: 2, judge_rank: 2, detect: ['codex', 'chatgpt'], envKeys: ['OPENAI_API_KEY'] },
  { family: 'grok', model: 'grok', reasoning_rank: 1, judge_rank: 1, detect: ['grok'], envKeys: ['XAI_API_KEY', 'GROK_API_KEY'] },
];

/** Claude — the always-reachable substrate (Default mode runs on this alone). */
export const CLAUDE_SUBSTRATE = { family: 'claude', model: 'claude-extended-thinking', reasoning_rank: 0, judge_rank: 0, via: 'substrate' };

// ---------------------------------------------------------------------------
// Try-and-observe capability binding.
// ---------------------------------------------------------------------------

/**
 * Default CLI probe: try-and-observe whether `cmd --version` runs. ENOENT (no such
 * CLI) and any spawn error are observed as "not reachable" (false) — never thrown,
 * so a missing CLI silently degrades the run to Default mode (MASTER-PLAN §10).
 *
 * @param {string} cmd
 * @returns {boolean}
 */
export function defaultProbeCli(cmd) {
  try {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8', timeout: 5000 });
    return !r.error && (r.status === 0 || r.status === null && !!r.stdout);
  } catch {
    return false;
  }
}

/**
 * Detect which model families are reachable (try-and-observe). Claude is always
 * present (the substrate). Each registry family is reachable if an API key is set OR
 * its CLI answers the probe; the result records HOW (`via: 'api-key' | 'cli'`).
 *
 * @param {object}   [o]
 * @param {object}   [o.env=process.env]
 * @param {Function} [o.probeCli=defaultProbeCli]   injectable CLI probe (tests stub it)
 * @param {Function} [o.log=()=>{}]
 * @returns {Array<{family:string,model:string,reasoning_rank:number,judge_rank:number,via:string}>}
 */
export function detectReachableModels({ env = process.env, probeCli = defaultProbeCli, log = () => {} } = {}) {
  const reachable = [{ ...CLAUDE_SUBSTRATE }];
  for (const entry of MODEL_REGISTRY) {
    const keyHit = (entry.envKeys || []).find((k) => env && env[k]);
    const cliHit = !keyHit && (entry.detect || []).find((cmd) => probeCli(cmd));
    if (keyHit || cliHit) {
      const via = keyHit ? 'api-key' : 'cli';
      reachable.push({ family: entry.family, model: entry.model, reasoning_rank: entry.reasoning_rank, judge_rank: entry.judge_rank, via });
      log(`enhanced: ${entry.family} reachable via ${via}${keyHit ? ` (${keyHit})` : ` (${cliHit})`}`);
    }
  }
  if (reachable.length === 1) log('enhanced: only Claude reachable — Default (subscription-only) mode');
  return reachable;
}

// ---------------------------------------------------------------------------
// Cross-model selection — the Judge probe + the Synthesizer selector.
// ---------------------------------------------------------------------------

/**
 * Build the cross-model probe the Judge consumes (`bin/judge.mjs` `selectJudgeModel`'s
 * `probe`): it surfaces the strongest reachable model from a family OTHER than the
 * plan's author (family-diverse, §10), or null when none is reachable ⇒ the Judge
 * falls back to the same-model persona (Default). Wave 3 left this seam injectable;
 * this is its real binding.
 *
 * @param {Array}  reachable                 detectReachableModels() output
 * @param {string} [authorFamily='claude']   the family that AUTHORED the plan
 * @returns {() => ({model:string,family:string}|null)}
 */
export function makeCrossModelProbe(reachable = [], authorFamily = 'claude') {
  return () => {
    const diverse = reachable
      .filter((m) => m.family !== authorFamily)
      .sort((a, b) => (b.judge_rank ?? 0) - (a.judge_rank ?? 0));
    return diverse.length ? { model: diverse[0].model, family: diverse[0].family } : null;
  };
}

/**
 * Select the Synthesizer's model by REASONING strength (§10: Gemini Deep Think →
 * o-series → Claude extended-thinking). Enhanced only when a non-Claude reasoning
 * model is reachable; otherwise Claude extended-thinking (Default). Same shape as
 * `selectJudgeModel` so it stamps identically.
 *
 * @param {object} [o]
 * @param {Array}  [o.reachable=[]]   detectReachableModels() output
 * @returns {{model:string,family:string,mode:string,reachable:boolean}}
 */
export function selectSynthesizerModel({ reachable = [] } = {}) {
  const candidates = reachable
    .filter((m) => m.family !== 'claude')
    .sort((a, b) => (b.reasoning_rank ?? 0) - (a.reasoning_rank ?? 0));
  if (candidates.length) {
    const top = candidates[0];
    return { model: top.model, family: top.family, mode: 'enhanced', reachable: true };
  }
  // Default: Claude extended-thinking does the reasoning (fully functional, §10).
  return { model: CLAUDE_SUBSTRATE.model, family: 'claude', mode: 'default', reachable: false };
}

// ---------------------------------------------------------------------------
// Provisioning — select BOTH roles from one reachability scan and stamp each.
// ---------------------------------------------------------------------------

/**
 * Provision the Judge and the Synthesizer from a reachability scan, returning each
 * role's selection + per-role STAMP and the overall substrate mode. Graceful
 * degrade is built in: when nothing different-family/reasoning is reachable, each
 * role falls to its Default (same-model) form and is stamped `cross_model:false` —
 * "missing keys never block a run; it degrades to Default and says so" (§10).
 *
 * @param {object} o
 * @param {Array}  o.reachable                  detectReachableModels() output
 * @param {string} [o.authorFamily='claude']    the family that AUTHORED the plan
 * @returns {{mode:string, reachable:Array, judge:{selection:object,stamp:object},
 *            synthesizer:{selection:object,stamp:object}}}
 */
export function provisionRoles({ reachable, authorFamily = 'claude' } = {}) {
  if (!Array.isArray(reachable)) {
    throw new HaltError('provisionRoles requires a reachable[] scan', 'pass detectReachableModels() output');
  }

  const judgeSel = selectJudgeModel({ authorFamily, probe: makeCrossModelProbe(reachable, authorFamily) });
  const synthSel = selectSynthesizerModel({ reachable });

  const judgeStamp = stampRole({ role: JUDGE_ROLE, model: judgeSel.model, family: judgeSel.family, mode: judgeSel.mode, reachable: judgeSel.reachable });
  const synthStamp = stampRole({ role: SYNTHESIZER_ROLE, model: synthSel.model, family: synthSel.family, mode: synthSel.mode, reachable: synthSel.reachable });

  // The run is Enhanced iff at least one role genuinely bound a cross-model upgrade.
  const mode = judgeStamp.cross_model || synthStamp.cross_model ? 'enhanced' : 'default';

  return {
    mode,
    reachable,
    judge: { selection: judgeSel, stamp: judgeStamp },
    synthesizer: { selection: synthSel, stamp: synthStamp },
  };
}

/**
 * Convenience: detect reachable models, then provision both roles. The single entry
 * point the orchestrator calls at stage start. Returns the provisioning plus the
 * raw reachability scan so the run can log/stamp exactly what was bound.
 *
 * @param {object}   [o]
 * @param {string}   [o.authorFamily='claude']
 * @param {object}   [o.env=process.env]
 * @param {Function} [o.probeCli=defaultProbeCli]
 * @param {Function} [o.log=()=>{}]
 */
export function detectAndProvision({ authorFamily = 'claude', env = process.env, probeCli = defaultProbeCli, log = () => {} } = {}) {
  const reachable = detectReachableModels({ env, probeCli, log });
  const provisioned = provisionRoles({ reachable, authorFamily });
  log(`enhanced: provisioned ${provisioned.mode} mode — Judge=${provisioned.judge.stamp.model} (cross-model:${provisioned.judge.stamp.cross_model}), Synthesizer=${provisioned.synthesizer.stamp.model} (cross-model:${provisioned.synthesizer.stamp.cross_model})`);
  return provisioned;
}
