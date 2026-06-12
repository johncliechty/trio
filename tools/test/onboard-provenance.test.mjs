// Wave-5 (Phase D) tests: provenance onboard — the `.agent-sync/state.json` lock,
// `restore` (rebuild from the lock), the per-file-SHA256 no-clobber gate (adopt vs
// preserve), and provenance uninstall (orphaned `ours` links only).
//
// Every test is hermetic: a fully synthetic fixture repo + a temp HOME, so it never
// touches the real ~/.claude / ~/.gemini and is deterministic regardless of what the
// real repo ships. STRICTLY OFFLINE — only filesystem + a best-effort `git rev-parse`
// (which is allowed to return null); no API/live call of any kind.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  HOSTS,
  hostSkillsDir,
  buildLock,
  fileShas,
  writeLock,
  readLock,
  lockPath,
  classifyProvenance,
  computeProvenancePlan,
  installProvenance,
  restore,
  provenanceUninstall,
} from '../onboard.mjs';

const TRIO = ['crucible', 'foreman', 'researchPrime'];
const SKILL_BYTES = (name) => `---\nname: ${name}\n---\n# ${name}\n`;

function mkTmp(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `trio-prov-${tag}-`));
}

/** Build a fixture repo: one dir per skill, each with a SKILL.md (+ a nested file). */
function mkRepo(names = TRIO) {
  const repo = mkTmp('repo');
  for (const name of names) {
    const dir = path.join(repo, name);
    fs.mkdirSync(path.join(dir, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), SKILL_BYTES(name));
    fs.writeFileSync(path.join(dir, 'bin', 'run.mjs'), `// ${name} entry\n`);
  }
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

/** Copy a directory tree (used to plant a verbatim / modified foreign copy). */
function copyTree(src, dst, mutate = null) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyTree(s, d, mutate);
    else {
      let buf = fs.readFileSync(s);
      if (mutate) buf = mutate(e.name, buf);
      fs.writeFileSync(d, buf);
    }
  }
}

// --- lock shape + round-trip -----------------------------------------------

