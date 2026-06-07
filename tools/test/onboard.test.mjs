// Tests for the Wave-3 cross-OS `/onboard` installer (tools/onboard.mjs).
//
// Every test runs against a fully synthetic repo + a temp HOME/skills dir so it
// is hermetic (never touches the real ~/.claude) and deterministic regardless of
// how many skills the real repo currently ships. A fixture "repo" is just a
// directory with one subdir per skill, each holding a SKILL.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  discoverSkills,
  detectPrereqs,
  computePlan,
  install,
  uninstall,
} from '../onboard.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ONBOARD = path.join(HERE, '..', 'onboard.mjs');

function mkTmp(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `trio-onboard-${tag}-`));
}

/** Build a fixture repo with the given skill names (each gets a SKILL.md). */
function mkRepo(names) {
  const repo = mkTmp('repo');
  for (const name of names) {
    const dir = path.join(repo, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\n---\n# ${name}\n`);
  }
  // A non-skill dir (no SKILL.md) and a dotdir must be ignored by discovery.
  fs.mkdirSync(path.join(repo, 'tools'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'tools', 'x.mjs'), '// not a skill\n');
  fs.mkdirSync(path.join(repo, '.hidden'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.hidden', 'SKILL.md'), 'should be ignored\n');
  return repo;
}

/** True if `link` is a symlink/junction resolving into `repo`. */
function linksInto(link, repo) {
  const st = fs.lstatSync(link);
  assert.ok(st.isSymbolicLink(), `${link} should be a symlink/junction`);
  const real = fs.realpathSync(link);
  const rel = path.relative(fs.realpathSync(repo), real);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function withDirs(fn) {
  const repo = mkRepo(['crucible', 'foreman']);
  const skillsDir = path.join(mkTmp('home'), '.claude', 'skills');
  try {
    fn({ repo, skillsDir });
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(path.resolve(skillsDir, '..', '..'), { recursive: true, force: true });
  }
}

test('discoverSkills finds only top-level dirs with a SKILL.md (sorted, no dotdirs)', () => {
  const repo = mkRepo(['foreman', 'crucible']);
  try {
    const skills = discoverSkills(repo);
    assert.deepEqual(
      skills.map((s) => s.name),
      ['crucible', 'foreman'],
      'sorted; tools/ and .hidden/ excluded',
    );
    assert.ok(skills.every((s) => path.isAbsolute(s.target)), 'targets are absolute');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('detectPrereqs reports node as present (it is running this test)', () => {
  const r = detectPrereqs(['node']);
  assert.equal(r.node.found, true, 'node is on PATH');
  assert.ok(r.node.path, 'reports a path for node');
});

test('fresh install creates a working link per skill that resolves into the repo', () => {
  withDirs(({ repo, skillsDir }) => {
    const r = install({ repoRoot: repo, skillsDir });
    assert.equal(r.changed, 2, 'two links created');
    assert.equal(r.conflicts, 0);
    for (const name of ['crucible', 'foreman']) {
      const link = path.join(skillsDir, name);
      assert.ok(linksInto(link, repo), `${name} link resolves into the repo`);
      // The junction is traversable: the skill's SKILL.md is reachable through it.
      assert.ok(fs.existsSync(path.join(link, 'SKILL.md')), `${name}/SKILL.md reachable via link`);
    }
  });
});

test('second install is a no-op (idempotent)', () => {
  withDirs(({ repo, skillsDir }) => {
    install({ repoRoot: repo, skillsDir });
    const again = install({ repoRoot: repo, skillsDir });
    assert.equal(again.changed, 0, 'no changes on re-run');
    assert.equal(again.conflicts, 0);
    assert.ok(
      again.actions.every((a) => a.kind === 'skip'),
      'every action is a skip',
    );
  });
});

test('a foreign real dir is NOT clobbered without --force (and IS with --force)', () => {
  withDirs(({ repo, skillsDir }) => {
    // Plant a foreign, unrelated real directory where `crucible` would link.
    const foreign = path.join(skillsDir, 'crucible');
    fs.mkdirSync(foreign, { recursive: true });
    fs.writeFileSync(path.join(foreign, 'KEEP.txt'), 'user content\n');

    const r1 = install({ repoRoot: repo, skillsDir });
    assert.equal(r1.conflicts, 1, 'crucible is a conflict');
    assert.ok(
      r1.actions.find((a) => a.name === 'crucible').kind === 'conflict',
      'crucible action is conflict',
    );
    // Untouched: still a real dir with the user's file intact.
    assert.ok(!fs.lstatSync(foreign).isSymbolicLink(), 'foreign dir still a real dir');
    assert.ok(fs.existsSync(path.join(foreign, 'KEEP.txt')), 'user content preserved');
    // foreman (no conflict) still got linked.
    assert.ok(linksInto(path.join(skillsDir, 'foreman'), repo), 'foreman linked despite crucible conflict');

    // With --force the foreign dir is replaced by our link.
    const r2 = install({ repoRoot: repo, skillsDir, force: true });
    assert.equal(r2.conflicts, 0, 'no conflicts under --force');
    assert.ok(linksInto(path.join(skillsDir, 'crucible'), repo), 'crucible now linked into repo');
  });
});

test('dry-run reports changes but writes nothing', () => {
  withDirs(({ repo, skillsDir }) => {
    const r = install({ repoRoot: repo, skillsDir, dryRun: true });
    assert.equal(r.changed, 2, 'reports two would-be changes');
    assert.ok(!fs.existsSync(path.join(skillsDir, 'crucible')), 'no link actually created');
  });
});

test('--uninstall removes only our links; foreign + unrelated entries remain', () => {
  withDirs(({ repo, skillsDir }) => {
    install({ repoRoot: repo, skillsDir }); // links crucible + foreman
    // An unrelated entry that is not a skill we manage.
    const keep = path.join(skillsDir, 'someone-elses-skill');
    fs.mkdirSync(keep, { recursive: true });
    fs.writeFileSync(path.join(keep, 'SKILL.md'), 'not ours\n');

    const r = uninstall({ repoRoot: repo, skillsDir });
    assert.equal(r.removed, 2, 'both of our links removed');
    assert.ok(!fs.existsSync(path.join(skillsDir, 'crucible')), 'crucible link gone');
    assert.ok(!fs.existsSync(path.join(skillsDir, 'foreman')), 'foreman link gone');
    assert.ok(fs.existsSync(keep), 'unrelated entry untouched');
  });
});

test('--uninstall leaves a foreign dir that shares a skill name untouched', () => {
  withDirs(({ repo, skillsDir }) => {
    // A real (foreign) dir named exactly like one of our skills.
    const foreign = path.join(skillsDir, 'foreman');
    fs.mkdirSync(foreign, { recursive: true });
    fs.writeFileSync(path.join(foreign, 'KEEP.txt'), 'foreign\n');
    // crucible is ours.
    install({ repoRoot: repo, skillsDir }); // crucible links; foreman is a conflict (skipped)

    const r = uninstall({ repoRoot: repo, skillsDir });
    assert.equal(r.removed, 1, 'only crucible (ours) removed');
    assert.equal(r.kept, 1, 'foreman foreign dir kept');
    assert.ok(fs.existsSync(path.join(foreign, 'KEEP.txt')), 'foreign foreman content intact');
  });
});

test('computePlan classifies create / skip / conflict correctly', () => {
  withDirs(({ repo, skillsDir }) => {
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.mkdirSync(path.join(skillsDir, 'crucible')); // foreign real dir
    install({ repoRoot: repo, skillsDir, force: false }); // links foreman only
    const plan = computePlan({ repoRoot: repo, skillsDir });
    const byName = Object.fromEntries(plan.map((a) => [a.name, a.kind]));
    assert.equal(byName.foreman, 'skip', 'foreman already linked');
    assert.equal(byName.crucible, 'conflict', 'crucible foreign dir is a conflict');
  });
});

test('CLI: install then uninstall via --home, with prereq + done reporting', () => {
  const repo = mkRepo(['crucible', 'foreman']);
  const home = mkTmp('cli-home');
  const skillsDir = path.join(home, '.claude', 'skills');
  try {
    // The CLI computes REPO_ROOT from its own location, so drive a fixture repo
    // by copying onboard.mjs into the fixture's tools/ and running that copy.
    fs.mkdirSync(path.join(repo, 'tools'), { recursive: true });
    fs.copyFileSync(ONBOARD, path.join(repo, 'tools', 'onboard.mjs'));
    const cli = path.join(repo, 'tools', 'onboard.mjs');

    const inst = spawnSync(process.execPath, [cli, '--home', home], { encoding: 'utf8' });
    assert.equal(inst.status, 0, `install exits 0\n${inst.stdout}\n${inst.stderr}`);
    assert.match(inst.stdout, /linking 2 skill/, 'reports linking 2 skills');
    assert.ok(linksInto(path.join(skillsDir, 'crucible'), repo), 'crucible linked via CLI');

    const un = spawnSync(process.execPath, [cli, '--uninstall', '--home', home], { encoding: 'utf8' });
    assert.equal(un.status, 0, 'uninstall exits 0');
    assert.match(un.stdout, /2 removed/, 'reports 2 removed');
    assert.ok(!fs.existsSync(path.join(skillsDir, 'crucible')), 'crucible link removed via CLI');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('CLI: --force is required to overwrite a foreign dir (exit 1 without it)', () => {
  const repo = mkRepo(['crucible', 'foreman']);
  const home = mkTmp('cli-force');
  const skillsDir = path.join(home, '.claude', 'skills');
  try {
    fs.copyFileSync(ONBOARD, path.join(repo, 'tools', 'onboard.mjs'));
    const cli = path.join(repo, 'tools', 'onboard.mjs');
    fs.mkdirSync(path.join(skillsDir, 'crucible'), { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'crucible', 'KEEP.txt'), 'user\n');

    const r1 = spawnSync(process.execPath, [cli, '--home', home], { encoding: 'utf8' });
    assert.equal(r1.status, 1, 'non-zero exit when a conflict is refused');
    assert.match(r1.stdout, /refusing to overwrite/, 'warns about the refusal');
    assert.ok(fs.existsSync(path.join(skillsDir, 'crucible', 'KEEP.txt')), 'foreign content intact');

    const r2 = spawnSync(process.execPath, [cli, '--home', home, '--force'], { encoding: 'utf8' });
    assert.equal(r2.status, 0, 'exit 0 under --force');
    assert.ok(linksInto(path.join(skillsDir, 'crucible'), repo), 'crucible now linked');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});
