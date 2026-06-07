#!/usr/bin/env node
// trio — public-repo hygiene scrubber (Wave 2).
//
// Scans the *tracked* tree for a deny-list of things that must never ship in a
// public repo — personal absolute paths (e.g. C:\Users\<user>, /home/<user>),
// the maintainer's email, and common API-key shapes — and exits non-zero under
// `--check` if any are found. This is the publish-safety gate referenced by the
// project's done-when and re-run in Wave 7.
//
// Usage:
//   node tools/scrub.mjs --check            # scan the tracked tree; exit 1 on any hit
//   node tools/scrub.mjs --check --root DIR # scan an arbitrary directory (e.g. a fixture)
//   node tools/scrub.mjs --check --json     # machine-readable findings on stdout
//
// Design notes:
//   * "Tracked tree" = `git ls-files` when run inside a git repo (this is exactly
//     what would be published). When git is unavailable or the target is not a
//     repo (e.g. a test fixture), we fall back to a filesystem walk that skips the
//     usual non-shipping dirs.
//   * The deny-list patterns are written so this file does not match itself, and
//     the test file constructs its planted offenders from fragments — so the
//     scrubber scans the WHOLE tree, including its own source, with no exclusions.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The maintainer email is assembled from fragments so this source never contains
// the literal address (which would otherwise be a self-match).
const MAINTAINER_EMAIL = ['john.liechty', 'gmail.com'].join('@');

/**
 * The deny-list. Each rule has a stable `id`, a human `label`, and a global
 * `regex`. `secret: true` rules have their matched text redacted in reports so we
 * never echo a real key back into logs.
 */
export const DENY_RULES = [
  {
    id: 'win-user-path',
    label: 'personal Windows user path',
    // <drive>:\Users\<name> — a single backslash, i.e. a real path, not the
    // doubled-backslash form that appears in source-string literals.
    regex: /[A-Za-z]:\\Users\\[A-Za-z0-9._-]+/g,
  },
  {
    id: 'posix-home-path',
    label: 'personal POSIX home path',
    regex: /(?:\/home\/|\/Users\/)[A-Za-z0-9._-]+/g,
  },
  {
    id: 'maintainer-email',
    label: 'maintainer email address',
    regex: new RegExp(MAINTAINER_EMAIL.replace(/[.]/g, '\\.'), 'gi'),
  },
  {
    id: 'anthropic-key',
    label: 'Anthropic API key',
    regex: /sk-ant-[A-Za-z0-9_-]{16,}/g,
    secret: true,
  },
  {
    id: 'openai-key',
    label: 'OpenAI API key',
    regex: /sk-(?:proj-)?[A-Za-z0-9]{20,}/g,
    secret: true,
  },
  {
    id: 'google-key',
    label: 'Google/Gemini API key',
    regex: /AIza[A-Za-z0-9_-]{20,}/g,
    secret: true,
  },
  {
    id: 'xai-key',
    label: 'xAI/Grok API key',
    regex: /xai-[A-Za-z0-9]{16,}/g,
    secret: true,
  },
  {
    id: 'github-token',
    label: 'GitHub token',
    regex: /gh[pousr]_[A-Za-z0-9]{20,}/g,
    secret: true,
  },
  {
    id: 'assigned-secret',
    label: 'assigned secret/token value',
    // KEY = <16+ chars>. Requires a non-trivial value, so empty .env.example
    // placeholders (`ANTHROPIC_API_KEY=`) and short stubs do not trip it.
    regex: /(?:API[_-]?KEY|SECRET|ACCESS[_-]?TOKEN|PASSWORD)\s*[:=]\s*["']?[A-Za-z0-9_\-]{16,}/gi,
    secret: true,
  },
];

/** Redact a matched secret to a recognizable-but-safe fragment. */
function redact(text) {
  if (text.length <= 8) return '****';
  return `${text.slice(0, 6)}…[redacted ${text.length} chars]`;
}

/**
 * Scan a single text blob against every rule.
 * @returns {{ruleId:string,label:string,line:number,column:number,sample:string}[]}
 */
export function scanText(text) {
  const findings = [];
  // Precompute line start offsets for fast offset→(line,col) mapping.
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') lineStarts.push(i + 1);
  }
  const toLineCol = (offset) => {
    // binary search for the greatest lineStart <= offset
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: offset - lineStarts[lo] + 1 };
  };

  for (const rule of DENY_RULES) {
    rule.regex.lastIndex = 0;
    let m;
    while ((m = rule.regex.exec(text)) !== null) {
      const { line, column } = toLineCol(m.index);
      findings.push({
        ruleId: rule.id,
        label: rule.label,
        line,
        column,
        sample: rule.secret ? redact(m[0]) : m[0],
      });
      if (m.index === rule.regex.lastIndex) rule.regex.lastIndex++; // guard zero-width
    }
  }
  return findings;
}

