// Live Stage-1 launcher for the Tidy-Idy GUI effort (adapted from the proven
// launch-zombie.mjs). Seats from coding/review family prefs (no hardcoded Claude).
import fs from 'node:fs';
import path from 'node:path';
import { buildLiveCrucibleAgent } from './bin/enhanced.mjs';
import { runBrainstorm, triageIdeas, buildPhasedPlan, renderMasterPlanDraft, runMasterPlanLoop } from './bin/stage1.mjs';

const outputDir = 'C:/dev/plans/2026-07-tidy-idy-gui';
const statusLog = path.join(outputDir, '_crucible-status.log');
const artifactsDir = path.join(outputDir, 'artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });

const northStar = `Make a project's Tidy-Idy button in Anchor launch a background hygiene pass and open a project-tied Triage Panel presenting everything found — files to REMOVE, files to SAVE/COMMIT, and folder REORGANIZATIONS — as human-approvable decisions, applying only what the human approves as ONE git commit per Apply (undo = git revert), never losing work git holds and never acting without approval. The tidy-idy engine is EXTENDED, NOT FORKED, to add save-detection and reorg proposals and to run on ordinary (non-Foundry, possibly non-git) folders while preserving its removal pipeline and every safety invariant.`;

const criteria = [
  "One-click background run, project-scoped: clicking Tidy-Idy on project P starts a headless run over P's folder (like Gandalf), shows a live running state, and on completion opens a Triage Panel whose header unmistakably identifies P (name+path+git status+run#); a run never touches another project.",
  "Three finding classes from real analysis: removals each carrying the real Attacker+Judge verdict; save/commit candidates (untracked + uncommitted-modified); reorg proposals rendered as before->after trees. A failed analysis is shown LOUDLY, never a fake-clean panel.",
  "Nothing applied without approval: per-item/per-set approval then Apply lands all approved changes as ONE git commit (undo = git revert); protected classes (SKILL/README/tests/bin/journal/North-Star) never offered for removal.",
  "Runs on ordinary folders honestly: no North-Star file -> age/duplicate/orphan/untracked heuristics (labelled); non-git -> offer git init or mark advisory/read-only (no silent mutation); dirty tree handled not refused.",
  "Extend-don't-fork + green: reuses tidy-idy scanner/hygiene/analyze/debate/remove/compress modules + Anchor job_runner/Gandalf run path + Zombie-Sentinel-style GUI serving; the tidy-idy suite and new tests are green; existing substrate first.",
  "Investigator terminal tile (like Zombie Hunter): the panel includes an 'Investigate with an agent' tile opening a seeded terminal (Claude, toggle Gemini) loaded with the tidy-idy skill AND a briefing of the CURRENT report, tied to the same project.",
  "Report archive/history: every run's report is persisted per project newest-first (Gandalf run-index pattern); previous reports are kept as browsable references and never overwritten.",
];

async function main() {
  process.env.CRUCIBLE_AGENT_LIVE = '1';
  process.env.GEMINI_MODEL = 'Gemini 3.1 Pro (High)';
  process.env.TRIO_TIER = 'heavy';

  const log = (m) => { const line = typeof m === 'string' ? m : JSON.stringify(m); fs.appendFileSync(statusLog, line + '\n'); };
  log(`[launch] Tidy-Idy Stage-1 · ${new Date().toISOString()} · seats from coding/review family prefs`);

  // Omit routes → buildLiveCrucibleAgent uses CODING_FAMILY / REVIEW_FAMILY
  // (or ~/.anchor/model_prefs.json). Pass returned routes into runMasterPlanLoop
  // so the Judge stamp matches the real dispatch table.
  const { agent, routes: CRUCIBLE_ROUTES, drafterFamily } = await buildLiveCrucibleAgent({
    env: process.env, target: outputDir, log,
  });
  log(`[launch] drafterFamily=${drafterFamily} routes=${JSON.stringify(CRUCIBLE_ROUTES)}`);

  log('[stage1] brainstorm (assumption-map -> premortem -> ideate)…');
  const brainstorm = await runBrainstorm({ agent, northStar, criteria, log });
  const triage = triageIdeas({ ideas: brainstorm.ideas, log });
  const phased = await buildPhasedPlan({
    agent, northStar, criteria,
    ideas: triage.integrate, assumptions: brainstorm.assumptions, premortem: brainstorm.premortem, log,
  });

  log('[stage1] Shark-Tank loop (Gemini 3.1 Pro Sharks + Judge, cap 5 rounds)…');
  const loop = await runMasterPlanLoop({
    agent, northStar, criteria, draft: renderMasterPlanDraft(phased),
    routes: CRUCIBLE_ROUTES, artifactsDir, statusLog, depth: 'FULL', statusLabel: 'Tidy-Idy plan', log,
  });

  // Persist the converged/best Master-Plan draft for the user-approval gate.
  const finalDraft = loop.finalDraft || loop.draft || renderMasterPlanDraft(phased);
  fs.writeFileSync(path.join(outputDir, 'MASTER-PLAN-DRAFT.md'), String(finalDraft), 'utf8');
  fs.writeFileSync(path.join(outputDir, '_stage1-result.json'), JSON.stringify({
    roundsRun: loop.roundsRun, converged: !!loop.converged, findings: (loop.openFindings || []).length,
  }, null, 2), 'utf8');
  log(`[stage1] HALT for user approval · rounds=${loop.roundsRun} converged=${!!loop.converged}`);
}

main().catch((err) => { const msg = `[HALT ERROR] ${err && err.stack || err}\n`; try { fs.appendFileSync(statusLog, msg); } catch {} console.error(msg); process.exit(1); });
