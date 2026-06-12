#!/usr/bin/env node
// trio — rule-enforcing PreToolUse guard (Wave 4, Phase B).
//
// A PURE decision function `hookDecide(payload, context) -> { decision, audit }`
// plus the Claude Code `PreToolUse` wiring around it, and an `onboard`-installable
// USER-LEVEL hook whose install target lives OUTSIDE any build worktree (so a build
// agent operating inside the worktree cannot quietly disable its own guard).
//
// The rules (deterministic, pure):
//   * never merge/push to `main`/`master` without a GO token  -> deny (override w/ GO = allow + audit)
//   * never edit a `*.test.mjs` / gate file during a Foreman fix step -> deny
//   * never let an Edit tamper with the guard's OWN files (self-protection) -> deny
//   * a non-dry DESTRUCTIVE apply (rm -rf, git reset --hard, …)            -> ask
//   * anything else -> allow (the guard is OFF for everything it does not own)
//
// Design promises:
//   * typed         — every call returns `{ decision: allow|ask|deny, rule, reason, audit, override }`.
//   * deterministic — `hookDecide` reads ONLY (payload, context); no clock, no env, no I/O. Same
//                     input -> byte-identical output. (Timestamps are added by the CLI logger, never
//                     by the pure function, so audit lines stay reproducible in tests.)
//   * default OFF   — unmatched tool calls are ALLOWed; the guard only intervenes on its own rules.
//   * fail-safe ASK — a malformed payload or any internal error degrades to ASK, never to a silent
//                     allow, so the guard never green-lights a partial/destructive git state.
//   * override+audit— a GO-token override of the main-merge deny still EMITS an audit line (never silent).
//
// This wave gates the pure decision function + the static install-scope ONLY. Actual harness
// ENFORCEMENT (the live `PreToolUse` block) is an attended proof, tracked on the human checklist.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** The repo root is the parent of this `tools/` directory. */
export const REPO_ROOT = path.resolve(HERE, '..');

// --- path scope helpers (Windows-aware, mirrors onboard.mjs semantics) ------

/** Normalize an absolute path for comparison (lowercased on Windows). */
function normPath(p) {
  let s = String(p);
  if (process.platform === 'win32') s = s.replace(/^\\\\\?\\/, ''); // \\?\C:\… → C:\…
  s = path.resolve(s);
  if (s.length > 1 && s.endsWith(path.sep)) s = s.slice(0, -1);
  return process.platform === 'win32' ? s.toLowerCase() : s;
}

/** True if `target` resolves to `repoRoot` itself or anything under it. */
function isInsideRepo(target, repoRoot) {
  const t = normPath(target);
  const r = normPath(repoRoot);
  return t === r || t.startsWith(r + path.sep);
}

/** True if `p` resolves OUTSIDE `repoRoot` (the install-scope invariant). */
export function isOutsideRepo(p, repoRoot = REPO_ROOT) {
  return !isInsideRepo(p, repoRoot);
}

// --- minimal glob matcher (no deps): supports `**`, `**/`, and `*` ----------

/** Compile a forward-slash glob into an anchored RegExp (case-insensitive on Windows). */
function globToRegExp(glob) {
  const g = String(glob).replace(/\\/g, '/');
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        i++; // consume the second '*'
        if (g[i + 1] === '/') {
          i++; // consume the '/': `**/` matches zero or more leading dirs
          re += '(?:.*/)?';
        } else {
          re += '.*'; // `**` matches across path separators
        }
      } else {
        re += '[^/]*'; // `*` matches within a single segment
      }
    } else if ('\\^$+?.()|[]{}'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$', process.platform === 'win32' ? 'i' : '');
}

/** True if path `p` matches ANY of the given globs (separator-insensitive). */
export function matchesAnyGlob(p, globs) {
  const norm = String(p).replace(/\\/g, '/');
  return globs.some((g) => globToRegExp(g).test(norm));
}

// --- the protected path sets ------------------------------------------------

/**
 * The guard's OWN files. An Edit/Write targeting any of these is ALWAYS denied
 * (tamper-proofing) — you cannot disable the guard from inside a tool call.
 */
export const HOOK_GUARD_GLOBS = [
  '**/.claude/settings.json', // the user-level PreToolUse wiring
  '**/.claude/hooks/trio-guard.mjs', // the installed guard script
  '**/tools/hook-guard.mjs', // this source module
];

/**
 * Test / gate files. Editing any of these DURING a Foreman fix step is denied
 * (a fix must never weaken or delete the gate it is being judged against).
 */
export const GATE_GLOBS = [
  '**/*.test.mjs',
  '**/tools/gate-inventory.mjs',
  '**/tools/gate-inventory.manifest.json',
];

