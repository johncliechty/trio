#!/usr/bin/env node
// trio — cross-OS `/onboard` installer (Wave 3).
//
// Installs the repo's skills into Claude Code by linking each skill directory
// into `~/.claude/skills/<name>`. One `fs.symlinkSync(target, link, 'junction')`
// call works on every OS: a real *directory junction* on Windows (no admin
// required) and an ordinary symlink on macOS/Linux. Node resolves the link to
// the real on-disk path, so Crucible's `../../foreman/bin/...` imports keep
// resolving in-repo through the junction (the load-bearing sibling invariant).
//
// Design guarantees (the project's non-regression promise):
//   * idempotent      — a link already pointing at this repo is left as-is.
//   * non-destructive — a foreign dir/link at `<name>` is never clobbered; we
//                       warn and refuse unless `--force` is given.
//   * reversible      — `--uninstall` removes ONLY links that point into this
//                       repo; unrelated entries are untouched.
//   * cross-OS        — pure Node, no per-OS shell scripts.
//
// Skills are auto-discovered: every top-level directory containing a `SKILL.md`
// is a skill. (That is why Wave 6 can add researchPrime by just copying its
// SKILL.md in — the installer picks it up with no code change.)
//
// Wave 5 (Front 4, deterministic) extends this into a DUAL-HOST installer: the same
// junction-link mechanism now provisions BOTH hosts — Claude Code (`~/.claude/skills`)
// AND Gemini CLI (`~/.gemini/skills`) — behind a per-host CAPABILITY CHECKLIST. A
// host's skills link regardless of whether its CLI is on PATH (matching the existing
// non-fatal prereq posture: "skills still link; activate once the CLI is on PATH"), so
// "provisioned" means the three trio skills RESOLVE under that host's skills dir, proved
// offline with NO API/live call.
//
// Usage:
//   node tools/onboard.mjs                 # install into EVERY host (Claude Code + Gemini CLI)
//   node tools/onboard.mjs --dry-run       # show what would happen, change nothing
//   node tools/onboard.mjs --force         # overwrite a foreign dir/link at <name>
//   node tools/onboard.mjs --uninstall     # remove only links that point here (every host)
//   node tools/onboard.mjs --host ID       # restrict to one host (claude | gemini)
//   node tools/onboard.mjs --home DIR      # treat DIR as HOME (testing/override)
//   node tools/onboard.mjs --skills-dir D  # link into D only (single-dir, host-agnostic)

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** The repo root is the parent of this `tools/` directory. */
export const REPO_ROOT = path.resolve(HERE, '..');

/** The prerequisites we report on (presence only — none are fatal). */
export const PREREQS = ['node', 'claude', 'git'];

/**
 * The hosts `/onboard` provisions (Wave 5, Front 4). Each host links the same trio
 * SKILL.md into its own skills dir under HOME. `cli` is the host's launcher (reported by
 * the capability checklist — presence only, never fatal). Order is deterministic.
 */
export const HOSTS = [
  { id: 'claude', label: 'Claude Code', cli: 'claude', skillsSubdir: ['.claude', 'skills'] },
  { id: 'gemini', label: 'Gemini CLI', cli: 'gemini', skillsSubdir: ['.gemini', 'skills'] },
];

// --- path helpers (Windows-aware: case-insensitive, strips \\?\ prefix) ----

/** Normalize an absolute path for comparison (lowercased on Windows). */
function normPath(p) {
  let s = String(p);
  if (process.platform === 'win32') s = s.replace(/^\\\\\?\\/, ''); // \\?\C:\… → C:\…
  s = path.resolve(s);
  if (s.length > 1 && s.endsWith(path.sep)) s = s.slice(0, -1);
  return process.platform === 'win32' ? s.toLowerCase() : s;
}

function samePath(a, b) {
  return normPath(a) === normPath(b);
}

/** True if `target` resolves to `repoRoot` itself or anything under it. */
function isInsideRepo(target, repoRoot) {
  const t = normPath(target);
  const r = normPath(repoRoot);
  return t === r || t.startsWith(r + path.sep);
}

/** The symlink type Node should create (a real junction on Windows). */
function linkType() {
  return process.platform === 'win32' ? 'junction' : 'dir';
}

// --- skill discovery -------------------------------------------------------

/**
 * Discover skills: every top-level directory under `repoRoot` that contains a
 * `SKILL.md`. Returns `[{ name, target }]` sorted by name (deterministic).
 */
