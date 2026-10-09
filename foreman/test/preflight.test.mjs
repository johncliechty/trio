// S2 of the slim plan (2026-10-10): the dirty-sibling check guards the repos a plan really names, and a missing
// listed input stops the run before it starts. Pure: the filesystem and git are injected.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { planPathTokens, inputsSection, inputPaths, siblingPlan } from '../bin/preflight.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// A tiny world: C:\dev is a repo (the container); C:\dev\Anchor is a repo; the job runs in a worktree of Anchor;
// C:\dev\Other is a real sibling; AppData\Local is (oddly) a repo too.
const REPOS = {
  'c:\\dev': { common: 'c:\\dev\\.git' },
  'c:\\dev\\anchor': { common: 'c:\\dev\\anchor\\.git' },
  'c:\\dev\\anchor-code-jobs\\wt\\job1': { common: 'c:\\dev\\anchor\\.git' },
  'c:\\dev\\other': { common: 'c:\\dev\\other\\.git' },
  'c:\\users\\me\\appdata\\local': { common: 'c:\\users\\me\\appdata\\local\\.git' },
};
const FILES = new Set([
  'c:\\dev\\notes.md', 'c:\\dev\\anchor\\x.py', 'c:\\dev\\other\\y.py', 'c:\\users\\me\\appdata\\local\\tool\\cfg.json',
  'c:\\dev\\anchor-code-jobs\\wt\\job1\\src\\a.py', 'c:\\dev\\inputs\\data.csv',
]);
const lc = (p) => path.resolve(p).toLowerCase();
const world = {
  exists: (p) => (FILES.has(lc(p)) ? 'file' : (REPOS[lc(p)] ? 'dir' : null)),
  gitRootOf: (d) => { let cur = lc(d); while (cur) { if (REPOS[cur]) return cur; const up = path.dirname(cur); if (up === cur) return null; cur = up; } return null; },
  commonDirOf: (r) => REPOS[lc(r)]?.common ?? null,
};

test('quoted paths with spaces and bare paths are both found, once each', () => {
  const t = 'Read "C:\\dev\\Skill Foundry\\a b.md" and C:\\dev\\other\\y.py, then C:\\dev\\other\\y.py again.';
  assert.deepEqual(planPathTokens(t), ['C:\\dev\\Skill Foundry\\a b.md', 'C:\\dev\\other\\y.py']);
});

test('review r1: quoted contents are kept exactly; a bare path is never swallowed by a longer quoted one', () => {
  const t = 'In "C:\\data\\results (final)" and `C:\\data\\O\'Brien.csv`; also "C:/repos/barcelona/input.md" and C:/repos/bar.';
  assert.deepEqual(planPathTokens(t), ['C:\\data\\results (final)', "C:\\data\\O'Brien.csv", 'C:/repos/barcelona/input.md', 'C:/repos/bar']);
  assert.deepEqual(planPathTokens('see \\\\server\\share\\in.csv now'), ['\\\\server\\share\\in.csv']);
});

test('review r1: inputs inside the project, relative and UNC inputs are checked too; prose is not an input', () => {
  const proj = 'C:\\work\\app';
  const section = '- "C:\\work\\app\\data.csv"\n- `data/rel.csv`\n- \\\\nas\\share\\x.csv\n- see v1.2 notes\n- e.g. anything\n';
  assert.deepEqual(inputPaths(section, proj).map((p) => p.toLowerCase()).sort(),
    ['c:\\work\\app\\data.csv', 'c:\\work\\app\\data\\rel.csv', '\\\\nas\\share\\x.csv'].sort());
  const r = siblingPlan({ planText: '## Inputs\n- "C:\\work\\app\\data.csv"\n', projReal: proj, exists: () => null, gitRootOf: () => null });
  assert.deepEqual(r.missingInputs, ['C:\\work\\app\\data.csv']);
});

test('review r2: a relative quoted input keeps an apostrophe inside it', () => {
  assert.deepEqual(inputPaths("- `data/O'Brien.csv`\n", 'C:\\work\\app').map((p) => p.toLowerCase()),
    ["c:\\work\\app\\data\\o'brien.csv"]);
});

test('only the Inputs section is an input contract', () => {
  const t = '# Plan\nWrite C:\\dev\\out\\new.pdf\n## Inputs\n- "C:\\dev\\inputs\\data.csv"\n- C:\\dev\\inputs\\gone.csv\n## Waves\nC:\\dev\\x.md\n';
  assert.deepEqual(planPathTokens(inputsSection(t)), ['C:\\dev\\inputs\\data.csv', 'C:\\dev\\inputs\\gone.csv']);
  assert.equal(inputsSection('# Plan\nno inputs here\n'), '');
});

test('containers, the project\'s own repository and its ancestors are never dirty siblings; a real sibling is', () => {
  const planText = [
    'C:\\dev\\notes.md',                                   // resolves to the C:\dev container
    'C:\\dev\\anchor\\x.py',                               // the project's own repository (another worktree)
    'C:\\dev\\other\\y.py',                                // a real sibling
    'C:\\Users\\me\\AppData\\Local\\tool\\cfg.json',       // a container of the user's files
  ].join('\n');
  const r = siblingPlan({ planText, projReal: 'C:\\dev\\Anchor-code-jobs\\wt\\job1', home: 'C:\\Users\\me', ...world });
  assert.deepEqual(r.checked.map(lc), ['c:\\dev\\other']);
  const why = Object.fromEntries(r.excluded.map((x) => [lc(x.repo), x.why]));
  assert.equal(why['c:\\dev'], 'contains the project');
  assert.equal(why['c:\\dev\\anchor'], "the project's own repository (another worktree)");
  assert.equal(why['c:\\users\\me\\appdata\\local'], "a container of the user's files");
});

test('a missing listed input is reported; a missing path elsewhere (an output to make) is only unresolved', () => {
  const planText = '## Inputs\n- C:\\dev\\inputs\\data.csv\n- C:\\dev\\inputs\\gone.csv\n## Waves\nproduce C:\\dev\\out\\new.pdf\n';
  const r = siblingPlan({ planText, projReal: 'C:\\dev\\Anchor-code-jobs\\wt\\job1', home: 'C:\\Users\\me', ...world });
  assert.deepEqual(r.missingInputs, ['C:\\dev\\inputs\\gone.csv']);
  assert.ok(r.unresolved.includes('C:\\dev\\out\\new.pdf'));
});

test('live: a missing listed input HALTs before start with its own taxonomy and record', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'foreman-s2-'));
  const proj = path.join(tmp, 'proj');
  fs.cpSync(path.join(here, '..', 'fixtures', 'canonical-project'), proj, { recursive: true });
  fs.appendFileSync(path.join(proj, 'IMPLEMENTATION-PLAN.md'), `\n## Inputs\n- "${path.join(tmp, 'not-there', 'data.csv')}"\n`);
  const r = spawnSync(process.execPath, [path.join(here, '..', 'bin', 'run-live.mjs'), proj], {
    encoding: 'utf8', timeout: 120000, env: { ...process.env, FOREMAN_RUNS_DIR: path.join(tmp, 'runs') },
  });
  assert.equal(r.status, 3, r.stdout + r.stderr);
  const rec = JSON.parse(fs.readFileSync(path.join(proj, '.foreman', 'run-record.json'), 'utf8'));
  assert.equal(rec.taxonomy, 'input-unreachable');
  assert.match(rec.halt_reason, /not-there/);
});