// --- command classifiers (pure, regex-based) --------------------------------

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/** Extract the edited path from any edit-tool input shape. */
function editPath(input) {
  return String((input && (input.file_path || input.path || input.notebook_path)) || '');
}

/** A git `merge`/`push` that references `main`/`master`. */
function isMergeOrPushToMain(cmd) {
  if (!/\bgit\b/.test(cmd)) return false;
  const isMerge = /\bgit\b[^;|&]*\bmerge\b/.test(cmd);
  const isPush = /\bgit\b[^;|&]*\bpush\b/.test(cmd);
  if (!isMerge && !isPush) return false;
  return /\b(main|master)\b/.test(cmd);
}

/** A GO token authorizes a main merge/push: explicit context, or an in-command sentinel. */
function hasGoToken(context, cmd) {
  if (context && (context.go === true || (typeof context.goToken === 'string' && context.goToken.length > 0))) {
    return true;
  }
  return /\bTRIO_GO=1\b/.test(cmd) || /#\s*trio-go\b/.test(cmd);
}

const DESTRUCTIVE = [
  /\brm\s+-[a-z]*r[a-z]*f/i, // rm -rf
  /\brm\s+-[a-z]*f[a-z]*r/i, // rm -fr
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\s+-[a-z]*f/,
  /\bgit\s+push\b[^;|&]*--force\b/,
  /\bgit\s+push\b[^;|&]*\s-f\b/,
  /\bgit\s+branch\s+-D\b/,
  /\btruncate\b/,
  /\bdd\s+if=/,
  /\bmkfs\b/,
  /\bshred\b/,
];

function isDestructive(cmd) {
  return DESTRUCTIVE.some((re) => re.test(cmd));
}

/** A destructive command counts as "dry" if it self-declares so (no real mutation). */
function isDryRun(cmd, input, context) {
  if (context && context.dryRun === true) return true;
  if (input && (input.dry_run === true || input.dryRun === true)) return true;
  return /--dry-run\b/.test(cmd) || /\bDRY_RUN=1\b/.test(cmd);
}

// --- the typed decision -----------------------------------------------------

/**
 * Build the typed decision record. `audit` is a single line for any non-allow
 * decision AND for an override-allow; a plain allow carries `audit: null`.
 */
function decision(kind, rule, reason, override = false) {
  const audit =
    kind === 'allow' && !override
      ? null
      : `[trio-guard] ${kind.toUpperCase()} rule=${rule || 'none'} :: ${reason}`;
  return { decision: kind, rule: rule || null, reason, audit, override: !!override };
}

/**
 * The pure guard. Maps a Claude Code `PreToolUse` payload (+ an optional decision
 * context) onto a typed `{ decision, rule, reason, audit, override }`.
 *
 * @param {{tool_name?:string, tool_input?:object}} payload  the PreToolUse payload
 * @param {{go?:boolean, goToken?:string, foremanFixStep?:boolean, dryRun?:boolean}} [context]
 * @returns {{decision:'allow'|'ask'|'deny', rule:string|null, reason:string, audit:string|null, override:boolean}}
 */
export function hookDecide(payload, context = {}) {
  try {
    const tool = payload && typeof payload === 'object' ? payload.tool_name : undefined;
    if (!tool || typeof tool !== 'string') {
      return decision('ask', 'fail-safe', 'unrecognized PreToolUse payload (no tool_name) — failing safe to ASK');
    }
    const input = (payload && payload.tool_input) || {};

    // Rule 1 — self-protection: never let an edit tamper with the guard's own files.
    if (EDIT_TOOLS.has(tool)) {
      const p = editPath(input);
      if (p && matchesAnyGlob(p, HOOK_GUARD_GLOBS)) {
        return decision('deny', 'guard-self-protection', `refusing to edit the guard's own file: ${p}`);
      }
      // Rule 2 — protect test/gate files during a Foreman fix step.
      if (context.foremanFixStep && p && matchesAnyGlob(p, GATE_GLOBS)) {
        return decision('deny', 'fix-step-gate-edit', `refusing to edit a test/gate file during a Foreman fix step: ${p}`);
      }
    }

    // Rule 3 — never merge/push to main without a GO token.
    if (tool === 'Bash') {
      const cmd = String(input.command || '');
      if (isMergeOrPushToMain(cmd)) {
        if (hasGoToken(context, cmd)) {
          return decision('allow', 'main-merge-go-override', `merge/push to main ALLOWED by GO token (override): ${cmd}`, true);
        }
        return decision('deny', 'main-merge-no-go', `refusing to merge/push to main without a GO token: ${cmd}`);
      }
      // Rule 4 — ask before a non-dry destructive apply.
      if (isDestructive(cmd) && !isDryRun(cmd, input, context)) {
        return decision('ask', 'destructive-apply', `confirm a non-dry destructive command before it runs: ${cmd}`);
      }
    }

    // Default OFF: the guard does not interfere with anything it does not own.
    return decision('allow', null, 'no rule matched');
  } catch (err) {
    return decision('ask', 'fail-safe', `guard error — failing safe to ASK: ${(err && err.message) || err}`);
  }
}

