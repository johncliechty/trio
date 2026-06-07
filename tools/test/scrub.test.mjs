// Tests for the Wave-2 publish-hygiene scrubber (tools/scrub.mjs).
//
// IMPORTANT: every planted offender below is assembled from string fragments so
// THIS source file contains no literal personal path / email / key. That keeps
// the file clean under the very scan it exercises (the repo-wide `scrub --check`
// scans this file too — no exclusions).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scanText, scanTree } from '../scrub.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRUB = path.join(HERE, '..', 'scrub.mjs');

// --- offenders, built from fragments (never literal in this file) ---
const PLANTED_PATH = ['C:', '\\Users\\', 'testuser', '\\creds.txt'].join(''); // → C:\Users\<name>\creds.txt
const PLANTED_EMAIL = ['john.liechty', 'gmail.com'].join('@');
const FAKE_KEY = ['sk', 'ant'].join('-') + '-' + 'A'.repeat(40); // sk-ant-AAAA…

function mkTmp(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `trio-scrub-${tag}-`));
}

test('scanText flags a personal Windows path, the maintainer email, and a key', () => {
  const text = `notes\nleaked path: ${PLANTED_PATH}\ncontact ${PLANTED_EMAIL}\nkey=${FAKE_KEY}\n`;
  const ids = new Set(scanText(text).map((f) => f.ruleId));
  assert.ok(ids.has('win-user-path'), 'detects the Windows user path');
  assert.ok(ids.has('maintainer-email'), 'detects the maintainer email');
  assert.ok(ids.has('anthropic-key'), 'detects the Anthropic key shape');
});

test('scanText is clean on benign content, env placeholders, and a git SHA', () => {
  const benign = [
    '# trio',
    'Install with /onboard. Default driver: claude.',
    'ANTHROPIC_API_KEY=', // empty .env.example placeholder — must NOT trip
    'GEMINI_API_KEY=your-key-here', // short stub — must NOT trip
    'last_commit: 83b0f3bbc68aa4321675a976201acf304d86471d', // 40-hex SHA — must NOT trip
    'See C:\\dev\\trio and ~/.claude/skills for layout.', // dev path / tilde — not personal
  ].join('\n');
  assert.deepEqual(scanText(benign), []);
});

test('scanText redacts secret matches (never echoes the full key)', () => {
  const finding = scanText(`token=${FAKE_KEY}`).find((f) => f.ruleId === 'anthropic-key');
  assert.ok(finding, 'key detected');
  assert.ok(!finding.sample.includes('A'.repeat(40)), 'full key is not echoed');
});

test('scanTree walks a non-git fixture dir and reports file-scoped findings', () => {
  const dir = mkTmp('walk');
  try {
    fs.writeFileSync(path.join(dir, 'leaky.md'), `path ${PLANTED_PATH}\n`);
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'ok.md'), 'all good here\n');
    const findings = scanTree({ root: dir });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].file, 'leaky.md');
    assert.equal(findings[0].ruleId, 'win-user-path');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI: --check on a planted fixture exits non-zero and names the offenders', () => {
  const dir = mkTmp('dirty');
  try {
    fs.writeFileSync(
      path.join(dir, 'leaky.md'),
      `# planted\npath: ${PLANTED_PATH}\nmail: ${PLANTED_EMAIL}\nkey: ${FAKE_KEY}\n`,
    );
    const r = spawnSync(process.execPath, [SCRUB, '--check', '--root', dir], {
      encoding: 'utf8',
    });
    assert.notEqual(r.status, 0, 'non-zero exit on offenders');
    assert.match(r.stderr, /win-user-path/, 'names the personal path rule');
    assert.match(r.stderr, /anthropic-key/, 'names the key rule');
    assert.match(r.stderr, /maintainer-email/, 'names the email rule');
    assert.ok(!r.stderr.includes('A'.repeat(40)), 'does not echo the full key');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI: --check on a clean fixture exits 0', () => {
  const dir = mkTmp('clean');
  try {
    fs.writeFileSync(path.join(dir, 'README.md'), '# clean\nNothing to see.\n');
    fs.writeFileSync(path.join(dir, '.env.example'), 'ANTHROPIC_API_KEY=\nGEMINI_API_KEY=\n');
    const r = spawnSync(process.execPath, [SCRUB, '--check', '--root', dir], {
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, 'zero exit on a clean tree');
    assert.match(r.stdout, /clean/, 'reports clean');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