test('buildLock records source_commit + installed_by + per-skill per-file SHA256', () => {
  const repo = mkRepo();
  try {
    const lock = buildLock({ repoRoot: repo, installedBy: 'tester@host (trio-onboard)' });
    assert.equal(typeof lock.version, 'number', 'has a version');
    assert.ok('source_commit' in lock, 'has a source_commit key (null is allowed off-git)');
    assert.equal(lock.installed_by, 'tester@host (trio-onboard)', 'records installed_by');
    assert.deepEqual(Object.keys(lock.skills).sort(), [...TRIO].sort(), 'one entry per skill');
    for (const name of TRIO) {
      const files = lock.skills[name].files;
      // per-FILE map, POSIX rel paths, 64-hex SHA256 each, including the nested file.
      assert.deepEqual(Object.keys(files).sort(), ['SKILL.md', 'bin/run.mjs']);
      for (const sha of Object.values(files)) assert.match(sha, /^[0-9a-f]{64}$/, '64-hex sha256');
    }
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('fileShas is deterministic and content-sensitive', () => {
  const repo = mkRepo(['crucible']);
  try {
    const a = fileShas(path.join(repo, 'crucible'));
    const b = fileShas(path.join(repo, 'crucible'));
    assert.deepEqual(a, b, 'same bytes -> same hashes');
    fs.writeFileSync(path.join(repo, 'crucible', 'SKILL.md'), SKILL_BYTES('crucible') + 'edit\n');
    const c = fileShas(path.join(repo, 'crucible'));
    assert.notEqual(c['SKILL.md'], a['SKILL.md'], 'changed bytes -> changed hash');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('writeLock/readLock round-trips through ~/.agent-sync/state.json', () => {
  const repo = mkRepo();
  const home = mkTmp('home');
  try {
    const lock = buildLock({ repoRoot: repo });
    const p = writeLock({ home, lock });
    assert.equal(p, lockPath(home), 'writes to ~/.agent-sync/state.json');
    assert.ok(fs.existsSync(p), 'the lock file exists on disk');
    assert.deepEqual(readLock({ home }), lock, 'read-back equals what was written');
    assert.equal(readLock({ home: mkTmp('empty') }), null, 'absent lock reads back null');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- done-when #1: restore reproduces the install on a clean HOME ----------

test('restore rebuilds all three skills reproducibly from the lock on a clean fixture HOME', () => {
  const repo = mkRepo();
  const home = mkTmp('home');
  try {
    // Write the lock, then restore onto a CLEAN home (no skills linked yet).
    writeLock({ home, lock: buildLock({ repoRoot: repo }) });
    for (const h of HOSTS) {
      assert.ok(!fs.existsSync(hostSkillsDir(h, { home })), `precondition: ${h.id} skills dir absent`);
    }

    const r = restore({ repoRoot: repo, home });
    assert.equal(r.ok, true, 'restore reports ok');
    assert.equal(r.allRestored, true, 'every host restored without conflict');

    // All three skills link reproducibly under EVERY host's skills dir.
    for (const h of HOSTS) {
      const dir = hostSkillsDir(h, { home });
      for (const name of TRIO) {
        const link = path.join(dir, name);
        assert.ok(linksInto(link, repo), `${name} restored into ${h.id} host`);
        assert.ok(fs.existsSync(path.join(link, 'SKILL.md')), `${name}/SKILL.md reachable via restored link`);
      }
    }
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('restore with no lock present is a reported no-op', () => {
  const repo = mkRepo();
  const home = mkTmp('home');
  try {
    const r = restore({ repoRoot: repo, home });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'no-lock');
    assert.equal(r.changed, 0, 'nothing linked without a lock');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- done-when #2: SHA-modified target preserved (not clobbered) -----------

test('a SHA-modified foreign target is PRESERVED + reported, not clobbered', () => {
  const repo = mkRepo();
  const skillsDir = path.join(mkTmp('home'), '.claude', 'skills');
  try {
    const lock = buildLock({ repoRoot: repo });
    fs.mkdirSync(skillsDir, { recursive: true });
    // Plant a foreign real dir at `crucible` that is a MODIFIED copy (SHA differs).
    const foreign = path.join(skillsDir, 'crucible');
    copyTree(path.join(repo, 'crucible'), foreign, (name, buf) =>
      name === 'SKILL.md' ? Buffer.from(buf.toString() + '\n# user edits\n') : buf,
    );

    const r = installProvenance({ repoRoot: repo, skillsDir, lock });
    const byName = Object.fromEntries(r.actions.map((a) => [a.name, a.kind]));
    assert.equal(byName.crucible, 'preserve', 'modified target classified preserve');
    assert.equal(r.preserved, 1, 'exactly one preserved');

    // BYTE-FOR-BYTE untouched: still a real dir, still the user-modified content.
    assert.ok(!fs.lstatSync(foreign).isSymbolicLink(), 'foreign dir still a real dir (not clobbered)');
    assert.match(fs.readFileSync(path.join(foreign, 'SKILL.md'), 'utf8'), /# user edits/, 'user edit intact');
    // The other (non-conflicting) skills still linked normally.
    for (const name of ['foreman', 'researchPrime']) {
      assert.ok(linksInto(path.join(skillsDir, name), repo), `${name} linked despite crucible preserve`);
    }
  } finally {
    fs.rmSync(path.resolve(skillsDir, '..', '..'), { recursive: true, force: true });
  }
});

test('a VERBATIM foreign copy (SHA matches the lock) is ADOPTED into a link — no data lost', () => {
  const repo = mkRepo();
  const skillsDir = path.join(mkTmp('home'), '.claude', 'skills');
  try {
    const lock = buildLock({ repoRoot: repo });
    fs.mkdirSync(skillsDir, { recursive: true });
    // Plant a foreign real dir that is a BYTE-IDENTICAL copy of the source skill.
    copyTree(path.join(repo, 'foreman'), path.join(skillsDir, 'foreman'));

    // classifyProvenance spells out the adopt decision against inspectLink + the lock.
    const c = classifyProvenance({
      link: path.join(skillsDir, 'foreman'),
      target: path.join(repo, 'foreman'),
      repoRoot: repo,
      lockFiles: lock.skills.foreman.files,
    });
    assert.equal(c.kind, 'adopt', 'verbatim copy classified adopt');

    const r = installProvenance({ repoRoot: repo, skillsDir, lock });
    assert.equal(r.adopted, 1, 'one adopt executed');
    assert.equal(r.preserved, 0, 'nothing preserved (no divergent content)');
    assert.ok(linksInto(path.join(skillsDir, 'foreman'), repo), 'adopted entry is now a link into the repo');
  } finally {
    fs.rmSync(path.resolve(skillsDir, '..', '..'), { recursive: true, force: true });
  }
});

// --- done-when #3: provenance uninstall removes ONLY orphaned ours links ----

test('provenanceUninstall removes only orphaned `ours` links (live + foreign untouched)', () => {
  const repo = mkRepo();
  const skillsDir = path.join(mkTmp('home'), '.claude', 'skills');
  try {
    const lock = buildLock({ repoRoot: repo }); // records all three as provenance-owned
    installProvenance({ repoRoot: repo, skillsDir, lock }); // links all three (ours)
    // Plant a FOREIGN entry sharing no skill name — must survive.
    const keep = path.join(skillsDir, 'someone-elses-skill');
    fs.mkdirSync(keep, { recursive: true });
    fs.writeFileSync(path.join(keep, 'SKILL.md'), 'not ours\n');

    // Upstream removes `researchPrime` from the repo -> its link is now ORPHANED
    // (recorded in the lock, but no longer a discoverable skill).
    fs.rmSync(path.join(repo, 'researchPrime'), { recursive: true, force: true });

    const r = provenanceUninstall({ repoRoot: repo, skillsDir, lock });
    assert.deepEqual(r.orphans, ['researchPrime'], 'only the stale skill is an orphan');
    assert.equal(r.removed, 1, 'exactly one orphaned link removed');
    assert.equal(r.kept, 2, 'the two live provenance links kept');

    assert.ok(!fs.existsSync(path.join(skillsDir, 'researchPrime')), 'orphaned link gone');
    assert.ok(linksInto(path.join(skillsDir, 'crucible'), repo), 'live crucible link kept');
    assert.ok(linksInto(path.join(skillsDir, 'foreman'), repo), 'live foreman link kept');
    assert.ok(fs.existsSync(path.join(keep, 'SKILL.md')), 'foreign entry left untouched');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(path.resolve(skillsDir, '..', '..'), { recursive: true, force: true });
  }
});

test('computeProvenancePlan honors `only` (restore acts on exactly the lock-recorded skills)', () => {
  const repo = mkRepo();
  const skillsDir = path.join(mkTmp('home'), '.claude', 'skills');
  try {
    const lock = buildLock({ repoRoot: repo });
    const plan = computeProvenancePlan({
      repoRoot: repo,
      skillsDir,
      lock,
      only: new Set(['crucible']),
    });
    assert.deepEqual(plan.map((a) => a.name), ['crucible'], 'only the requested skill is planned');
    assert.equal(plan[0].kind, 'create', 'fresh create on a clean skills dir');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(path.resolve(skillsDir, '..', '..'), { recursive: true, force: true });
  }
});
