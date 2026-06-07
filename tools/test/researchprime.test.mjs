// Wave-6 tests: researchPrime is vendored as a first-class trio skill.
//
// Unlike onboard.test.mjs (which builds synthetic fixture repos), these run
// against the REAL repo root so they prove the actual vendored
// `researchPrime/SKILL.md` is present, discoverable, linkable, and carries
// valid frontmatter. The install leg still uses a temp HOME/skills dir so it
// never touches the real ~/.claude.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { REPO_ROOT, discoverSkills, install, uninstall } from '../onboard.mjs';

function mkTmpHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'trio-rp-home-'));
  return { home, skillsDir: path.join(home, '.claude', 'skills') };
}

/** True if `link` is a symlink/junction resolving into `repo`. */
function linksInto(link, repo) {
  const st = fs.lstatSync(link);
  assert.ok(st.isSymbolicLink(), `${link} should be a symlink/junction`);
  const real = fs.realpathSync(link);
  const rel = path.relative(fs.realpathSync(repo), real);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Parse the leading `---`-fenced YAML frontmatter into a flat key→value map. */
function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(m, 'SKILL.md must open with a --- frontmatter block');
  const fields = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return fields;
}

test('discoverSkills (real repo) includes researchPrime alongside crucible + foreman', () => {
  const names = discoverSkills(REPO_ROOT).map((s) => s.name);
  for (const expected of ['crucible', 'foreman', 'researchPrime']) {
    assert.ok(names.includes(expected), `discovery includes ${expected} (got ${names.join(', ')})`);
  }
});

test('install (real repo → temp HOME) links researchPrime into the repo', () => {
  const { home, skillsDir } = mkTmpHome();
  try {
    install({ repoRoot: REPO_ROOT, skillsDir });
    const link = path.join(skillsDir, 'researchPrime');
    assert.ok(linksInto(link, REPO_ROOT), 'researchPrime link resolves into the repo');
    // Traversable through the junction: the engine + SKILL.md are reachable.
    assert.ok(fs.existsSync(path.join(link, 'SKILL.md')), 'SKILL.md reachable via the link');
    assert.ok(
      fs.existsSync(path.join(link, 'bin', 'contract.mjs')),
      'engine bin/contract.mjs reachable via the link',
    );

    // Reversible: uninstall removes our researchPrime link.
    uninstall({ repoRoot: REPO_ROOT, skillsDir });
    assert.ok(!fs.existsSync(link), 'researchPrime link removed on uninstall');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('researchPrime/SKILL.md frontmatter has non-empty name + description', () => {
  const md = fs.readFileSync(path.join(REPO_ROOT, 'researchPrime', 'SKILL.md'), 'utf8');
  const fm = parseFrontmatter(md);
  assert.ok(fm.name && fm.name.length > 0, 'name is present and non-empty');
  assert.equal(fm.name, 'researchPrime', 'name is researchPrime');
  assert.ok(fm.description && fm.description.length > 0, 'description is present and non-empty');
});
