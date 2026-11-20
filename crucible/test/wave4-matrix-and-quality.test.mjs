// test/wave4-matrix-and-quality.test.mjs — Wave 4 verification suite for Crucible:
//   1. Real `--matrix-fast-track` (6–9 bounded calls, Anvil AST Stage-0 intake + fallback,
//      Superjump option pass, L0–L5 6-layer matrix, 0-blocker immediate stop per ELEGANCE Rule 5,
//      120s delta verify on blockers, deterministic Stage-2 `## Wave N` + `### Wave W.k` sub-waves,
//      `locate-plan.mjs` validation, retiring duplicate Stage-2 Shark-Tank + Stage-2 Elegance loop)
//   2. Enforced `LITE` <= 4 model-call cap (`runLiteFastPath`)
//   3. Stage-2 wave header preservation (`reviseDraft` + `revisePrompt` with `preserveWaveHeaders`)
//   4. `elegance-hooks.mjs` contiguous `w.n` (`1..K`) renumbering + non-linear DAG `dependsOn` remapping
//   5. Boolean `traces_to_north_star === true` in Shark-Tank, Stage-1 triage, and Drift gate
//   6. Hardening-gate `/\bcontain(?:ment|ed|s)?\b/i` & `'plan'`/`'named'` stopword tightening
//   7. Actual served driver/family recorded in Judge & Stage-1 receipts/stamps
//   8. Mechanical Chekhov `PROCESS-REVIEW.md` plan-quality guards & Portfolio Skill Composition
//   9. Zero phantom `claude-fable-5` strings in `crucible/bin` & `crucible/test`

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveBandProfile, normalizeBandDepth } from '../bin/band-profile.mjs';
import {
  LITE_MAX_MODEL_CALLS,
  MATRIX_MAX_MODEL_CALLS,
  DELTA_VERIFY_TIMEOUT_MS,
  createCallBudgetedAgent,
  runAnvilBrownfieldIntake,
  validateTestCommandPreflight,
  runLiteFastPath,
  runMatrixFastTrack,
} from '../bin/matrix-fast-track.mjs';
import {
  checkWave1PilotSlice,
  checkCallLatencyBudget,
  checkApprovalBlockWordBudget,
  formatPlainEnglishApprovalGate,
  detectPortfolioSkillGates,
  partitionDisjointSubWaves,
  runChekhovPlanQualityLint,
} from '../bin/plan-quality-gates.mjs';
import { applyVerdictsToWaves, applyWaveMerges } from '../bin/elegance-hooks.mjs';
import { tallyFindings, tracesToNorthStar } from '../bin/shark-tank.mjs';
import { classifyDriftOption } from '../bin/gates.mjs';
import { detectPropertyClaims, checkPropertyGates } from '../bin/hardening-gate.mjs';
import { makeJudge } from '../bin/judge.mjs';
import { triageDisposition, revisePrompt, reviseDraft, runMasterPlanLoop } from '../bin/stage1.mjs';
import { runStage2 } from '../bin/stage2.mjs';

function makeTempDir(t, prefix = 'crucible-w4-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('MATRIX-FAST-TRACK is a first-class band in band-profile.mjs (never falls through to FULL)', () => {
  assert.equal(normalizeBandDepth('MATRIX-FAST-TRACK'), 'MATRIX-FAST-TRACK');
  assert.equal(normalizeBandDepth('matrix'), 'MATRIX-FAST-TRACK');
  assert.equal(normalizeBandDepth('fast-track'), 'MATRIX-FAST-TRACK');

  const mft = resolveBandProfile('MATRIX-FAST-TRACK');
  assert.equal(mft.depth, 'MATRIX-FAST-TRACK');
  assert.equal(mft.matrixFastTrack, true);
  assert.equal(mft.maxModelCalls, 9);
  assert.equal(mft.skipStage2SharkLoop, true);
  assert.equal(mft.skipStage2ElegancePass, true);

  const lite = resolveBandProfile('LITE');
  assert.equal(lite.maxModelCalls, 4);
  assert.equal(lite.skipStage2SharkLoop, true);
});