export function discoverSkills(repoRoot = REPO_ROOT) {
  let entries;
  try {
    entries = fs.readdirSync(repoRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const skills = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue;
    const target = path.join(repoRoot, e.name);
    if (fs.existsSync(path.join(target, 'SKILL.md'))) {
      skills.push({ name: e.name, target });
    }
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

// --- prerequisite detection ------------------------------------------------

/**
 * Detect whether each prerequisite command is on PATH. Uses `where`/`which` so
 * we never actually execute the tools. Purely informational — nothing here is
 * fatal to an install.
 * @returns {Record<string,{found:boolean,path:string|null}>}
 */
export function detectPrereqs(commands = PREREQS) {
  const locator = process.platform === 'win32' ? 'where' : 'which';
  const out = {};
  for (const cmd of commands) {
    let found = false;
    let foundPath = null;
    try {
      const r = spawnSync(locator, [cmd], { encoding: 'utf8' });
      if (r.status === 0 && r.stdout && r.stdout.trim()) {
        found = true;
        foundPath = r.stdout.split(/\r?\n/).filter(Boolean)[0];
      }
    } catch {
      /* locator itself missing — treat the command as not found */
    }
    out[cmd] = { found, path: foundPath };
  }
  return out;
}

// --- link inspection + removal ---------------------------------------------

/**
 * Inspect an existing entry at `link`.
 * @returns {{exists:boolean, isLink?:boolean, target?:string|null, ours?:boolean}}
 */
function inspectLink(link, repoRoot) {
  let st;
  try {
    st = fs.lstatSync(link);
  } catch {
    return { exists: false };
  }
  const isLink = st.isSymbolicLink();
  let target = null;
  let ours = false;
  if (isLink) {
    try {
      target = fs.readlinkSync(link);
      ours = isInsideRepo(target, repoRoot);
    } catch {
      /* dangling link — treat as foreign (do not touch without --force) */
    }
  }
  return { exists: true, isLink, target, ours };
}

/**
 * Remove an entry. A symlink/junction is unlinked (never followed). A real
 * directory is removed recursively — reached only via `--force`.
 */
function removeEntry(link) {
  const st = fs.lstatSync(link);
  if (st.isSymbolicLink()) {
    try {
      fs.unlinkSync(link);
    } catch (e) {
      // Windows directory junctions sometimes need rmdir rather than unlink.
      if (process.platform === 'win32') fs.rmdirSync(link);
      else throw e;
    }
  } else {
    fs.rmSync(link, { recursive: true, force: true });
  }
}

// --- plan / install / uninstall --------------------------------------------

/**
 * Compute the action for each skill without touching the filesystem.
 * kinds: 'skip' | 'create' | 'relink' | 'replace' | 'conflict'.
 * @returns {{name,link,target,kind,reason?}[]}
 */
export function computePlan({ repoRoot = REPO_ROOT, skillsDir, force = false }) {
  const actions = [];
  for (const skill of discoverSkills(repoRoot)) {
    const link = path.join(skillsDir, skill.name);
    const info = inspectLink(link, repoRoot);
    let kind;
    let reason;
    if (!info.exists) {
      kind = 'create';
    } else if (info.isLink && info.ours && samePath(info.target, skill.target)) {
      kind = 'skip';
      reason = 'already linked';
    } else if (info.isLink && info.ours) {
      kind = 'relink';
      reason = 'link points elsewhere in this repo';
    } else if (force) {
      kind = 'replace';
      reason = info.isLink ? 'foreign link' : 'foreign directory';
    } else {
      kind = 'conflict';
      reason = info.isLink ? 'foreign link' : 'foreign directory';
    }
    actions.push({ name: skill.name, link, target: skill.target, kind, reason });
  }
  return actions;
}

/**
 * Install (link) every discovered skill into `skillsDir`.
 * @returns {{actions, changed:number, conflicts:number, ok:boolean}}
 */
export function install({
  repoRoot = REPO_ROOT,
  skillsDir,
  force = false,
  dryRun = false,
  log = () => {},
}) {
  const actions = computePlan({ repoRoot, skillsDir, force });
  if (!dryRun) fs.mkdirSync(skillsDir, { recursive: true });

  let changed = 0;
  let conflicts = 0;
  for (const a of actions) {
    if (a.kind === 'skip') {
      log(`  = ${a.name}  already linked`);
      continue;
    }
    if (a.kind === 'conflict') {
      conflicts++;
      log(`  ! ${a.name}  refusing to overwrite ${a.reason} at ${a.link} (use --force)`);
      continue;
    }
    if (dryRun) {
      log(`  + ${a.name}  would ${a.kind} -> ${a.target}`);
      changed++;
      continue;
    }
    if (a.kind === 'relink' || a.kind === 'replace') removeEntry(a.link);
    fs.symlinkSync(a.target, a.link, linkType());
    log(`  + ${a.name}  ->  ${a.target}`);
    changed++;
  }
  return { actions, changed, conflicts, ok: conflicts === 0 };
}

/**
 * Uninstall: remove ONLY links that point into this repo. Foreign entries and
 * unrelated names are left untouched.
 * @returns {{removed:number, kept:number}}
 */
export function uninstall({ repoRoot = REPO_ROOT, skillsDir, dryRun = false, log = () => {} }) {
  let removed = 0;
  let kept = 0;
  for (const skill of discoverSkills(repoRoot)) {
    const link = path.join(skillsDir, skill.name);
    const info = inspectLink(link, repoRoot);
    if (!info.exists) continue;
    if (info.isLink && info.ours) {
      if (!dryRun) removeEntry(link);
      log(`  - ${skill.name}  ${dryRun ? 'would remove' : 'removed'}`);
      removed++;
    } else {
      log(`  · ${skill.name}  left untouched (not ours)`);
      kept++;
    }
  }
  return { removed, kept };
}

// --- dual-host provisioning (Wave 5, Front 4) ------------------------------

/** Resolve a host's skills dir under `home` (e.g. ~/.gemini/skills). */
export function hostSkillsDir(host, { home = os.homedir() } = {}) {
  return path.join(home, ...host.skillsSubdir);
}

/**
 * The per-host CAPABILITY CHECKLIST: for each host, where its skills link and whether
 * its CLI is on PATH. A missing CLI is NOT disqualifying — skills still link (activate
 * once the CLI is installed) — so `provisionable` reflects only that a skills target is
 * resolvable. CLI detection is presence-only (`where`/`which`), never executed.
 * @returns {{id,label,cli,cliFound,cliPath,skillsDir,provisionable}[]}
 */
export function capabilityChecklist({ home = os.homedir(), hosts = HOSTS } = {}) {
  const detected = detectPrereqs(hosts.map((h) => h.cli));
  return hosts.map((h) => ({
    id: h.id,
    label: h.label,
    cli: h.cli,
    cliFound: detected[h.cli].found,
    cliPath: detected[h.cli].path,
    skillsDir: hostSkillsDir(h, { home }),
    provisionable: true, // a skills dir is always resolvable/creatable under HOME
  }));
}

/**
 * Install (link) every discovered skill into EACH host's skills dir, behind the
 * capability checklist. A host is `provisioned` when its install left no conflicts (so
 * the trio skills resolve under it). Aggregates per-host results.
 * @returns {{hosts:Array, changed:number, conflicts:number, ok:boolean, allProvisioned:boolean}}
 */
export function installAllHosts({
  repoRoot = REPO_ROOT,
  home = os.homedir(),
  hosts = HOSTS,
  force = false,
  dryRun = false,
  log = () => {},
}) {
  const checklist = capabilityChecklist({ home, hosts });
  const skills = discoverSkills(repoRoot);
  const results = [];
  let changed = 0;
  let conflicts = 0;
  for (const cap of checklist) {
    log(
      `onboard[${cap.label}]: linking ${skills.length} skill(s) into ${cap.skillsDir}` +
        (dryRun ? ' (dry-run)' : '') +
        (cap.cliFound ? '' : `  (note: \`${cap.cli}\` not on PATH — skills link now, activate once installed)`),
    );
    const r = install({ repoRoot, skillsDir: cap.skillsDir, force, dryRun, log });
    const provisioned = r.conflicts === 0;
    results.push({ ...cap, result: r, provisioned });
    changed += r.changed;
    conflicts += r.conflicts;
  }
  return {
    hosts: results,
    changed,
    conflicts,
    ok: conflicts === 0,
    allProvisioned: results.length > 0 && results.every((r) => r.provisioned),
  };
}

/**
 * Uninstall: remove ONLY our links from EACH host's skills dir (foreign + unrelated
 * entries untouched, per host). Aggregates per-host removed/kept counts.
 * @returns {{hosts:Array, removed:number, kept:number}}
 */
export function uninstallAllHosts({
  repoRoot = REPO_ROOT,
  home = os.homedir(),
  hosts = HOSTS,
  dryRun = false,
  log = () => {},
}) {
  const results = [];
  let removed = 0;
  let kept = 0;
  for (const h of hosts) {
    const skillsDir = hostSkillsDir(h, { home });
    log(`onboard[${h.label}]: removing trio skill links from ${skillsDir}`);
    const r = uninstall({ repoRoot, skillsDir, dryRun, log });
    log(`onboard[${h.label}]: ${r.removed} removed, ${r.kept} left untouched${dryRun ? ' (dry-run)' : ''}`);
    results.push({ id: h.id, label: h.label, skillsDir, ...r });
    removed += r.removed;
    kept += r.kept;
  }
  return { hosts: results, removed, kept };
}

// --- provenance lock (.agent-sync/state.json) — Wave 5, Phase D ------------
//
// The link installer leaves no record of WHAT it provisioned or from WHICH source
// revision. Phase D adds a verifiable provenance LOCK so an install is reproducible
// (`restore`), no-clobber gets a content-true gate (per-file SHA256, not just the
// `ours` link flag), and uninstall can target ONLY the links provenance still owns.
//
// Lock shape (.agent-sync/state.json under HOME):
//   { version, source_commit, installed_by,
//     skills: { <name>: { files: { "<posix/rel/path>": "<sha256-hex>", ... } } } }
//
// The per-skill per-file SHA256 map is the authority that distinguishes ADOPT (a
// foreign on-disk copy whose bytes are IDENTICAL to the source — safe to convert into
// a link, no user data exists to lose) from PRESERVE (a target whose SHA DIFFERS — a
// user-modified copy — never clobbered by the default path). See `classifyProvenance`.

/** Lock-format version (bump only on a breaking shape change). */
export const LOCK_VERSION = 1;
/** Directory (under HOME) that holds the provenance lock. */
export const AGENT_SYNC_DIRNAME = '.agent-sync';

/**
 * List every regular file under `dir`, returned as sorted POSIX-relative paths
 * (deterministic across OSes). Nested symlinks are skipped (the trio skills are plain
 * files + dirs); an unreadable dir yields `[]`.
 */
function listFilesRel(dir, base = dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFilesRel(full, base));
    else if (e.isFile()) out.push(path.relative(base, full).split(path.sep).join('/'));
    // symlinks / sockets / fifos: intentionally skipped (non-content, non-portable)
  }
  out.sort();
  return out;
}

/** SHA256 (hex) of a file's bytes. */
function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

/**
 * Per-file SHA256 map for a directory tree: `{ "<posix/rel/path>": "<sha256-hex>" }`.
 * Used both to BUILD the lock (over a skill's source dir) and to VERIFY a foreign
 * on-disk entry against the lock (adopt-vs-preserve).
 */
export function fileShas(dir) {
  const out = {};
  for (const rel of listFilesRel(dir)) out[rel] = sha256File(path.join(dir, rel));
  return out;
}

/** True iff two `{rel: sha}` maps have identical key sets AND identical hashes. */
function shaMapsEqual(a, b) {
  if (!a || !b) return false;
  const ak = Object.keys(a).sort();
  const bk = Object.keys(b).sort();
  if (ak.length !== bk.length) return false;
  for (let i = 0; i < ak.length; i++) {
    if (ak[i] !== bk[i] || a[ak[i]] !== b[ak[i]]) return false;
  }
  return true;
}

/**
 * Best-effort source commit of the repo (the revision this install/lock came from).
 * Returns the HEAD sha, or `null` when git is absent or the dir is not a repo —
 * provenance is never fatal to onboarding (matches the non-fatal prereq posture).
 */
export function sourceCommit(repoRoot = REPO_ROOT) {
  try {
    const r = spawnSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout && r.stdout.trim()) return r.stdout.trim();
  } catch {
    /* git not on PATH — leave source_commit null */
  }
  return null;
}

