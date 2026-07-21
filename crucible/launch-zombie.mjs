import fs from 'node:fs';
import path from 'node:path';
import { buildLiveCrucibleAgent } from './bin/enhanced.mjs';
import { runBrainstorm, triageIdeas, buildPhasedPlan, renderMasterPlanDraft, runMasterPlanLoop } from './bin/stage1.mjs';

const outputDir = path.resolve(process.cwd(), 'zombie-crucible-output');
fs.mkdirSync(outputDir, { recursive: true });

const statusLog = path.join(outputDir, '_crucible-status.log');
const artifactsDir = path.join(outputDir, 'artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });

const northStar = `Transform Zombie Hunter from an Anchor-specific utility into a global, system-wide AI process sentinel. 
Key objectives:
1. System-Wide Detection: Expand scope to monitor and track all AI-related processes across the OS (including Anchor, VS Code AI swarms, raw terminal processes, and cowork).
2. GUI Enhancements: Add a manual "Relaunch Sweep" button to the GUI for on-demand, fresh process updates.
3. Historical Forensics: Introduce a retrospective analysis feature that identifies evidence of past zombie swarms that consumed resources but evaded detection.
4. Human-in-the-Loop Approval: Replace automated kills with a human-facing approval workflow that freezes the rogue swarm. Include a toggleable "Show Context" button in the GUI to reveal (and hide) the detailed, human-readable explanation of what the process is and why it should be neutralized.`;

async function main() {
  process.env.CRUCIBLE_AGENT_LIVE = '1';
  process.env.GEMINI_MODEL = 'Gemini 3.1 Pro (High)';
  process.env.TRIO_TIER = 'heavy';

  const log = (m) => {
    console.log(m);
    fs.appendFileSync(statusLog, m + '\n');
  };
  
  // Prefs-driven seats (CODING_FAMILY / REVIEW_FAMILY or ~/.anchor/model_prefs.json).
  const { agent, routes, tracker, drafterFamily } = await buildLiveCrucibleAgent({
    env: process.env,
    target: process.cwd(),
    log,
  });
  log(`routes=${JSON.stringify(routes)} drafterFamily=${drafterFamily}`);
  
  log("Starting Stage 1 Brainstorm (FULL Depth)...");
  const criteria = [
      "System-wide detection across Anchor, VS Code, terminals, and cowork is functional",
      "GUI contains a working Relaunch Sweep button",
      "Forensics feature successfully identifies past undetected zombies",
      "Human-in-the-loop kill workflow is active with a Show Context toggle"
  ];
  
  const brainstorm = await runBrainstorm({ agent, northStar, criteria, log });
  const triage = triageIdeas({ ideas: brainstorm.ideas, log });
  const phased = await buildPhasedPlan({
    agent, northStar, criteria,
    ideas: triage.integrate, assumptions: brainstorm.assumptions, premortem: brainstorm.premortem, log,
  });
  
  log("Starting Stage 1 Shark-Tank Loop...");
  const loop = await runMasterPlanLoop({
    agent, northStar, criteria, draft: renderMasterPlanDraft(phased),
    routes, artifactsDir, statusLog, depth: 'FULL', log
  });
  
  log("Stage 1 HALTED for user approval.");
}

main().catch(err => {
  const msg = `HALT ERROR: ${err.message}\n`;
  console.error(msg);
  fs.appendFileSync(statusLog, msg);
});
