import { writeFileSync } from 'node:fs';
import { buildLiveCrucibleAgent } from './enhanced.mjs';
import { runStage1 } from './stage1.mjs';

const OUT = 'C:/dev/MBA Teaching AI/BA 815/Fall 2026/planning/crucible-wiggling-car';

const northStar =
  "Ship 'The Wiggling Car' as a classroom-ready interactive for BA 815 (MBA business statistics) - " +
  "ACCURATE, EASY TO USE, ELEGANT, SIMPLE (John's four words, locked 2026-08-22). Prototype v4 " +
  "(BA 815/Fall 2026/prototypes/wiggling-car-v4.html) IS the locked reference implementation: a " +
  "single self-contained vanilla-HTML/canvas file in which a car steers smoothly through IID " +
  "N(0, 0.49) lateral draws; each draw flashes on the road, lands in a table, and stacks into a " +
  "histogram with a live normal overlay, running mu = sum/n, sigma, and 68.3/95.4/99.7 band " +
  "percentages; speed x1/x10/x100 plus a +5,000-draws fast-forward. LOCK AMENDMENT: the road's " +
  "vertical scale spans +/-5 sigma with only the +/-1/2/3-sigma lines drawn - empty space beyond. " +
  "The plan HARDENS AND PACKAGES THIS FILE; it never re-architects it. NON-GOALS (cut aloud): no " +
  "frameworks/rewrites (no React, Python, notebooks, CDN, server); no additional statistics " +
  "modules (sampling distribution of the mean, CIs, CLT-of-averages = 2027 backlog); no " +
  "mobile-first work beyond not-broken; no sound; no seed mode unless John asks.";

const criteria = [
  "ACCURATE: the shipped file's measured data is provably IID N(0, sigma^2) - an automated check " +
    "(node script against the extracted JS, or an in-page self-test) verifies lag-1 rho ~ 0, band " +
    "percentages -> 68.3/95.4/99.7, and mu-hat level at large n; AND every number on screen " +
    "(table rows, mu, sigma, band %s) derives from the same recorded sample array - no display " +
    "shortcut may diverge from the data (the v2 bin-counting bug is the named enemy class).",
  "EASY TO USE: double-click opens offline in Chrome, Edge and Firefox; embeds in Canvas LMS via " +
    "file upload + iframe page (packaging instructions written for John, verified once in his " +
    "course shell as the USER GATE's second half); the whole classroom arc (x1 watch -> x10 " +
    "ribbon -> +5,000 punchline) uses only the four existing controls.",
  "ELEGANT AND SIMPLE: one page at 1366x768 and up; course palette; no text overflow at any n up " +
    "to 100,000 (the mu line is the named regression); road spans +/-5 sigma with only 1/2/3-sigma " +
    "lines; nothing on screen that does not serve the 68-95-99.7 punchline.",
  "CLASSROOM-READY: a one-card run-of-show (the ~3-minute arc: what to say at x1, when to flip " +
    "x10, when to press +5,000, the closing line on 68-95-99.7).",
  "USER GATE: John approves on his own screen; his approval closes the effort. Agents never " +
    "create the gate file.",
];

const acceptanceCriteria = [
  "REFERENCE-IMPLEMENTATION CONSTRAINT: wiggling-car-v4.html is the base; waves modify THIS file " +
    "(or a copy promoted to the deliverable name). A wave that proposes a rewrite in another " +
    "stack/library is out of scope by the locked North Star - HALT, do not argue.",
  "The accuracy check must be MACHINE-COUNTABLE (a node test that extracts and runs the page's " +
    "sampling + stats functions and asserts rho/bands/mu within tolerances), not prose.",
  "LITE BAND knobs: single-pass brainstorm, Shark round cap 1, 2 concurrent Sharks - this is a " +
    "one-file hardening effort; ceremony beyond LITE is itself a North-Star violation (elegant, " +
    "simple).",
  "Deliverables land under BA 815/Fall 2026: the final HTML (student-facing name, e.g. " +
    "'The Wiggling Car.html'), the run-of-show card (markdown), the Canvas packaging note, and " +
    "the accuracy test under prototypes/tests/.",
];

console.log('[wcar-stage1] building live cross-family agent...');
const { agent, tracker, routes } = await buildLiveCrucibleAgent({});
console.log('[wcar-stage1] agent built; routes=', JSON.stringify(routes));
console.log('[wcar-stage1] starting runStage1 (LITE)...');

try {
  const result = await runStage1({
    agent,
    northStar,
    criteria,
    acceptanceCriteria,
    depth: 'LITE',
    artifactsDir: OUT + '/stage1-artifacts',
    statusLog: OUT + '/_crucible-status.log',
    routes,
    log: (m) => console.log('[stage1]', m),
  });
  writeFileSync(OUT + '/stage1-result.json', JSON.stringify(result, null, 2));
  const plan = result.plan || {};
  const loop = result.loop || {};
  const md = [
    '# Master Plan (DRAFT) - The Wiggling Car (Crucible LITE)',
    '', "_Stage 1 output. DRAFT for John's approval._", '',
    '## Convergence',
    '- converged: ' + JSON.stringify(loop.converged ?? loop.status ?? 'see stage1-result.json'),
    '- rounds: ' + JSON.stringify(loop.rounds ?? loop.round ?? 'n/a'),
    '- open findings: ' + JSON.stringify((loop.openFindings || loop.findings || []).length ?? 'n/a'),
    '- families reached: ' + JSON.stringify([...(tracker && tracker.families ? tracker.families() : [])]),
    '',
    '## Phased plan',
    '```json',
    JSON.stringify(plan, null, 2),
    '```',
  ].join('\n');
  writeFileSync(OUT + '/MASTER-PLAN-DRAFT.md', md);
  console.log('[wcar-stage1] DONE - wrote MASTER-PLAN-DRAFT.md + stage1-result.json');
} catch (e) {
  writeFileSync(OUT + '/stage1-ERROR.txt', String((e && e.stack) || e));
  console.log('[wcar-stage1] HALT/ERROR:', e && e.message);
  console.log('[wcar-stage1] (a round-cap HALT is normal - best draft persists in stage1-artifacts/)');
}
