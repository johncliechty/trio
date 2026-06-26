// Phase-3 engine driver for the Ramanujan researchPrime dive.
// Faithful ENGINE mode: REAL fresh-context Agent-tool sub-agents produce the cognition
// (reviewer findings, Judge verdict, Synthesizer steer, debate); this driver replays those
// through the REAL trio gates (tallyFindings >=2-agree, gateOneQuorum independence, the honest
// convergence tracker, the suspiciously-dry guard) and assembles the deliverable. No re-implemented
// gate logic — every predicate comes from bin/round.mjs / bin/governor.mjs / bin/deliverable.mjs.
//
// Usage: node run-ramanujan-round.mjs <runDir>
//   <runDir> must contain round-<N>-input.json files of shape:
//     { round, northStar, stakes:{impact,reversibility,blastRadius}|tier,
//       reviews:[{reviewer,angle,lineage,findings:[{topic,severity,traces_to_north_star,message}]}],
//       adjudications:{ judge:{decision,reasons}, synthesizer:{lean,suggestions}, debate:{survivor} } }
// It processes ALL round-*-input.json in order, recomputes convergence over the full history,
// writes round-<N>-result.json, and on convergence writes DELIVERABLE-ENGINE.json.

import fs from 'node:fs';
import path from 'node:path';
import {
  orchestrateRound,
  makeConvergenceTracker,
  assessConvergenceHonesty,
  loopThresholds,
  countUnresolvedHighSeverity,
} from './bin/round.mjs';
import { resolveTier } from './bin/governor.mjs';
import { adjudicateStakes } from './bin/stakes.mjs';
import { assembleDeliverable } from './bin/deliverable.mjs';

const runDir = process.argv[2];
if (!runDir) { console.error('need <runDir>'); process.exit(2); }

const thresholds = loopThresholds();           // { N, K, M } from the committed pre-registration
const inputs = fs.readdirSync(runDir)
  .filter((f) => /^round-\d+-input\.json$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))
  .map((f) => JSON.parse(fs.readFileSync(path.join(runDir, f), 'utf8')));

if (!inputs.length) { console.error('no round-*-input.json found'); process.exit(2); }

// The injected seam: replay the REAL sub-agent adjudications for this round, keyed by role.
function replayAgent(adj) {
  return async (_prompt, opts = {}) => {
    const role = opts.role || 'other';
    if (role === 'judge') return adj.judge ?? { decision: 'NOT_CONVERGED', reasons: [] };
    if (role === 'synthesizer') return adj.synthesizer ?? { lean: 'unknown', suggestions: [] };
    if (role === 'debate') return adj.debate ?? { survivor: null };
    return null;
  };
}

const tier = resolveTier(
  inputs[0].stakes ?? { declared_stakes: 'high', reversibility: 'hard-to-reverse', blast_radius: 'wide', magnitude: 'major' },
);

const tracker = makeConvergenceTracker({ N: thresholds.N });
const priorBlockerIds = new Set();
const roundResults = [];
let convergence = null;
let roundsToDry = null;

for (const inp of inputs) {
  const result = await orchestrateRound({
    agent: replayAgent(inp.adjudications ?? {}),
    round: inp.round,
    northStar: inp.northStar,
    reviews: inp.reviews,
    priorBlockerIds: [...priorBlockerIds],
  });
  const obs = tracker.observe(result);
  // accumulate blocker ids (anti-oscillation) from this round's tally
  for (const b of result.tally.blockers) priorBlockerIds.add(b.id);

  if (result.dry && !result.empty && roundsToDry == null) roundsToDry = obs.countedRounds;

  const summary = {
    round: result.round,
    verdict: result.tally.verdict,
    dry: result.dry,
    empty: result.empty,
    newBlockers: result.tally.newBlockers.map((b) => ({ id: b.id, severity: b.severity, agreement: b.agreement, message: b.message })),
    allBlockers: result.tally.blockers.map((b) => b.id),
    demoted: result.tally.demoted.map((d) => ({ id: d.id, message: d.message })),
    quorum: result.quorum,
    conflicts: result.conflicts,
    debateFired: result.debate?.fired ?? false,
    judgeVerdict: result.judgeVerdict,
    direction: result.direction,
    counts: result.counts,
    trackerState: obs,
  };
  roundResults.push(result);
  fs.writeFileSync(path.join(runDir, `round-${result.round}-result.json`), JSON.stringify(summary, null, 2));
  console.log(`round ${result.round}: ${result.tally.verdict} | dry=${result.dry} empty=${result.empty} | newBlockers=${result.tally.newBlockers.length} | dryStreak=${obs.dryStreak}/${thresholds.N} | converged=${obs.converged}`);
}

const finalState = tracker.state();
convergence = {
  converged: finalState.converged,
  dryStreak: finalState.dryStreak,
  countedRounds: finalState.countedRounds,
  rounds: finalState.rounds,
  N: thresholds.N,
};

// suspiciously-dry honesty guard (single-family substrate => can FLAG, never mitigate)
const finalRound = roundResults[roundResults.length - 1];
const unresolvedHigh = countUnresolvedHighSeverity(finalRound.tally.findings);
const honesty = assessConvergenceHonesty({
  stakesTier: tier,
  roundsToDry: roundsToDry ?? finalState.countedRounds,
  unresolvedHighSeverity: unresolvedHigh,
  substrateFamilies: ['claude'],
  thresholds,
});

console.log(`\nTIER=${tier} | convergence=${JSON.stringify(convergence)} | unresolvedHigh=${unresolvedHigh}`);
console.log(`HONESTY GUARD: ${JSON.stringify(honesty)}`);

if (finalState.converged) {
  const deliverable = assembleDeliverable({
    mode: 'engine',
    rounds: roundResults,
    convergence,
    calibration: null,
    substrateFamilies: ['claude'],
    northStar: inputs[0].northStar,
  });
  const out = { deliverable, convergence, honesty, tier, thresholds, unresolvedHigh };
  fs.writeFileSync(path.join(runDir, 'DELIVERABLE-ENGINE.json'), JSON.stringify(out, null, 2));
  console.log(`\nCONVERGED. cross_model=${deliverable.cross_model} verified=${deliverable.verified}. Wrote DELIVERABLE-ENGINE.json`);
} else {
  console.log(`\nNOT converged yet — need dryStreak ${thresholds.N}; add the next round-input after fixing blockers.`);
}
