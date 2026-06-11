// Wave-5 (Front 4, deterministic) tests: dual-host `/onboard` — the three trio SKILL.md
// resolve + load under BOTH `~/.claude/skills` AND `~/.gemini/skills`, behind the
// per-host CAPABILITY CHECKLIST. These run against the REAL repo root (so they prove the
// ACTUAL vendored trio SKILL.md resolve + load), but always under a temp HOME so they
// never touch the real ~/.claude or ~/.gemini. They are STRICTLY OFFLINE: no
// CRUCIBLE_AGENT_LIVE, no `gemini -p` spawn, NO API/live call of any kind.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  REPO_ROOT,
  HOSTS,
  hostSkillsDir,
  capabilityChecklist,
  installAllHosts,
  uninstallAllHosts,
} from '../onboard.mjs';

/** The three trio skills this wave provisions onto the Gemini host. */
const TRIO = ['crucible', 'foreman', 'researchPrime'];

function mkTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'trio-dualhost-'));
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

test('the capability checklist lists BOTH hosts (Claude Code + Gemini CLI) with skills dirs under HOME', () => {
  const home = mkTmpHome();
  try {
    const list = capabilityChecklist({ home });
    assert.deepEqual(list.map((c) => c.id), ['claude', 'gemini'], 'both hosts, deterministic order');
    const byId = Object.fromEntries(list.map((c) => [c.id, c]));
    // Each host resolves a skills dir under THIS home (Gemini -> ~/.gemini/skills).
    assert.equal(byId.claude.skillsDir, path.join(home, '.claude', 'skills'));
    assert.equal(byId.gemini.skillsDir, path.join(home, '.gemini', 'skills'));
    // CLI presence is reported (presence-only), and a host is provisionable regardless of
    // whether its CLI is on PATH (skills still link; activate once installed).
    for (const c of list) {
      assert.equal(typeof c.cliFound, 'boolean', `${c.id} reports cliFound`);
      assert.equal(c.provisionable, true, `${c.id} is provisionable offline`);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('Wave-5 done-when: the three trio SKILL.md RESOLVE + LOAD under ~/.gemini/skills/ (offline, no API/live call)', () => {
  // OFFLINE BY CONSTRUCTION: this resolution test performs only filesystem operations
  // (link, lstat, read). It never imports a model driver and never calls an agent() seam,
  // so it cannot spawn a `gemini -p` child or hit any API — true regardless of whether the
  // ambient CRUCIBLE_AGENT_LIVE happens to be set.
  const home = mkTmpHome();
  const geminiSkills = hostSkillsDir(HOSTS.find((h) => h.id === 'gemini'), { home });
  try {
    // Given a FRESH ~/.gemini/skills (it does not exist yet) ...
    assert.ok(!fs.existsSync(geminiSkills), 'precondition: a fresh, absent ~/.gemini/skills');

    // ... When install runs (dual-host) ...
    installAllHosts({ repoRoot: REPO_ROOT, home });

    // ... Then all three trio SKILL.md RESOLVE + LOAD under ~/.gemini/skills.
    for (const name of TRIO) {
      const link = path.join(geminiSkills, name);
      // RESOLVE: the junction resolves into the repo (the load-bearing sibling invariant —
      // Crucible's `../../foreman/bin/...` imports keep resolving in-repo through it).
      assert.ok(linksInto(link, REPO_ROOT), `${name} resolves into the repo under ~/.gemini/skills`);
      // LOAD: SKILL.md is reachable through the junction AND parses with valid frontmatter.
      const skillMd = path.join(link, 'SKILL.md');
      assert.ok(fs.existsSync(skillMd), `${name}/SKILL.md is reachable via the gemini-host link`);
      const fm = parseFrontmatter(fs.readFileSync(skillMd, 'utf8'));
      assert.ok(fm.name && fm.name.length > 0, `${name}/SKILL.md loads a non-empty frontmatter name`);
      assert.ok(fm.description && fm.description.length > 0, `${name}/SKILL.md loads a non-empty description`);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('installAllHosts reports BOTH hosts provisioned and links the trio into each host', () => {
  const home = mkTmpHome();
  try {
    const r = installAllHosts({ repoRoot: REPO_ROOT, home });
    assert.equal(r.allProvisioned, true, 'every host provisioned (no conflicts)');
    assert.equal(r.conflicts, 0, 'no conflicts on a fresh dual-host install');
    assert.deepEqual(r.hosts.map((h) => h.id), ['claude', 'gemini'], 'both hosts in the result');
    assert.ok(r.hosts.every((h) => h.provisioned), 'each host individually provisioned');
    // Both skills dirs resolve the trio (Claude AND Gemini).
    for (const h of HOSTS) {
      const dir = hostSkillsDir(h, { home });
      for (const name of TRIO) {
        assert.ok(linksInto(path.join(dir, name), REPO_ROOT), `${name} linked into ${h.id} host`);
      }
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('dual-host install is idempotent (a second run changes nothing on either host)', () => {
  const home = mkTmpHome();
  try {
    installAllHosts({ repoRoot: REPO_ROOT, home });
    const again = installAllHosts({ repoRoot: REPO_ROOT, home });
    assert.equal(again.changed, 0, 'no changes on re-run across both hosts');
    assert.equal(again.allProvisioned, true, 'still provisioned');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('dual-host uninstall removes our links from BOTH hosts; a foreign Gemini-side entry is untouched', () => {
  const home = mkTmpHome();
  const geminiSkills = hostSkillsDir(HOSTS.find((h) => h.id === 'gemini'), { home });
  try {
    installAllHosts({ repoRoot: REPO_ROOT, home });
    // Plant an unrelated, non-trio entry in the gemini skills dir — must survive uninstall.
    const keep = path.join(geminiSkills, 'someone-elses-gemini-skill');
    fs.mkdirSync(keep, { recursive: true });
    fs.writeFileSync(path.join(keep, 'SKILL.md'), 'not ours\n');

    const r = uninstallAllHosts({ repoRoot: REPO_ROOT, home });
    assert.ok(r.removed >= TRIO.length * HOSTS.length, 'our trio links removed from every host');
    for (const h of HOSTS) {
      const dir = hostSkillsDir(h, { home });
      for (const name of TRIO) {
        assert.ok(!fs.existsSync(path.join(dir, name)), `${name} link removed from ${h.id} host`);
      }
    }
    assert.ok(fs.existsSync(path.join(keep, 'SKILL.md')), 'foreign gemini-side entry left untouched');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
