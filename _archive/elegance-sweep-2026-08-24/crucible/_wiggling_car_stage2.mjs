/**
 * Crucible Stage 2 launcher — The Wiggling Car (LITE).
 * NS locked by John 2026-08-22 (with the ±5σ road amendment). John pre-authorized
 * driving to the Foreman-ready plan ("let's lock and build — at least create final
 * plan that we can hand off to Foreman"); his formal approval lands ON the
 * Stage-2 implementation plan before Foreman runs.
 * Launch DETACHED via schtasks.
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { buildLiveCrucibleAgent } from './enhanced.mjs';
import { runStage2 } from './stage2.mjs';

const OUT = 'C:/dev/MBA Teaching AI/BA 815/Fall 2026/planning/crucible-wiggling-car';

const nsDoc = readFileSync(OUT + '/NORTH-STAR-CANDIDATE.md', 'utf8');
const draftDoc = readFileSync(OUT + '/stage1-artifacts/BEST-DRAFT.md', 'utf8');
let findingsDoc = '';
try { findingsDoc = readFileSync(OUT + '/stage1-artifacts/OPEN-FINDINGS.json', 'utf8'); } catch {}

const northStar =
  'NORTH STAR LOCKED 2026-08-22 by John (full file: ' + OUT + '/NORTH-STAR-CANDIDATE.md).\n\n' + nsDoc;

const masterPlan =
  'STAGE-1 MASTER PLAN (human-lockable HALT after a dry Shark round; zero two-reviewer blockers; ' +
  'John pre-authorized driving to the Foreman-ready implementation plan — his approval gate sits ON ' +
  "Stage 2's output). Decompose THIS:\n\n" + draftDoc +
  '\n\n=== 23 SINGLE-REVIEWER OPEN FINDINGS (Shark food — the decomposition must RESOLVE the ' +
  'operator-naming class: who runs the Canvas embed proof, who executes the browser matrix, who ' +
  'rehearses the run-of-show; a scratch-iframe local proxy stands in for Canvas until John, the ' +
  'only Canvas operator, closes the USER GATE) ===\n' + findingsDoc.slice(0, 12000);

const criteria = [
  'ACCURATE: shipped file provably IID N(0, sigma^2) via a MACHINE-COUNTABLE node test (extract and run ' +
    'the page sampling + stats functions; assert lag-1 rho ~ 0, bands -> 68.3/95.4/99.7, mu-hat level); ' +
    'every on-screen number derives from the recorded sample array (v2 bin-counting bug = named enemy).',
  'EASY TO USE: double-click file:// in Chrome/Edge/Firefox offline; Canvas LMS packaging note (upload + ' +
    'iframe) written step-exact; local scratch-iframe proof stands in until John closes the gate in his shell.',
  'ELEGANT AND SIMPLE: one page at 1366x768+; course palette; no text overflow to n=100,000; road spans ' +
    '+/-5 sigma with only 1/2/3-sigma lines drawn; nothing that does not serve the 68-95-99.7 punchline.',
  'CLASSROOM-READY: one-card run-of-show (the 3-minute arc) with the operator procedure for each beat.',
  'USER GATE: John approves on his own screen (visual + his course shell); agents never create the gate file.',
  'REFERENCE-IMPLEMENTATION CONSTRAINT: wiggling-car-v4.html is the base; waves modify this file or its ' +
    'promoted copy; a rewrite in another stack is a locked-scope violation - HALT.',
  'LITE: few small waves; every wave has a machine-countable gate command; ceremony beyond LITE violates ' +
    'the North Star words elegant and simple.',
  'Deliverables under BA 815/Fall 2026: the student-facing HTML, the run-of-show card, the Canvas note, ' +
    'the accuracy test under prototypes/tests/.',
];

mkdirSync(OUT + '/stage2-artifacts', { recursive: true });
mkdirSync(OUT + '/handoff', { recursive: true });

console.log('[wcar-stage2] building live cross-family agent...');
const { agent, tracker, routes } = await buildLiveCrucibleAgent({});
console.log('[wcar-stage2] agent built; routes=', JSON.stringify(routes));
console.log('[wcar-stage2] starting runStage2 (LITE)...');

try {
  const result = await runStage2({
    agent,
    northStar,
    masterPlan,
    criteria,
    depth: 'LITE',
    outputDir: OUT + '/handoff',
    artifactsDir: OUT + '/stage2-artifacts',
    statusLog: OUT + '/_crucible-status-stage2.log',
    routes,
    log: (m) => console.log('[stage2]', m),
  });
  writeFileSync(OUT + '/stage2-result.json', JSON.stringify({
    handed_off: !!(result && result.handedOff !== false),
    approved: result && result.approved,
    roundsRun: result && result.loop ? result.loop.roundsRun : result?.roundsRun ?? 'n/a',
    families: [...(tracker && tracker.families ? tracker.families() : [])],
    routes,
    ts: new Date().toISOString(),
  }, null, 2));
  console.log('[wcar-stage2] DONE — see handoff/ and stage2-result.json');
} catch (e) {
  writeFileSync(OUT + '/stage2-ERROR.txt', String((e && e.stack) || e));
  console.log('[wcar-stage2] HALT/ERROR:', e && e.message);
  console.log('[wcar-stage2] (a cap HALT emits the unapproved doc-trio to handoff/_unapproved-cap-draft)');
}