/** A stable `installed_by` stamp (`user@host (trio-onboard)`), best-effort. */
function defaultInstalledBy() {
  let who = 'unknown';
  let host = 'unknown';
  try {
    who = os.userInfo().username || who;
  } catch {
    /* userInfo can throw on some CI — leave default */
  }
  try {
    host = os.hostname() || host;
  } catch {
    /* leave default */
  }
  return `${who}@${host} (trio-onboard)`;
}

/**
 * Build the provenance lock for the repo's discovered skills: source commit +
 * per-skill per-file SHA256 + `installed_by`. Pure (no filesystem writes).
 */
export function buildLock({ repoRoot = REPO_ROOT, installedBy = defaultInstalledBy() } = {}) {
  const skills = {};
  for (const s of discoverSkills(repoRoot)) {
    skills[s.name] = { files: fileShas(s.target) };
  }
  return {
    version: LOCK_VERSION,
    source_commit: sourceCommit(repoRoot),
    installed_by: installedBy,
    skills,
  };
}

/** Absolute path of the provenance lock under `home` (~/.agent-sync/state.json). */
export function lockPath(home) {
  return path.join(home, AGENT_SYNC_DIRNAME, 'state.json');
}

/** Write the lock as pretty JSON under `home`. Returns the path written. */
export function writeLock({ home, lock, dryRun = false }) {
  const p = lockPath(home);
  if (!dryRun) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(lock, null, 2) + '\n');
  }
  return p;
}