test('Anvil Stage-0 brownfield AST intake runs in 0 LLM calls and falls back cleanly when anvil_engine.py is absent', (t) => {
  const repo = makeTempDir(t, 'crucible-anvil-');
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'demo', scripts: { test: 'node --test' } }), 'utf8');
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src', 'core.mjs'), 'export function computeDelta(a, b) { return a - b; }\n', 'utf8');

  const fallback = runAnvilBrownfieldIntake({
    repoDir: repo,
    anvilPath: path.join(repo, 'nonexistent-anvil.py'),
  });
  assert.equal(fallback.ok, true);
  assert.equal(fallback.source, 'deterministic-scan');
  assert.equal(fallback.llmCalls, 0);
  assert.ok(fallback.elapsedMs < 2000);
  assert.ok(fallback.facts.files.includes('src/core.mjs'));
  assert.ok(fallback.facts.symbols.some((s) => s.includes('computeDelta')));

  const fakeAnvil = path.join(repo, 'fake_anvil.py');
  fs.writeFileSync(fakeAnvil, '# stub\n', 'utf8');
  const spawnCalls = [];
  const astRes = runAnvilBrownfieldIntake({
    repoDir: repo,
    anvilPath: fakeAnvil,
    spawn: (cmd, args, opts) => {
      spawnCalls.push({ cmd, args, opts });
      return { status: 0, stdout: JSON.stringify({ fileCount: 2, files: ['src/core.mjs'], symbols: ['computeDelta'] }) };
    },
  });
  assert.equal(astRes.ok, true);
  assert.equal(astRes.source, 'anvil-ast');
  assert.equal(astRes.llmCalls, 0);
  assert.equal(spawnCalls[0].opts.windowsHide, true);
  assert.equal(spawnCalls[0].opts.shell, false);
});

test('validateTestCommandPreflight catches PowerShell && chaining and Windows node --test test/ traps', () => {
  assert.equal(validateTestCommandPreflight({ testCommand: 'npm build && npm test' }).ok, false);
  assert.equal(validateTestCommandPreflight({ testCommand: 'node --test test/' }).ok, false);
  assert.equal(validateTestCommandPreflight({ testCommand: 'node scripts/run-all-tests.mjs' }).ok, true);
});

test('Enforced LITE fast path stays <= 4 model calls and halts if a 5th call is attempted', async (t) => {
  const outDir = makeTempDir(t, 'crucible-lite-cap-');
  const slimPlan = [
    '# North Star',
    'Ship a tiny JSON validator CLI.',
    '',
    'test-command: node --test test/*.test.mjs',
    '',
    '## Wave 1 — CLI Validator Slice',
    '- bin/validate.mjs — runnable CLI validator',
    '- test/validate.test.mjs — unit tests',
    '**done-when:** CLI validates JSON files end-to-end and unit tests pass (oracle: `node --test test/*.test.mjs` exits 0).',
  ].join('\n');

  let calls = 0;
  const agent = async (_prompt, opts = {}) => {
    calls += 1;
    if (opts.label === 'lite:stage0-intake') return 'Validate JSON files from the CLI with zero deps.';
    if (opts.label === 'slim:plan') return slimPlan;
    if (opts.label === 'shark:slim-review') {
      return { verdict: 'REVISE', findings: [{ severity: 'MAJOR', issue: 'clarify exit code on invalid JSON', fix: 'exit 2 on syntax error' }] };
    }
    if (opts.label === 'slim:revise') return slimPlan.replace('exits 0', 'exits 0; invalid JSON exits 2');
    throw new Error(`unexpected label ${opts.label}`);
  };

  const res = await runLiteFastPath({
    agent,
    task: 'Build a tiny JSON validator CLI in bin/validate.mjs',
    frameIntake: true,
    outDir,
  });
  assert.equal(res.band, 'LITE');
  assert.equal(res.calls, 4);
  assert.ok(res.calls <= LITE_MAX_MODEL_CALLS);
  assert.equal(res.handoff.pass, true);

  // Also prove a 5th model call is refused by the hard LITE <= 4 call budget:
  const capped = createCallBudgetedAgent(async () => 'ok', { maxCalls: LITE_MAX_MODEL_CALLS, bandName: 'LITE' });
  for (let i = 0; i < LITE_MAX_MODEL_CALLS; i++) await capped('p', { label: `c${i + 1}` });
  await assert.rejects(() => capped('p', { label: 'c5' }), /LITE model-call cap exceeded/);
});

