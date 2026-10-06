// drivers/test/grok-cli-resume-guard.test.mjs — (2026-10-06) a Grok turn cancelled by an unanswerable
// tool ask is RESUMED in the same session, and a read-only (verification) Grok seat's writes are put
// back and its review is not trusted. Field evidence: both Grok reviewers of Anchor code job
// 20261006-124717-187472 chained a shell command after minutes of work -> turn cancelled, no review;
// a plan-mode grok with its terminal removed still wrote a file through a deferred tool.
// Hermetic: injected processRunner; the guard runs against a throwaway git repo in the OS temp dir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  defaultRunGrokCli, GROK_RESUME_AFTER_REFUSAL, DEFAULT_GROK_CLI_PERMISSION_RESUMES,
  worktreeSnapshot, restoreWorktree,
} from '../grok-cli.mjs';

const LIVE = { CRUCIBLE_AGENT_LIVE: '1' };
// Hermetic model policy: the real resolver needs the grok CLI on PATH.
const POLICY = () => ({ family: 'grok', model: 'grok-4.7', effort: 'high' });
const usage = { 'grok-4.7-build': { inputTokens: 1, outputTokens: 1 } };
const cancelled = (sid) => JSON.stringify({ text: "I'll run that command.", stopReason: 'cancelled', sessionId: sid, modelUsage: usage });
const done = (sid, text) => JSON.stringify({ text, stopReason: 'end_turn', sessionId: sid, num_turns: 2, modelUsage: usage });

function runner(replies, onCall = () => {}) {
  const calls = [];
  const processRunner = async ({ args }) => {
    calls.push(args);
    onCall(calls.length, args);
    const stdout = replies[Math.min(calls.length - 1, replies.length - 1)];
    return { stdout, stderr: '', code: 0, terminal: 'closed', spawned: true, kill_status: null };
  };
  return { calls, processRunner };
}

function tmpRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grok-guard-'));
  const g = (...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' });
  g('init', '-q');
  g('config', 'user.email', 't@t'); g('config', 'user.name', 't'); g('config', 'core.autocrlf', 'false');
  fs.writeFileSync(path.join(dir, 'clean.txt'), 'clean\n');
  fs.writeFileSync(path.join(dir, 'dirty.txt'), 'base\n');
  g('add', '-A'); g('commit', '-qm', 'base');
  fs.writeFileSync(path.join(dir, 'dirty.txt'), 'coder work in progress\n');   // the execute agent's uncommitted work
  fs.writeFileSync(path.join(dir, 'new-by-coder.txt'), 'coder new file\n');
  return dir;
}

test('a cancelled grok turn is resumed in the same session and its answer is the result', async () => {
  const { calls, processRunner } = runner([cancelled('S1'), done('S1', '{"ok":true}')]);
  const out = await defaultRunGrokCli('review this', 'chat', { env: LIVE, processRunner, platform: 'win32', policyResolver: POLICY });
  assert.equal(calls.length, 2);
  const a = calls[1];
  assert.equal(a[a.indexOf('--resume') + 1], 'S1');
  assert.equal(a[a.indexOf('-p') + 1], GROK_RESUME_AFTER_REFUSAL);
  assert.ok(a.includes('--max-turns') && a.includes('--output-format'), 'the resume keeps the call shape');
  assert.equal(out.rec.ok, true);
  assert.equal(out.rec.status, 'success');
  assert.equal(out.rec.permission_resumes, 1);
  assert.equal(out.text, '{"ok":true}');
});

test('resumes are capped (default, env-tunable, 0 = off) and a turn that stays cancelled fails honestly', async () => {
  const r = runner([cancelled('S2')]);
  const out = await defaultRunGrokCli('x', 'chat', { env: LIVE, processRunner: r.processRunner, platform: 'win32', policyResolver: POLICY });
  assert.equal(r.calls.length, 1 + DEFAULT_GROK_CLI_PERMISSION_RESUMES);
  assert.equal(out.rec.ok, false);
  assert.equal(out.rec.turn_cancelled, true);
  const off = runner([cancelled('S3')]);
  await defaultRunGrokCli('x', 'chat', { env: { ...LIVE, GROK_CLI_PERMISSION_RESUMES: '0' }, processRunner: off.processRunner, platform: 'win32', policyResolver: POLICY });
  assert.equal(off.calls.length, 1);
});

