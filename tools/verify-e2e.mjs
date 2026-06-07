#!/usr/bin/env node
// trio — end-to-end fresh-clone verifier (Wave 7).
//
// Proves the central promise of the repo: a *fresh clone* of trio activates the
// whole skill trio with one `/onboard`, and every engine resolves trio's OWN
// internal `crucible/` + `foreman/` + `drivers/` — with no dependency on the
// original `C:\dev` source trees.
//
// It does this hermetically, the way a new user would experience it:
//   1. copy the working tree into a throwaway temp dir   (a stand-in clone)
//   2. run `tools/onboard.mjs` against a throwaway HOME   (never touches ~/.claude)
//   3. assert all three skills link into the temp copy
//   4. run each engine's import smoke THROUGH the onboard junction, from a cwd
//      outside both the copy and `C:\dev`, so a passing smoke proves the engine
//      resolved its siblings via its own `../../` pins inside the fresh copy.
//
// The researchPrime smoke is the load-bearing one: it imports the engine's
// `bin/contract.mjs` through the junction and calls `runImportSpike()`, which
// only returns `{go:true}` when all five crossed trio modules resolve. Running
// `node researchPrime/bin/contract.mjs` directly would print nothing through a
// junction, so the probe is an explicit `import(...)` of the file URL instead.
//
// Usage:
//   node tools/verify-e2e.mjs            # run the full check; exit 0 on success
//   node tools/verify-e2e.mjs --json     # machine-readable result on stdout
//   node tools/verify-e2e.mjs --keep     # leave the temp dirs in place (debug)

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** The repo root is the parent of this `tools/` directory. */
export const REPO_ROOT = path.resolve(HERE, '..');

/** The three skills a fresh clone must activate. */
export const EXPECTED_SKILLS = ['crucible', 'foreman', 'researchPrime'];

// Directories never copied into the fresh-clone stand-in (mirrors .gitignore +
// the Wave-1 copy-exclusion set). These are build artifacts / deps, never
// published, and would only slow the copy down.
const IGNORE_DIRS = new Set(['.git', 'node_modules', '.foreman', 'out']);

/** True if a file name is a non-shipping artifact (checkpoints, logs, secrets). */
function ignoreFile(name) {
  return (
    name === '.env' ||
    name.endsWith('-checkpoint.json') ||
    name.endsWith('.log')
  );
}

/**
 * Copy the working tree under `src` into `dest`, skipping non-shipping artifacts.
 * A filtered filesystem walk (not `git`) so it copies the actual on-disk tree —
 * including not-yet-committed files — and works outside a git checkout.
 * @returns {number} files copied
 */
export function copyRepo(src, dest) {
  let count = 0;
  const walk = (relDir) => {
    const absDir = relDir ? path.join(src, relDir) : src;
    for (const e of fs.readdirSync(absDir, { withFileTypes: true })) {
      const rel = relDir ? path.join(relDir, e.name) : e.name;
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name)) continue;
        fs.mkdirSync(path.join(dest, rel), { recursive: true });
        walk(rel);
      } else if (e.isFile()) {
        if (ignoreFile(e.name)) continue;
        fs.mkdirSync(path.join(dest, path.dirname(rel)), { recursive: true });
        fs.copyFileSync(path.join(src, rel), path.join(dest, rel));
        count++;
      }
      // symlinks/other are intentionally skipped (a clone carries plain files)
    }
  };
  fs.mkdirSync(dest, { recursive: true });
  walk('');
  return count;
}