// --- Claude Code PreToolUse wiring ------------------------------------------

/** Translate a typed decision into Claude Code's `PreToolUse` hook output shape. */
export function toClaudeHookOutput(result) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: result.decision, // 'allow' | 'deny' | 'ask'
      permissionDecisionReason: result.reason,
    },
  };
}

/** Derive the decision context from the environment (CLI side; never used by the pure fn). */
export function contextFromEnv(env = process.env) {
  return {
    go: env.TRIO_GUARD_GO === '1' || env.TRIO_GO === '1',
    goToken: env.TRIO_GO_TOKEN || '',
    foremanFixStep: env.FOREMAN_STEP === 'fix' || env.FOREMAN_FIX_STEP === '1',
    dryRun: env.TRIO_DRY_RUN === '1',
  };
}

// --- user-level install target (OUTSIDE any build worktree) -----------------

/**
 * Where the user-level hook installs. Everything lives under `~/.claude` so it is
 * OUTSIDE the build worktree/repo — a build agent inside the worktree cannot reach
 * it through a relative path, and `isOutsideRepo` proves the scope.
 */
export function hookInstallTarget({ home = os.homedir() } = {}) {
  const dir = path.join(home, '.claude', 'hooks');
  return {
    dir,
    script: path.join(dir, 'trio-guard.mjs'),
    settings: path.join(home, '.claude', 'settings.json'),
    auditLog: path.join(home, '.claude', 'trio-guard-audit.log'),
  };
}

/** The `PreToolUse` settings block that runs this guard for every tool call. */
export function hookSettingsBlock(target = hookInstallTarget()) {
  return {
    PreToolUse: [
      {
        matcher: '*',
        hooks: [{ type: 'command', command: `node "${target.script}"` }],
      },
    ],
  };
}

/**
 * Install (or dry-run) the user-level hook: copy this guard to `~/.claude/hooks` and
 * MERGE the `PreToolUse` block into `~/.claude/settings.json` (non-destructive — existing
 * keys/hooks are preserved). Returns the resolved target. Default OFF: nothing here runs
 * unless `/onboard` (or the CLI) is explicitly asked to install the hook.
 */
export function installHook({ home = os.homedir(), dryRun = false, log = () => {} } = {}) {
  const target = hookInstallTarget({ home });
  log(`hook-guard: install target ${target.script} (outside repo: ${isOutsideRepo(target.script)})`);
  if (dryRun) {
    log('hook-guard: dry-run — no files written');
    return { target, changed: false };
  }
  fs.mkdirSync(target.dir, { recursive: true });
  fs.copyFileSync(fileURLToPath(import.meta.url), target.script);

  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(target.settings, 'utf8'));
  } catch {
    /* fresh settings.json */
  }
  settings.hooks = settings.hooks || {};
  if (!settings.hooks.PreToolUse) {
    settings.hooks.PreToolUse = hookSettingsBlock(target).PreToolUse;
  }
  fs.mkdirSync(path.dirname(target.settings), { recursive: true });
  fs.writeFileSync(target.settings, JSON.stringify(settings, null, 2) + '\n');
  log('hook-guard: installed user-level PreToolUse guard (default OFF — set TRIO_GUARD_GO/etc to override).');
  return { target, changed: true };
}

// --- CLI: PreToolUse handler + installer ------------------------------------

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main(argv) {
  if (argv.includes('--install') || argv.includes('--install-hook')) {
    const dryRun = argv.includes('--dry-run');
    installHook({ dryRun, log: (m) => process.stdout.write(m + '\n') });
    return 0;
  }

  // Default mode: act as the PreToolUse hook — read the payload from stdin, decide,
  // append a timestamped audit line (CLI-only side effect), emit the Claude output.
  let payload = null;
  try {
    payload = JSON.parse(readStdin() || '{}');
  } catch {
    payload = null; // hookDecide fail-safes to ASK on a null/garbled payload
  }
  const result = hookDecide(payload, contextFromEnv());
  if (result.audit) {
    try {
      const { auditLog } = hookInstallTarget();
      fs.mkdirSync(path.dirname(auditLog), { recursive: true });
      fs.appendFileSync(auditLog, `${new Date().toISOString()} ${result.audit}\n`);
    } catch {
      /* never fail the hook on a logging error */
    }
  }
  process.stdout.write(JSON.stringify(toClaudeHookOutput(result)) + '\n');
  return 0;
}

// Run as CLI only when invoked directly (not when imported by the test).
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
