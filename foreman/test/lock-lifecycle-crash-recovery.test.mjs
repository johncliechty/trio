import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BuildLock } from '../bin/resume-guard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 2026-08-25 (journal 0105): the engine (bin/resume-guard.mjs) resolves the lock at
// bin/../.. = the TRIO root; this test resolved test/../../.. = C:\dev — one level too
// high — so its planted lock was invisible to verifyResumeGate and every abort assertion
// failed. The test now derives the path the SAME way the engine does.
const REPO_ROOT = path.resolve(__dirname, '../..');
const LOCK_FILE = path.join(REPO_ROOT, 'build-lock.json');

test('lock-lifecycle/crash-recovery test (POSITIVE)', async (t) => {
  // Backup existing lockfile
  let backup = null;
  if (fs.existsSync(LOCK_FILE)) {
    backup = fs.readFileSync(LOCK_FILE, 'utf8');
  }

  try {
    await t.test('live-committing => abort', () => {
      fs.writeFileSync(LOCK_FILE, JSON.stringify({
        holder: 'test-runner',
        committing_state: true,
        resume_interlock: true,
        liveness_heartbeat: new Date().toISOString(),
        pid: process.pid
      }));
      
      let aborted = false;
      const originalExit = process.exit;
      const originalError = console.error;
      process.exit = (code) => { if (code === 1) aborted = true; };
      console.error = () => {};
      
      BuildLock.verifyResumeGate();
      
      process.exit = originalExit;
      console.error = originalError;
      
      assert.strictEqual(aborted, true, 'Should abort on live-committing hold');
    });

    await t.test('stale-committing => abort', () => {
      const staleDate = new Date(Date.now() - 3600000).toISOString();
      fs.writeFileSync(LOCK_FILE, JSON.stringify({
        holder: 'test-runner-stale',
        committing_state: true,
        resume_interlock: true,
        liveness_heartbeat: staleDate,
        pid: 999999
      }));
      
      let aborted = false;
      const originalExit = process.exit;
      const originalError = console.error;
      process.exit = (code) => { if (code === 1) aborted = true; };
      console.error = () => {};
      
      BuildLock.verifyResumeGate();
      
      process.exit = originalExit;
      console.error = originalError;
      
      assert.strictEqual(aborted, true, 'Should abort on stale-committing hold');
    });

    await t.test('cleanly-released => proceed', () => {
      fs.writeFileSync(LOCK_FILE, JSON.stringify({
        holder: null,
        committing_state: false,
        resume_interlock: false,
        liveness_heartbeat: null,
        pid: null
      }));
      
      let aborted = false;
      const originalExit = process.exit;
      const originalError = console.error;
      process.exit = (code) => { if (code === 1) aborted = true; };
      console.error = () => {};
      
      BuildLock.verifyResumeGate();
      
      process.exit = originalExit;
      console.error = originalError;
      
      assert.strictEqual(aborted, false, 'Should proceed on cleanly-released lock');
    });

    await t.test('guard touches zero researchPrime/ files', () => {
      const content = fs.readFileSync(path.join(__dirname, '../bin/resume-guard.mjs'), 'utf8');
      assert.strictEqual(content.includes('researchPrime'), false, 'resume-guard must touch NO researchPrime modules');
    });
    
  } finally {
    if (backup !== null) {
      fs.writeFileSync(LOCK_FILE, backup);
    } else if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  }
});