/** True if `link` is a symlink/junction whose real path is inside `repo`. */
export function linksInto(link, repo) {
  let st;
  try {
    st = fs.lstatSync(link);
  } catch {
    return false;
  }
  if (!st.isSymbolicLink()) return false;
  const real = fs.realpathSync(link);
  const rel = path.relative(fs.realpathSync(repo), real);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Run the temp copy's `tools/onboard.mjs` against `home` (its own REPO_ROOT is
 * the temp copy, computed from the script's location).
 * @returns {{status:number, stdout:string, stderr:string}}
 */
export function runOnboard(tempRepo, home, extraArgs = []) {
  const cli = path.join(tempRepo, 'tools', 'onboard.mjs');
  const r = spawnSync(process.execPath, [cli, '--home', home, ...extraArgs], {
    encoding: 'utf8',
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/**
 * Run one engine import smoke THROUGH the onboard junction. We `import()` the
 * file URL of `relFromSkill` under `skillsDir/<skill>` from a cwd outside the
 * copy, so resolution can only succeed via the engine's own `../../` pins.
 *
 * `evalExpr` is JS appended after the dynamic import resolves to `m`; it must
 * call `process.exit(0)` on success and a non-zero code on failure. The default
 * just confirms the module loads (top-level cross-imports all resolved).
 * @returns {{ok:boolean, status:number, stdout:string, stderr:string}}
 */
export function importSmoke(skillsDir, skill, relFromSkill, cwd, evalExpr) {
  const target = path.join(skillsDir, skill, relFromSkill);
  const url = pathToFileURL(target).href;
  const body = evalExpr
    ? `import(${JSON.stringify(url)}).then(async m=>{${evalExpr}}).catch(e=>{process.stderr.write(String(e&&e.stack||e));process.exit(1)})`
    : `import(${JSON.stringify(url)}).then(()=>process.exit(0)).catch(e=>{process.stderr.write(String(e&&e.stack||e));process.exit(1)})`;
  const r = spawnSync(process.execPath, ['-e', body], { cwd, encoding: 'utf8' });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

/** The per-engine smoke definitions, ordered crucible → foreman → researchPrime. */
const SMOKES = [
  {
    // crucible imports `../../foreman/bin/*` — loading it proves the load-bearing
    // sibling invariant resolves inside the fresh copy through the junction.
    skill: 'crucible',
    rel: path.join('bin', 'crucible-lib.mjs'),
    label: 'crucible engine loads (resolves ../../foreman/bin via junction)',
  },
  {
    skill: 'foreman',
    rel: path.join('bin', 'foreman-lib.mjs'),
    label: 'foreman engine loads',
  },
  {
    // The decisive one: runImportSpike() returns go:true only when all five
    // crossed trio modules resolve to the copy's own crucible/+foreman/.
    skill: 'researchPrime',
    rel: path.join('bin', 'contract.mjs'),
    label: 'researchPrime import spike returns go:true',
    eval: 'const v=await m.runImportSpike();process.stdout.write(JSON.stringify(v));process.exit(v.go?0:1)',
  },
];

/**
 * Run the full end-to-end verification.
 * @param {{srcRoot?:string, keep?:boolean, log?:(s:string)=>void}} [opts]
 * @returns {{ok:boolean, steps:{name:string,ok:boolean,detail?:string}[],
 *            tempRepo:string, tempHome:string}}
 */
export function verifyE2E(opts = {}) {
  const srcRoot = opts.srcRoot ?? REPO_ROOT;
  const log = opts.log ?? (() => {});
  const steps = [];
  const record = (name, ok, detail) => {
    steps.push({ name, ok, detail });
    log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
    return ok;
  };

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'trio-e2e-'));
  const tempRepo = path.join(work, 'trio'); // the stand-in fresh clone
  const tempHome = path.join(work, 'home'); // the stand-in ~ (HOME)
  const skillsDir = path.join(tempHome, '.claude', 'skills');

  try {
    // 1. Copy the working tree into the stand-in clone.
    const copied = copyRepo(srcRoot, tempRepo);
    record('copy working tree into a fresh-clone temp dir', copied > 0, `${copied} files`);

    // 2. Onboard against a throwaway HOME (never touches the real ~/.claude).
    const ob = runOnboard(tempRepo, tempHome);
    record(
      'onboard runs against a temp HOME',
      ob.status === 0,
      ob.status === 0 ? 'exit 0' : `exit ${ob.status}: ${ob.stderr.trim() || ob.stdout.trim()}`,
    );

    // 3. All three skills resolve into the fresh copy.
    for (const skill of EXPECTED_SKILLS) {
      const link = path.join(skillsDir, skill);
      record(`${skill} links into the fresh copy`, linksInto(link, tempRepo));
    }

    // 4. Each engine's import smoke passes THROUGH the junction, cwd outside the
    //    copy and outside C:\dev (tempHome lives under os.tmpdir()).
    for (const s of SMOKES) {
      const r = importSmoke(skillsDir, s.skill, s.rel, tempHome, s.eval);
      record(s.label, r.ok, r.ok ? (r.stdout.trim() || 'loaded') : (r.stderr.trim().split('\n')[0] || `exit ${r.status}`));
    }

    const ok = steps.every((s) => s.ok);
    return { ok, steps, tempRepo, tempHome };
  } finally {
    if (!opts.keep) {
      fs.rmSync(work, { recursive: true, force: true });
    } else {
      log(`  (kept temp dirs under ${work})`);
    }
  }
}

// --- CLI -------------------------------------------------------------------

function main(argv) {
  const json = argv.includes('--json');
  const keep = argv.includes('--keep');
  const log = json ? () => {} : (m) => process.stdout.write(m + '\n');

  if (!json) process.stdout.write('verify-e2e: fresh-clone activation check\n');
  const result = verifyE2E({ keep, log });

  if (json) {
    process.stdout.write(
      JSON.stringify({ ok: result.ok, steps: result.steps }, null, 2) + '\n',
    );
  } else if (result.ok) {
    process.stdout.write('verify-e2e: PASS — a fresh clone activates all three skills.\n');
  } else {
    const failed = result.steps.filter((s) => !s.ok).map((s) => s.name);
    process.stderr.write(`verify-e2e: FAIL — ${failed.length} step(s) failed: ${failed.join('; ')}\n`);
  }
  return result.ok ? 0 : 1;
}

// Run as CLI only when invoked directly (not when imported by the test).
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