test('runMatrixFastTrack: 0-blocker dry L0–L5 matrix stops immediately in 6 calls (ELEGANCE Rule 5) and passes locate-plan.mjs', async (t) => {
  const outDir = makeTempDir(t, 'crucible-mft-dry-');
  const repoDir = makeTempDir(t, 'crucible-mft-repo-');
  fs.mkdirSync(path.join(repoDir, 'src', 'alpha'), { recursive: true });
  fs.mkdirSync(path.join(repoDir, 'src', 'beta'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, 'src', 'alpha', 'a.mjs'), 'export const a = 1;\n', 'utf8');
  fs.writeFileSync(path.join(repoDir, 'src', 'beta', 'b.mjs'), 'export const b = 2;\n', 'utf8');

  const labels = [];
  const agent = async (_prompt, opts = {}) => {
    labels.push(opts.label);
    if (typeof opts.onReceipt === 'function') {
      await opts.onReceipt({
        served: {
          driver: opts.role === 'shark' ? 'gemini' : 'claude',
          family: opts.role === 'shark' ? 'gemini' : 'claude',
          model: opts.role === 'shark' ? 'gemini-3.1-pro' : 'claude-opus-4-6',
        },
      });
    }
    if (opts.label === 'matrix:stage0-frame') {
      return {
        northStar: 'Ship an end-to-end brownfield CLI report generator with disjoint module sub-waves.',
        criteria: ['CLI runs end-to-end in Wave 1', 'All tests pass'],
        deferredScope: ['PDF export'],
        competingDesigns: 2,
      };
    }
    if (opts.label === 'matrix:superjump-options') {
      return {
        options: [
          { id: 'opt-a', name: 'Pure-Core Pipeline', summary: 'Functional core + thin CLI shell', tradeOffs: 'Minimal state' },
          { id: 'opt-b', name: 'Plugin Bus', summary: 'Dynamic plugin registry', tradeOffs: 'Extra indirection' },
        ],
        selectedOption: 'opt-a',
        rationale: 'Deep module with small interface',
      };
    }
    if (opts.label === 'matrix:draft') {
      return {
        title: 'CLI Report Generator',
        summary: 'Two-wave brownfield upgrade.',
        cutElement: 'Dropped dynamic plugin bus in favor of direct functional core.',
        deferredScope: ['HTML theme marketplace'],
        waves: [
          {
            title: 'Runnable End-to-End CLI Pilot',
            intent: 'Ship working CLI command and alpha/beta modules.',
            deliverables: ['bin/report-cli.mjs', 'src/alpha/parser.mjs', 'src/beta/formatter.mjs'],
            dependsOn: [],
            doneWhen: 'bin/report-cli.mjs executes end-to-end and unit tests pass.',
            gwt: [{ given: 'valid input', when: 'report-cli runs', then: 'prints formatted report and exits 0' }],
          },
          {
            title: 'Edge-Case Regression Suite',
            intent: 'Add malformed-input tests.',
            deliverables: ['test/report-cli.test.mjs'],
            dependsOn: [1],
            doneWhen: 'regression suite passes via node scripts/run-all-tests.mjs.',
            gwt: [{ given: 'corrupt input', when: 'report-cli runs', then: 'exits 2 with clear diagnostic' }],
          },
        ],
      };
    }
    if (opts.label?.startsWith('matrix:L')) {
      return { layersChecked: ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'], findings: [] };
    }
    throw new Error(`unexpected call ${opts.label}`);
  };

  const res = await runMatrixFastTrack({
    agent,
    intent: 'Upgrade brownfield CLI report generator',
    repoDir,
    outputDir: outDir,
    approved: true,
  });

  assert.equal(res.band, 'MATRIX-FAST-TRACK');
  assert.equal(res.calls, 6, `expected 6 calls (stage0 + superjump + draft + 3 matrix seats), got ${res.calls}: ${labels.join(',')}`);
  assert.equal(res.revised, false, '0 blockers stops immediately per ELEGANCE Rule 5');
  assert.equal(res.handoff.handed_off, true, 'emitted plan passes locate-plan.mjs machine gate');
  assert.equal(res.handoff.gate.pass, true);
  assert.match(res.plan, /### Wave 1\.1\b/, 'emits disjoint-write-set ### Wave W.k sub-waves');
  assert.equal(res.chekhov.wordBudget.pass, true);
  assert.match(res.gateBlock, /Deferred\/cut scope:/);
});

test('runMatrixFastTrack: blocking L0–L5 finding triggers 1 targeted patch + 1 120s delta verify (<= 9 calls)', async (t) => {
  const outDir = makeTempDir(t, 'crucible-mft-delta-');
  const seenTimeouts = [];
  const agent = async (_prompt, opts = {}) => {
    if (opts.label === 'matrix:delta-verify') seenTimeouts.push(opts.timeoutMs);
    if (opts.label === 'matrix:stage0-frame') {
      return {
        northStar: 'Deliver safe path-confined config loader CLI.',
        criteria: ['Rejects path traversal'],
        deferredScope: [],
        competingDesigns: 1,
      };
    }
    if (opts.label === 'matrix:draft') {
      return {
        title: 'Safe Config CLI',
        summary: 'Single-wave CLI.',
        cutElement: 'none',
        waves: [{
          title: 'CLI Loader',
          intent: 'Load config from CLI flag.',
          deliverables: ['bin/load-cfg.mjs'],
          dependsOn: [],
          doneWhen: 'CLI loads config end-to-end.',
          gwt: [{ given: 'valid config', when: 'CLI runs', then: 'prints parsed keys' }],
        }],
      };
    }
    if (opts.label === 'matrix:L0-L5:northstar-simplicity') return { layersChecked: ['L0', 'L5'], findings: [] };
    if (opts.label === 'matrix:L1-L2:arch-security') {
      return {
        layersChecked: ['L1', 'L2'],
        findings: [{
          layer: 'L2',
          topic: 'cwe22-guard',
          severity: 'BLOCKER',
          traces_to_north_star: true,
          message: 'Missing realpath boundary check against .. traversal',
          fix: 'Enforce realpath containment test in Wave 1 done-when',
        }],
      };
    }
    if (opts.label === 'matrix:L3-L4:surface-budget') return { layersChecked: ['L3', 'L4'], findings: [] };
    if (opts.label === 'matrix:revise') {
      return {
        title: 'Safe Config CLI',
        summary: 'Patched CWE-22 check.',
        waves: [{
          title: 'CLI Loader with Realpath Boundary',
          intent: 'Load config safely from CLI.',
          deliverables: ['bin/load-cfg.mjs', 'test/load-cfg.test.mjs'],
          dependsOn: [],
          doneWhen: 'CLI loads config end-to-end and rejects ../ escape attempts via realpath check.',
          gwt: [{ given: '../secret path', when: 'CLI runs', then: 'refuses with exit code 2' }],
        }],
      };
    }
    if (opts.label === 'matrix:delta-verify') {
      return { resolved: true, remainingBlockers: [] };
    }
    throw new Error(`unexpected label ${opts.label}`);
  };

  const res = await runMatrixFastTrack({
    agent,
    intent: 'Build safe path-confined config loader CLI',
    outputDir: outDir,
    approved: true,
  });

  assert.equal(res.revised, true);
  assert.ok(res.calls <= MATRIX_MAX_MODEL_CALLS, `calls ${res.calls} <= ${MATRIX_MAX_MODEL_CALLS}`);
  assert.deepEqual(seenTimeouts, [DELTA_VERIFY_TIMEOUT_MS]);
  assert.equal(res.handoff.handed_off, true);
  assert.equal(res.handoff.gate.pass, true);
});

test('Stage-2 reviseDraft + revisePrompt preserve ## Wave N headers and never label Stage 2 as STAGE-1 Master-Plan', async () => {
  const wavePlan = [
    '# Demo Implementation Plan',
    '',
    'test-command: node scripts/run-all-tests.mjs',
    '',
    '## Wave 1 — End-to-End CLI',
    '**done-when:** CLI runs and tests pass.',
  ].join('\n');

  const p = revisePrompt({
    northStar: 'Ship CLI',
    draft: wavePlan,
    verdict: { blockers: [{ severity: 'BLOCKER', message: 'tighten test' }] },
    direction: { lean: 'converge', probingBrief: 'keep waves' },
    stageLabel: 'STAGE-2',
    artifactName: 'the Implementation Plan (Stage 2)',
    preserveWaveHeaders: true,
  });
  assert.match(p, /STAGE-2 Implementation-Plan wave-preserving/);
  assert.doesNotMatch(p, /STAGE-1 draft-revision/);

  // Free-text revision that strips ## Wave 1 is rejected when preserveWaveHeaders: true!
  const freeTextProse = '# Master Plan Prose\n\nPhase 1: we will think about things without wave headers.\n'.repeat(8);
  const rev = await reviseDraft({
    agent: async () => ({ draft: freeTextProse, changelog: ['rewrote into prose'] }),
    northStar: 'Ship CLI',
    draft: wavePlan,
    verdict: { blockers: [{ severity: 'BLOCKER', message: 'tighten' }, { severity: 'BLOCKER', message: 'more' }, { severity: 'BLOCKER', message: 'three' }] },
    direction: { lean: 'converge', probingBrief: 'patch' },
    round: 1,
    stageLabel: 'STAGE-2',
    artifactName: 'the Implementation Plan (Stage 2)',
    preserveWaveHeaders: true,
  });
  assert.equal(rev.draft, wavePlan, 'wave-stripping revision is rejected so ## Wave N survives');
});

test('runStage2 on MATRIX-FAST-TRACK skips duplicate Stage-2 Shark-Tank + Stage-2 Elegance loop', async (t) => {
  const outDir = makeTempDir(t, 'crucible-s2-mft-');
  const seenLabels = [];
  const agent = async (_prompt, opts = {}) => {
    seenLabels.push(opts.label);
    if (opts.label === 'stage2:decompose') {
      return {
        waves: [{
          title: 'Working CLI Pilot',
          intent: 'Ship CLI entrypoint',
          deliverables: ['bin/pilot.mjs'],
          dependsOn: [],
          doneWhen: 'CLI runs end-to-end and tests pass.',
          gwt: [{ given: 'input', when: 'pilot runs', then: 'outputs result' }],
        }],
      };
    }
    throw new Error(`Stage-2 should NOT spawn extra Shark/Elegance calls on MATRIX-FAST-TRACK; saw ${opts.label}`);
  };

  const res = await runStage2({
    agent,
    northStar: 'Ship working CLI pilot',
    masterPlan: '# Master Plan\n\nDeliver CLI pilot.',
    outputDir: outDir,
    matrixFastTrack: true,
    approved: true,
  });
  assert.deepEqual(seenLabels, ['stage2:decompose'], 'only wave decomposition ran; zero duplicate Stage-2 Shark/Elegance calls');
  assert.equal(res.loop.skippedDuplicateStage2Loop, true);
  assert.equal(res.handoff.handed_off, true);
  assert.equal(res.handoff.gate.pass, true);
});

test('elegance-hooks.mjs renumbers w.n contiguously (1..K) AND remaps non-linear DAG dependsOn without clobbering to i - 1', () => {
  // 4-wave diamond DAG: Wave 1 (root), Wave 2 (cut!), Wave 3 (dependsOn [1]), Wave 4 (dependsOn [1, 3])
  const waves = [
    { n: 1, title: 'Root Core', deliverables: ['src/root.mjs'], dependsOn: [], gwt: [] },
    { n: 2, title: 'Cut Plumbing', deliverables: ['src/dead.mjs'], dependsOn: [1], gwt: [] },
    { n: 3, title: 'Branch B', deliverables: ['src/branch-b.mjs'], dependsOn: [1], gwt: [] },
    { n: 4, title: 'Join Leaf', deliverables: ['src/join.mjs'], dependsOn: [1, 3], gwt: [] },
  ];
  const cutWave2 = [{ id: 'W2.1', verdict: 'CUT', reason: 'unneeded' }];
  const afterDrop = applyVerdictsToWaves(waves, cutWave2);
  assert.deepEqual(afterDrop.map((w) => w.n), [1, 2, 3], 'waves renumbered contiguously 1..3');
  assert.deepEqual(afterDrop[0].dependsOn, null);
  assert.deepEqual(afterDrop[1].dependsOn, [1], 'former Wave 3 keeps dependency on Wave 1');
  assert.deepEqual(afterDrop[2].dependsOn, [1, 2], 'former Wave 4 remaps [1, 3] -> [1, 2] instead of clobbering to [2]');

  // Merge test: merge Waves 1 & 2 in a 4-wave DAG where Wave 4 depended on [1, 3] (NOT Wave 2) and Wave 3 had []!
  const dagForMerge = [
    { n: 1, title: 'A1', intent: 'i1', deliverables: ['a1.mjs'], dependsOn: [], doneWhen: 'd1', gwt: [] },
    { n: 2, title: 'A2', intent: 'i2', deliverables: ['a2.mjs'], dependsOn: [1], doneWhen: 'd2', gwt: [] },
    { n: 3, title: 'Independent Root', intent: 'i3', deliverables: ['ind.mjs'], dependsOn: [], doneWhen: 'd3', gwt: [] },
    { n: 4, title: 'Join', intent: 'i4', deliverables: ['join.mjs'], dependsOn: [1, 3], doneWhen: 'd4', gwt: [] },
  ];
  const merged = applyWaveMerges(dagForMerge, [{ waves: [1, 2], reason: 'tightly coupled' }]);
  assert.deepEqual(merged.waves.map((w) => w.n), [1, 2, 3]);
  assert.deepEqual(merged.waves[0].dependsOn, null);
  assert.deepEqual(merged.waves[1].dependsOn, null, 'independent Wave 3 stays independent (NOT clobbered to [1]!)');
  assert.deepEqual(merged.waves[2].dependsOn, [1, 2], 'Join wave remaps [1, 3] -> [1, 2]');
});

test('Boolean traces_to_north_star === true is honored across Shark-Tank, Stage-1 triage, and Drift gate', () => {
  assert.equal(tracesToNorthStar(true), true);
  assert.equal(tracesToNorthStar(false), false);
  assert.equal(tracesToNorthStar('false'), false);
  assert.equal(tracesToNorthStar('Criterion 1'), true);

  const tally = tallyFindings([
    {
      reviewer: 'skeptic',
      findings: [{ topic: 'blk-bool', severity: 'BLOCKER', traces_to_north_star: true, message: 'breaks North Star' }],
    },
    {
      reviewer: 'pragmatist',
      findings: [{ topic: 'blk-bool', severity: 'BLOCKER', traces_to_north_star: true, message: 'agreed blocker' }],
    },
  ]);
  assert.equal(tally.blockers.length, 1, 'boolean true traces_to_north_star is NOT demoted');
  assert.equal(tally.dry, false);

  assert.equal(
    triageDisposition({ id: 'idea-1', bucket: 'integrate', traces_to_north_star: true }),
    'integrate',
  );
  assert.equal(
    triageDisposition({ id: 'idea-2', bucket: 'integrate', traces_to_north_star: false }),
    'grasscatcher',
  );

  const driftOpt = classifyDriftOption({ option: 'Keep core lean', traces_to_north_star: true });
  assert.equal(driftOpt.option, 'B');
  assert.equal(driftOpt.resolution, 'north-star-amendment');
});

test('Hardening gate tightens /\\bcontain(?:ment|ed|s)?\\b/i and drops overly broad plan/named stopwords', () => {
  // CSS `container` layout word must NOT falsely trigger filesystem containment claims:
  const uiClaims = detectPropertyClaims(' wave 1: style the flex container and named CSS grid layout in plan.css ');
  assert.equal(uiClaims.some((c) => c.id === 'containment'), false, '`container` does not false-trigger containment');

  // Real `containment` claim DOES trigger, and bare words `plan` / `named` do NOT satisfy numeric bounds or containment:
  const realContainment = detectPropertyClaims('Enforce strict path containment inside the workspace root.');
  assert.equal(realContainment.some((c) => c.id === 'containment'), true);

  const weakBoundsCheck = checkPropertyGates({
    plan: 'The cache stays bounded so memory never explodes.',
    waves: [{ n: 1, doneWhen: 'The named plan is written to disk.' }],
    addsSurface: false,
  });
  assert.equal(weakBoundsCheck.pass, false, 'generic words `named`/`plan` no longer spoof concrete numeric bound + refusal checks');
});

test('Judge and Stage-1 runMasterPlanLoop record actual served driver/family in receipts instead of hardcoding claude', async () => {
  const jdg = makeJudge({
    agent: async (_prompt, opts = {}) => {
      if (typeof opts.onReceipt === 'function') {
        opts.onReceipt({ served: { driver: 'chatgpt', family: 'chatgpt', model: 'gpt-5.4' } });
      }
      return { decision: 'CONVERGED', reasons: ['all criteria met'], blocking: [] };
    },
  });
  const verdict = await jdg.decide({ northStar: 'Ship feature', findings: [], round: 1 });
  assert.equal(verdict.stamp.family, 'chatgpt');
  assert.equal(verdict.stamp.model, 'gpt-5.4');
  assert.equal(verdict.stamp.cross_model, true);

  const loop = await runMasterPlanLoop({
    northStar: 'Ship feature',
    draft: '# Master Plan\n\nShip feature cleanly.',
    sharkRoles: 2,
    agent: async (_prompt, opts = {}) => {
      if (typeof opts.onReceipt === 'function') {
        opts.onReceipt({ served: { driver: 'gemini', family: 'gemini', model: 'gemini-3.1-pro' } });
      }
      if (String(opts.label || '').startsWith('shark:')) return { findings: [] };
      if (String(opts.label || '').startsWith('synthesizer:')) {
        return { lean: 'converge', probingBrief: 'ready', openThreads: [], oranges: [] };
      }
      if (String(opts.label || '').startsWith('fresh-eyes:')) {
        return { readyToLock: true, summary: 'clean', missedConcerns: [] };
      }
      if (String(opts.label || '').startsWith('judge:')) {
        return { decision: 'CONVERGED', reasons: ['clean'], blocking: [] };
      }
      return {};
    },
  });
  assert.equal(loop.converged, true);
  assert.deepEqual(loop.servedFamilies, ['gemini']);
  assert.equal(loop.judgeStamp.family, 'gemini');
  assert.doesNotMatch(loop.seatStamp, /claude/);
});

test('Chekhov Plan-Quality Guards: Wave-1 pilot slice, O(N) call budget, <=200-word gate, UI mockup & domain certifier composition', () => {
  // 1. Reject >=3-wave plan with plumbing-only Waves 1 & 2:
  const plumbingWaves = [
    { n: 1, title: 'Database Schema DDL', deliverables: ['db/schema.sql'], doneWhen: 'schema migration table created' },
    { n: 2, title: 'Internal TypeScript Interfaces', deliverables: ['src/types/models.d.ts'], doneWhen: 'internal types compile' },
    { n: 3, title: 'CLI Entrypoint', deliverables: ['bin/app.mjs'], doneWhen: 'CLI runs end-to-end' },
  ];
  const pilotFail = checkWave1PilotSlice({ waves: plumbingWaves });
  assert.equal(pilotFail.pass, false);
  assert.equal(checkWave1PilotSlice({ waves: plumbingWaves, pilotOverrideReason: 'regulated schema freeze' }).pass, true);

  // 2. Flag unbounded per-chapter / per-file serial LLM spawns; pass when batched/concurrency-capped:
  const serialBad = checkCallLatencyBudget({
    waves: [{ n: 1, title: 'Analyze Book', intent: 'Spawn a fresh LLM agent for each chapter in the novel to extract entities.' }],
  });
  assert.equal(serialBad.pass, false);
  const batchedOk = checkCallLatencyBudget({
    waves: [{ n: 1, title: 'Analyze Book', intent: 'Process chapters in batches of 10 with max concurrency capped at 4.' }],
  });
  assert.equal(batchedOk.pass, true);

  // 3. Approval block stays <= 200 words and names deferred scope in plain English:
  const gateText = formatPlainEnglishApprovalGate({
    goal: 'Build interactive cap-table waterfall dashboard with verified math.',
    deferredScope: ['Multi-currency FX feed', 'SSO SAML integration'],
    artifactPath: 'IMPLEMENTATION-PLAN.md',
  });
  assert.equal(checkApprovalBlockWordBudget(gateText).pass, true);
  assert.match(gateText, /Deferred\/cut scope: Multi-currency FX feed; SSO SAML integration/);

  // 4. Portfolio skill gates auto-attach Chrome UI mockup, Figure-Designer, Ramanujan, Financial-Analyst, Legal-Beagle, Literature-Review:
  const gates = detectPortfolioSkillGates({
    intent: 'Build interactive equity waterfall valuation model with closed-form Jacobian proof, MSA indemnification clause check, and PRISMA citation matrix',
    waves: [{
      n: 1,
      title: 'UI & Diagram Pilot',
      deliverables: ['ui/dashboard.tsx', 'figures/architecture.svg'],
      doneWhen: 'renders dashboard',
    }],
  });
  const skills = gates.map((g) => g.skill);
  assert.ok(skills.includes('Chrome-UI-Mockup'), 'attaches Chrome UI mockup gate for .tsx');
  assert.ok(skills.includes('Figure-Designer'), 'attaches Figure-Designer gate for .svg');
  assert.ok(skills.includes('Ramanujan'), 'attaches Ramanujan for Jacobian proof');
  assert.ok(skills.includes('Financial-Analyst'), 'attaches Financial-Analyst for equity waterfall');
  assert.ok(skills.includes('Legal-Beagle'), 'attaches Legal-Beagle for MSA indemnification');
  assert.ok(skills.includes('Literature-Review'), 'attaches Literature-Review for PRISMA citation matrix');

  // 5. Sub-wave disjoint write-set partitioning:
  const sub = partitionDisjointSubWaves(
    { deliverables: ['src/a/one.mjs', 'src/b/two.mjs'] },
    1,
  );
  assert.equal(sub.length, 2);
  assert.equal(sub[0].id, '1.1');
  assert.equal(sub[1].id, '1.2');

  const fullLint = runChekhovPlanQualityLint({
    waves: [
      { n: 1, title: 'Runnable CLI Pilot', deliverables: ['bin/cli.mjs'], doneWhen: 'CLI runs end-to-end' },
      { n: 2, title: 'Tests', deliverables: ['test/cli.test.mjs'], doneWhen: 'tests pass' },
      { n: 3, title: 'Docs', deliverables: ['README.md'], doneWhen: 'docs updated' },
    ],
    gateBlock: gateText,
  });
  assert.equal(fullLint.pass, true);
});

test('Hygiene: zero phantom claude-fable-5 strings remain in crucible/bin or crucible/test', () => {
  const roots = [
    path.resolve('C:/dev/trio/crucible/bin'),
    path.resolve('C:/dev/trio/crucible/test'),
  ];
  const hits = [];
  function scan(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) scan(full);
      else if (ent.isFile() && /\.(mjs|js|json)$/.test(ent.name)) {
        if (ent.name === 'wave4-matrix-and-quality.test.mjs') continue;
        const txt = fs.readFileSync(full, 'utf8');
        if (txt.includes('claude-fable')) hits.push(full);
      }
    }
  }
  roots.forEach(scan);
  assert.deepEqual(hits, [], `phantom claude-fable found in: ${hits.join(', ')}`);
});