test('a normal turn is never resumed', async () => {
  const r = runner([done('S4', 'hi')]);
  const out = await defaultRunGrokCli('x', 'chat', { env: LIVE, processRunner: r.processRunner, platform: 'win32', policyResolver: POLICY });
  assert.equal(r.calls.length, 1);
  assert.equal(out.rec.permission_resumes, 0);
});

test('a read-only grok reviewer that writes: every change is put back and the review is not trusted', async () => {
  const dir = tmpRepo();
  const r = runner([done('S5', '{"findings":[]}')], () => {
    fs.writeFileSync(path.join(dir, 'clean.txt'), 'reviewer edit\n');
    fs.writeFileSync(path.join(dir, 'dirty.txt'), 'reviewer clobbered\n');
    fs.writeFileSync(path.join(dir, 'reviewer-made.txt'), 'x\n');
    fs.rmSync(path.join(dir, 'new-by-coder.txt'));
    fs.mkdirSync(path.join(dir, '.foreman'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.foreman', 'heartbeat.json'), '{}');   // Foreman's own bookkeeping
  });
  const out = await defaultRunGrokCli('review', 'review:w1#0', { env: LIVE, processRunner: r.processRunner, platform: 'win32', policyResolver: POLICY, target: dir });
  assert.equal(fs.readFileSync(path.join(dir, 'clean.txt'), 'utf8'), 'clean\n');
  assert.equal(fs.readFileSync(path.join(dir, 'dirty.txt'), 'utf8'), 'coder work in progress\n');
  assert.equal(fs.readFileSync(path.join(dir, 'new-by-coder.txt'), 'utf8'), 'coder new file\n');
  assert.ok(!fs.existsSync(path.join(dir, 'reviewer-made.txt')));
  assert.ok(fs.existsSync(path.join(dir, '.foreman', 'heartbeat.json')), 'Foreman bookkeeping is not a reviewer write');
  assert.equal(out.rec.ok, false);
  assert.equal(out.rec.status, 'wrote_files');
  assert.deepEqual([...out.rec.reviewer_wrote].sort(), ['clean.txt', 'dirty.txt', 'new-by-coder.txt', 'reviewer-made.txt']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a reviewer that only reads leaves the coder\'s uncommitted work alone and stays trusted', async () => {
  const dir = tmpRepo();
  const r = runner([done('S6', '{"findings":[]}')]);
  const out = await defaultRunGrokCli('review', 'review:w1#1', { env: LIVE, processRunner: r.processRunner, platform: 'win32', policyResolver: POLICY, target: dir });
  assert.equal(out.rec.ok, true);
  assert.equal(out.rec.reviewer_wrote, undefined);
  assert.equal(fs.readFileSync(path.join(dir, 'dirty.txt'), 'utf8'), 'coder work in progress\n');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a writing seat (execute) is not guarded; outside a git tree the guard steps aside', async () => {
  const dir = tmpRepo();
  const r = runner([done('S7', 'done')], () => fs.writeFileSync(path.join(dir, 'clean.txt'), 'execute edit\n'));
  const out = await defaultRunGrokCli('build', 'execute:w1', { env: LIVE, processRunner: r.processRunner, platform: 'win32', policyResolver: POLICY, target: dir });
  assert.equal(out.rec.ok, true);
  assert.equal(fs.readFileSync(path.join(dir, 'clean.txt'), 'utf8'), 'execute edit\n');
  fs.rmSync(dir, { recursive: true, force: true });
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'grok-plain-'));
  assert.equal(worktreeSnapshot(plain), null);
  assert.deepEqual(restoreWorktree(plain, new Map(), new Map()), []);
  fs.rmSync(plain, { recursive: true, force: true });
});
