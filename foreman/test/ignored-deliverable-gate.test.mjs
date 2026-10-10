import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseWaves } from '../bin/foreman-lib.mjs';
import { runWave } from '../bin/wave-engine.mjs';
import { makeScriptedDriver } from '../bin/drivers/scripted-driver.mjs';

function write(dir, relative, text) {
  const target = path.join(dir, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
  return target;
}

function fixture(t, output = 'docs/GUIDE.md') {
  const tempRoot = path.resolve(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(tempRoot, 'foreman-deliverable-grok-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(dir)), tempRoot);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const planPath = write(dir, 'IMPLEMENTATION-PLAN.md',
    `# Plan\n\n## Wave 1 — Guide\nkind: docs\noutputs: \`${output}\`\nDone when:\n- The requested guide is available.\n`);
  const wave = parseWaves(fs.readFileSync(planPath, 'utf8'))[0];
  return { dir, options: { projectDir: dir, testCommand: null, wave, totalWaves: 1,
    planPath, reviewerCount: 1, fixIterCap: 1 } };
}

for (const executable of ['docs/app.mjs', 'docs/build.ps1', 'docs/package.json',
  'bundle/app.mjs', 'bundle_staging/app.mjs']) {
  for (const declared of [false, true]) {
    test(`${declared ? 'declared' : 'undeclared'} executable ${executable} requires a code gate`, async t => {
      const output = declared ? executable : `${path.posix.dirname(executable)}/GUIDE.md`;
      const { dir, options } = fixture(t, output);
      const driver = makeScriptedDriver({
        onExecute: async () => {
          write(dir, output, '# Requested guide\n');
          write(dir, executable, executable.endsWith('.json') ? '{"scripts":{"build":"node app.mjs"}}\n' : 'executable content\n');
        },
        reviewerFindings: [],
      });
      const result = await runWave({ ...options, driver });
      assert.equal(result.status, 'HALT');
      assert.match(result.haltReason, /\[taxonomy:missing-test-command\]/);
    });
  }
}

test('an unchanged declared executable still cannot use the outputs-only gate', async t => {
  const { dir, options } = fixture(t, 'docs/app.mjs');
  write(dir, 'docs/app.mjs', 'export const existing = true;\n');
  const driver = makeScriptedDriver({
    onExecute: async () => { write(dir, 'docs/GUIDE.md', '# Guide\n'); },
    reviewerFindings: [],
  });
  const result = await runWave({ ...options, driver });
  assert.equal(result.status, 'HALT');
  assert.match(result.haltReason, /\[taxonomy:missing-test-command\]/);
});

for (const directory of ['docs', 'deliverables']) {
  test(`Git omitting ignored ${directory} does not conceal an executable sibling`, async t => {
    const { dir, options } = fixture(t, `${directory}/GUIDE.md`);
    write(dir, '.gitignore', `${directory}/\n`);
    const driver = makeScriptedDriver({
      onExecute: async () => {
        write(dir, `${directory}/GUIDE.md`, '# Guide\n');
        write(dir, `${directory}/app.mjs`, 'export const changed = true;\n');
      },
      reviewerFindings: [],
    });
    const result = await runWave({ ...options, driver, git: { changedVsHead: () => [] } });
    assert.equal(result.status, 'HALT');
    assert.match(result.haltReason, /\[taxonomy:missing-test-command\]/);
  });
}

test('changed executable beside a guide runs the code gate and reaches the reviewer', async t => {
  const { dir, options } = fixture(t);
  write(dir, 'test/calc.test.mjs',
    "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../docs/calc.mjs';\ntest('adds', () => assert.equal(add(2, 3), 5));\n");
  const reviewed = [];
  const driver = makeScriptedDriver({
    onExecute: async () => {
      write(dir, 'docs/GUIDE.md', '# Addition guide\n');
      write(dir, 'docs/calc.mjs', 'export const add = (a, b) => a - b;\n');
    },
    reviewerFindings: [],
  });
  driver.review = async ctx => {
    reviewed.push([...ctx.changed]);
    return { reviewer: `reviewer-${ctx.reviewerIndex}`, answerable: 'yes', claim: 'gate is red', findings: [] };
  };
  const result = await runWave({ ...options, testCommand: 'node --test test/*.test.mjs', fixIterCap: 0, driver });
  assert.equal(result.status, 'HALT');
  assert.ok(reviewed.some(changed => changed.includes('docs/calc.mjs')));
});

test('delivery scanning retains the node_modules exclusion', async t => {
  const { dir, options } = fixture(t);
  const reviewed = [];
  const driver = makeScriptedDriver({
    onExecute: async () => {
      write(dir, 'docs/GUIDE.md', '# Guide\n');
      write(dir, 'docs/node_modules/dependency/app.mjs', 'export const dependency = true;\n');
    },
    reviewerFindings: [],
  });
  const originalReview = driver.review;
  driver.review = async ctx => {
    reviewed.push([...ctx.changed]);
    return originalReview(ctx);
  };
  const result = await runWave({ ...options, driver });
  assert.equal(result.status, 'GO');
  assert.ok(reviewed.length > 0);
  assert.ok(reviewed.every(changed => !changed.some(file => file.includes('node_modules'))));
});