/** Read the lock under `home`, or `null` if absent/unparseable. */
export function readLock({ home }) {
  try {
    return JSON.parse(fs.readFileSync(lockPath(home), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Provenance classification for one skill's link site, layered ON TOP of `inspectLink`.
 * This is where adopt-vs-relink is spelled out:
 *   - create   : nothing there yet.
 *   - skip     : our link, already pointing at this skill (idempotent).
 *   - relink   : our link, but pointing ELSEWHERE in-repo (re-point it).
 *   - adopt    : a FOREIGN real dir whose per-file SHA256 EQUALS the lock — a verbatim
 *                copy of our content, so converting it to a link loses nothing.
 *   - preserve : a foreign entry whose SHA DIFFERS (or a foreign/dangling link, or no
 *                lock to compare) — user data; NEVER clobbered by the default path.
 *   - replace  : a foreign entry under `--force` (explicitly destructive override).
 * @returns {{kind:string, info:object, reason?:string}}
 */
export function classifyProvenance({ link, target, repoRoot = REPO_ROOT, lockFiles = null, force = false }) {
  const info = inspectLink(link, repoRoot);
  if (!info.exists) return { kind: 'create', info };
  if (info.isLink && info.ours && samePath(info.target, target)) {
    return { kind: 'skip', info, reason: 'already linked' };
  }
  if (info.isLink && info.ours) {
    return { kind: 'relink', info, reason: 'ours-link points elsewhere in this repo' };
  }
  // Foreign entry. A real dir can be SHA-checked against the lock; a foreign/dangling
  // link cannot (no content to hash) and is always preserved unless forced.
  if (!info.isLink && lockFiles) {
    if (shaMapsEqual(fileShas(link), lockFiles)) {
      return { kind: 'adopt', info, reason: 'foreign dir is a verbatim copy (SHA matches lock)' };
    }
    if (force) return { kind: 'replace', info, reason: 'foreign dir modified (SHA differs) — forced' };
    return { kind: 'preserve', info, reason: 'foreign dir modified (SHA differs) — preserved' };
  }
  if (force) {
    return { kind: 'replace', info, reason: info.isLink ? 'foreign link — forced' : 'foreign dir — forced' };
  }
  return { kind: 'preserve', info, reason: info.isLink ? 'foreign link' : 'foreign dir' };
}

/**
 * Compute the provenance-aware plan for `skillsDir` against `lock`. `only` (a Set of
 * skill names) restricts the plan to a subset — used by `restore` to act on exactly the
 * lock-recorded skills.
 * @returns {{name,link,target,kind,reason?}[]}
 */
export function computeProvenancePlan({ repoRoot = REPO_ROOT, skillsDir, lock = null, force = false, only = null }) {
  const actions = [];
  for (const skill of discoverSkills(repoRoot)) {
    if (only && !only.has(skill.name)) continue;
    const link = path.join(skillsDir, skill.name);
    const lockFiles = lock && lock.skills && lock.skills[skill.name] ? lock.skills[skill.name].files : null;
    const c = classifyProvenance({ link, target: skill.target, repoRoot, lockFiles, force });
    actions.push({ name: skill.name, link, target: skill.target, kind: c.kind, reason: c.reason });
  }
  return actions;
}

/**
 * Provenance-aware install: like `install`, but with the SHA-gated no-clobber.
 * `adopt` safely converts a verbatim on-disk copy into a link; `preserve` reports a
 * SHA-modified target and leaves it BYTE-FOR-BYTE untouched.
 * @returns {{actions, changed, adopted, preserved, conflicts, ok}}
 */
export function installProvenance({
  repoRoot = REPO_ROOT,
  skillsDir,
  lock = null,
  force = false,
  dryRun = false,
  only = null,
  log = () => {},
}) {
  const actions = computeProvenancePlan({ repoRoot, skillsDir, lock, force, only });
  if (!dryRun) fs.mkdirSync(skillsDir, { recursive: true });
  let changed = 0;
  let adopted = 0;
  let preserved = 0;
  let conflicts = 0;
  for (const a of actions) {
    if (a.kind === 'skip') {
      log(`  = ${a.name}  already linked`);
      continue;
    }
    if (a.kind === 'preserve') {
      preserved++;
      conflicts++;
      log(`  ! ${a.name}  preserved ${a.reason} at ${a.link} (use --force to overwrite)`);
      continue;
    }
    if (dryRun) {
      log(`  + ${a.name}  would ${a.kind} -> ${a.target}`);
      changed++;
      if (a.kind === 'adopt') adopted++;
      continue;
    }
    if (a.kind === 'relink' || a.kind === 'replace' || a.kind === 'adopt') removeEntry(a.link);
    fs.symlinkSync(a.target, a.link, linkType());
    if (a.kind === 'adopt') {
      adopted++;
      log(`  ~ ${a.name}  adopted (verbatim copy) ->  ${a.target}`);
    } else {
      log(`  + ${a.name}  ->  ${a.target}`);
    }
    changed++;
  }
  return { actions, changed, adopted, preserved, conflicts, ok: conflicts === 0 };
}

/**
 * Restore: rebuild the install from the provenance lock onto a (possibly clean) HOME.
 * Reads the lock under `home` (or uses an explicit `lock`), then re-links every
 * lock-recorded skill that is still discoverable in the repo into each host's skills
 * dir. Reproducible: a clean HOME yields exactly the recorded link set. SHA-modified
 * targets are still preserved (the no-clobber gate applies during restore too).
 * @returns {{ok, reason?, lock?, hosts, changed, conflicts, allRestored?}}
 */
export function restore({
  repoRoot = REPO_ROOT,
  home = os.homedir(),
  hosts = HOSTS,
  lock = null,
  force = false,
  dryRun = false,
  log = () => {},
}) {
  const theLock = lock || readLock({ home });
  if (!theLock) {
    log('onboard: no provenance lock found — nothing to restore.');
    return { ok: false, reason: 'no-lock', hosts: [], changed: 0, conflicts: 0 };
  }
  const only = new Set(Object.keys(theLock.skills || {}));
  const results = [];
  let changed = 0;
  let conflicts = 0;
  for (const h of hosts) {
    const skillsDir = hostSkillsDir(h, { home });
    log(
      `onboard[${h.label}]: restoring ${only.size} skill(s) from lock into ${skillsDir}` +
        (dryRun ? ' (dry-run)' : ''),
    );
    const r = installProvenance({ repoRoot, skillsDir, lock: theLock, force, dryRun, only, log });
    results.push({ id: h.id, label: h.label, skillsDir, result: r });
    changed += r.changed;
    conflicts += r.conflicts;
  }
  return {
    ok: conflicts === 0,
    lock: theLock,
    hosts: results,
    changed,
    conflicts,
    allRestored: results.length > 0 && results.every((x) => x.result.ok),
  };
}

/**
 * Provenance uninstall: remove ONLY orphaned `ours` links — links that the lock records
 * as provenance-owned but whose skill is NO LONGER discoverable in the repo (the skill
 * was removed upstream, so the link is now dangling/stale). Live `ours` links (still a
 * current skill), foreign entries, and `ours` links the lock does not record are all
 * left untouched.
 * @returns {{removed, kept, orphans:string[]}}
 */
export function provenanceUninstall({ repoRoot = REPO_ROOT, skillsDir, lock = null, dryRun = false, log = () => {} }) {
  const recorded = new Set(lock && lock.skills ? Object.keys(lock.skills) : []);
  const live = new Set(discoverSkills(repoRoot).map((s) => s.name));
  let entries;
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    return { removed: 0, kept: 0, orphans: [] };
  }
  let removed = 0;
  let kept = 0;
  const orphans = [];
  for (const e of entries) {
    const link = path.join(skillsDir, e.name);
    const info = inspectLink(link, repoRoot);
    const isOurs = info.exists && info.isLink && info.ours;
    if (!isOurs) continue; // foreign / unrelated entry — never our concern
    const orphaned = recorded.has(e.name) && !live.has(e.name);
    if (orphaned) {
      if (!dryRun) removeEntry(link);
      log(`  - ${e.name}  ${dryRun ? 'would remove' : 'removed'} orphaned provenance link`);
      removed++;
      orphans.push(e.name);
    } else {
      log(`  · ${e.name}  kept (live provenance link)`);
      kept++;
    }
  }
  return { removed, kept, orphans };
}

/** Provenance uninstall across every host's skills dir (orphans only). */
export function provenanceUninstallAllHosts({
  repoRoot = REPO_ROOT,
  home = os.homedir(),
  hosts = HOSTS,
  lock = null,
  dryRun = false,
  log = () => {},
}) {
  const theLock = lock || readLock({ home });
  const results = [];
  let removed = 0;
  let kept = 0;
  for (const h of hosts) {
    const skillsDir = hostSkillsDir(h, { home });
    log(`onboard[${h.label}]: pruning orphaned provenance links from ${skillsDir}`);
    const r = provenanceUninstall({ repoRoot, skillsDir, lock: theLock, dryRun, log });
    results.push({ id: h.id, label: h.label, skillsDir, ...r });
    removed += r.removed;
    kept += r.kept;
  }
  return { hosts: results, removed, kept };
}

// --- CLI -------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    uninstall: false,
    restore: false,
    prune: false,
    force: false,
    dryRun: false,
    home: null,
    skillsDir: null,
    host: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--uninstall') args.uninstall = true;
    else if (a === '--restore') args.restore = true;
    else if (a === '--prune') args.prune = true;
    else if (a === '--force') args.force = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--home') args.home = argv[++i];
    else if (a.startsWith('--home=')) args.home = a.slice('--home='.length);
    else if (a === '--skills-dir') args.skillsDir = argv[++i];
    else if (a.startsWith('--skills-dir=')) args.skillsDir = a.slice('--skills-dir='.length);
    else if (a === '--host') args.host = argv[++i];
    else if (a.startsWith('--host=')) args.host = a.slice('--host='.length);
    else if (a === '-h' || a === '--help') args.help = true;
  }
  return args;
}

const HELP = `trio /onboard installer (dual-host: Claude Code + Gemini CLI)

Usage:
  node tools/onboard.mjs                 install into every host (~/.claude/skills + ~/.gemini/skills)
  node tools/onboard.mjs --dry-run       show what would happen, change nothing
  node tools/onboard.mjs --force         overwrite a foreign dir/link at <name>
  node tools/onboard.mjs --uninstall     remove only links that point into this repo (every host)
  node tools/onboard.mjs --restore       rebuild the install from ~/.agent-sync/state.json (the lock)
  node tools/onboard.mjs --prune         remove only ORPHANED provenance links (stale skills) (every host)
  node tools/onboard.mjs --host ID       restrict to one host (claude | gemini)
  node tools/onboard.mjs --home DIR      treat DIR as HOME (override ~)
  node tools/onboard.mjs --skills-dir D  link into D only (single-dir, host-agnostic)
`;

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }
  const repoRoot = REPO_ROOT;
  const log = (m) => process.stdout.write(m + '\n');

  const skills = discoverSkills(repoRoot);
  if (!skills.length) {
    process.stderr.write(`onboard: no skills (no SKILL.md dirs) found under ${repoRoot}\n`);
    return 1;
  }

  // --- single-dir override (back-compat): one explicit skills dir, host-agnostic. ----
  if (args.skillsDir) {
    const skillsDir = path.resolve(args.skillsDir);
    const prereqs = detectPrereqs();
    const missing = PREREQS.filter((c) => !prereqs[c].found);
    process.stdout.write(
      missing.length
        ? `onboard: missing prerequisite(s): ${missing.join(', ')} — install for full functionality\n`
        : 'onboard: prerequisites present (node, claude, git)\n',
    );
    if (args.uninstall) {
      log(`onboard: removing trio skill links from ${skillsDir}`);
      const r = uninstall({ repoRoot, skillsDir, dryRun: args.dryRun, log });
      log(`onboard: ${r.removed} removed, ${r.kept} left untouched${args.dryRun ? ' (dry-run)' : ''}`);
      return 0;
    }
    log(`onboard: linking ${skills.length} skill(s) into ${skillsDir}${args.dryRun ? ' (dry-run)' : ''}`);
    const r = install({ repoRoot, skillsDir, force: args.force, dryRun: args.dryRun, log });
    log(`onboard: ${r.changed} change(s), ${r.conflicts} conflict(s)`);
    if (r.conflicts > 0) {
      log('onboard: re-run with --force to overwrite the conflicting entries (this is destructive).');
      return 1;
    }
    if (!args.dryRun) log('onboard: done — restart the host (or reload skills) to activate.');
    return 0;
  }

  // --- dual-host default: provision every host behind the capability checklist. ------
  const home = args.home ? path.resolve(args.home) : os.homedir();
  const hosts = args.host ? HOSTS.filter((h) => h.id === args.host) : HOSTS;
  if (!hosts.length) {
    process.stderr.write(
      `onboard: unknown --host ${args.host} (known: ${HOSTS.map((h) => h.id).join(', ')})\n`,
    );
    return 1;
  }

  // Capability checklist (informational — a missing host CLI is never fatal; the skills
  // still link, ready to activate once that CLI is installed).
  log('onboard: capability checklist —');
  for (const c of capabilityChecklist({ home, hosts })) {
    log(
      `  [${c.provisionable ? 'x' : ' '}] ${c.label}: \`${c.cli}\` ` +
        (c.cliFound ? `found (${c.cliPath})` : 'not on PATH (skills still link; activate once installed)') +
        `; skills -> ${c.skillsDir}`,
    );
  }

  if (args.restore) {
    const r = restore({ repoRoot, home, hosts, force: args.force, dryRun: args.dryRun, log });
    if (!r.ok && r.reason === 'no-lock') return 1;
    log(
      `onboard: restored ${r.changed} link(s) from lock across ${hosts.length} host(s)` +
        (args.dryRun ? ' (dry-run)' : ''),
    );
    if (r.conflicts > 0) {
      log('onboard: some targets were SHA-modified and preserved — re-run with --force to overwrite.');
      return 1;
    }
    return 0;
  }

  if (args.prune) {
    const r = provenanceUninstallAllHosts({ repoRoot, home, hosts, dryRun: args.dryRun, log });
    log(
      `onboard: ${r.removed} orphaned link(s) removed across ${hosts.length} host(s)` +
        (args.dryRun ? ' (dry-run)' : ''),
    );
    return 0;
  }

  if (args.uninstall) {
    const r = uninstallAllHosts({ repoRoot, home, hosts, dryRun: args.dryRun, log });
    log(`onboard: ${r.removed} removed across ${hosts.length} host(s)${args.dryRun ? ' (dry-run)' : ''}`);
    return 0;
  }

  const r = installAllHosts({ repoRoot, home, hosts, force: args.force, dryRun: args.dryRun, log });
  log(`onboard: ${r.changed} change(s), ${r.conflicts} conflict(s) across ${hosts.length} host(s)`);
  if (r.conflicts > 0) {
    log('onboard: re-run with --force to overwrite the conflicting entries (this is destructive).');
    return 1;
  }
  if (r.allProvisioned) {
    const which = hosts.length === HOSTS.length ? 'both hosts' : `${hosts.length} host(s)`;
    log(`onboard: ${which} provisioned (${hosts.map((h) => h.label).join(' + ')})`);
  }
  // Wave 5: record the provenance lock so `--restore` can rebuild this exact install.
  if (!args.dryRun) {
    try {
      const p = writeLock({ home, lock: buildLock({ repoRoot }) });
      log(`onboard: provenance lock written -> ${p}`);
    } catch (e) {
      log(`onboard: warning — could not write provenance lock (${e.message})`);
    }
  }
  if (!args.dryRun) log('onboard: done — restart the host (or reload skills) to activate.');
  return 0;
}

// Run as CLI only when invoked directly (not when imported by the test).
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