const FALLBACK_IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  '.foreman',
  'plans',
]);

/** List the repo-relative tracked files, or null if not a git repo / git absent. */
function listGitTracked(root) {
  try {
    const out = execFileSync('git', ['-C', root, 'ls-files', '-z'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      // Swallow git's stderr (e.g. "fatal: not a git repository" for a non-repo
      // fixture dir) — we fall back to a filesystem walk in that case.
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const files = out.split('\0').filter(Boolean);
    return files.length ? files : null;
  } catch {
    return null;
  }
}

/** Recursive filesystem walk, returning repo-relative POSIX paths. */
function walkDir(root) {
  const out = [];
  const stack = [''];
  while (stack.length) {
    const rel = stack.pop();
    const abs = rel ? path.join(root, rel) : root;
    let entries;
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (FALLBACK_IGNORE_DIRS.has(e.name)) continue;
        stack.push(childRel);
      } else if (e.isFile()) {
        out.push(childRel);
      }
    }
  }
  return out;
}

/** Enumerate the files to scan under `root` (tracked tree, or fs walk fallback). */
export function listFiles(root) {
  return listGitTracked(root) ?? walkDir(root);
}

/** True if a buffer looks binary (contains a NUL in its leading bytes). */
function looksBinary(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

/**
 * Scan a whole tree.
 * @param {{root?: string, files?: string[]}} [opts]
 * @returns {{file:string, ruleId:string, label:string, line:number, column:number, sample:string}[]}
 */
export function scanTree(opts = {}) {
  const root = opts.root ?? process.cwd();
  const files = opts.files ?? listFiles(root);
  const findings = [];
  for (const rel of files) {
    const abs = path.isAbsolute(rel) ? rel : path.join(root, rel);
    let buf;
    try {
      buf = fs.readFileSync(abs);
    } catch {
      continue; // deleted/symlink/unreadable — nothing to scan
    }
    if (looksBinary(buf)) continue;
    const hits = scanText(buf.toString('utf8'));
    for (const h of hits) findings.push({ file: rel, ...h });
  }
  return findings;
}

function parseArgs(argv) {
  const args = { check: false, json: false, root: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') args.check = true;
    else if (a === '--json') args.json = true;
    else if (a === '--root') args.root = argv[++i];
    else if (a.startsWith('--root=')) args.root = a.slice('--root='.length);
    else if (a === '-h' || a === '--help') args.help = true;
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(
      'Usage: node tools/scrub.mjs --check [--root DIR] [--json]\n',
    );
    return 0;
  }
  const root = path.resolve(args.root);
  const findings = scanTree({ root });

  if (args.json) {
    process.stdout.write(JSON.stringify({ root, findings }, null, 2) + '\n');
  } else if (findings.length) {
    process.stderr.write(
      `scrub: ${findings.length} publish-safety violation(s) found in ${root}:\n`,
    );
    for (const f of findings) {
      process.stderr.write(
        `  ${f.file}:${f.line}:${f.column}  [${f.ruleId}] ${f.label}: ${f.sample}\n`,
      );
    }
  } else {
    process.stdout.write(`scrub: clean — no publish-safety violations under ${root}\n`);
  }

  // Under --check (the gate invocation) a hit is a hard failure. We also exit
  // non-zero by default so the tool is safe to use in any CI shape.
  return findings.length ? 1 : 0;
}

// Run as CLI only when invoked directly (not when imported by the test).
const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
