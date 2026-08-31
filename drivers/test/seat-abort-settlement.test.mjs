import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { runCloseBoundProcess } from '../subscription-process.mjs';

class FakeChild extends EventEmitter {
  constructor(pid = 321) {
    super();
    this.pid = pid;
    this.exitCode = null;
    this.signalCode = null;
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();
    this.stdin = new PassThrough();
  }

  close(code = 0) {
    this.exitCode = code;
    this.stdout.end();
    this.stderr.end();
    this.emit('close', code);
  }
}

async function microtask() {
  await Promise.resolve();
  await Promise.resolve();
}

test('pre-aborted signal spawns nothing', async () => {
  const controller = new AbortController();
  controller.abort();
  let spawns = 0;
  const result = await runCloseBoundProcess({
    command: 'fake', signal: controller.signal,
    spawnImpl: () => { spawns += 1; },
  });
  assert.equal(spawns, 0);
  assert.equal(result.terminal, 'aborted');
  assert.equal(result.spawned, false);
});

test('listener-install race aborts once and remains pending until close/drain', async () => {
  const controller = new AbortController();
  const child = new FakeChild(41);
  let killCalls = 0;
  const promise = runCloseBoundProcess({
    command: 'fake', signal: controller.signal, platform: 'win32',
    spawnImpl: () => {
      controller.abort();
      return child;
    },
    spawnSyncImpl: () => { killCalls += 1; return { status: 0 }; },
  });
  let settled = false;
  promise.then(() => { settled = true; });
  await microtask();
  assert.equal(settled, false);
  assert.equal(killCalls, 1);
  child.stdout.write('joined-output');
  child.close(1);
  const result = await promise;
  assert.equal(result.terminal, 'aborted');
  assert.equal(result.stdout, 'joined-output');
});

test('ordinary timeout tree-kills once but settles only on close', async () => {
  const child = new FakeChild(42);
  let killCalls = 0;
  const promise = runCloseBoundProcess({
    command: 'fake', timeoutMs: 5, platform: 'win32',
    spawnImpl: () => child,
    spawnSyncImpl: () => { killCalls += 1; return { status: 0 }; },
  });
  let settled = false;
  promise.then(() => { settled = true; });
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(killCalls, 1);
  assert.equal(settled, false);
  child.close(1);
  const result = await promise;
  assert.equal(result.terminal, 'timeout');
  assert.equal(result.kill_status, 'killed');
});

test('Windows uses checked taskkill argv; kill failure still waits for close', async () => {
  const controller = new AbortController();
  const child = new FakeChild(77);
  const calls = [];
  const promise = runCloseBoundProcess({
    command: 'fake', signal: controller.signal, platform: 'win32',
    spawnImpl: () => child,
    spawnSyncImpl: (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 5, stderr: 'denied' };
    },
  });
  controller.abort();
  let settled = false;
  promise.then(() => { settled = true; });
  await microtask();
  assert.equal(settled, false);
  assert.deepEqual(calls[0].args, ['/pid', '77', '/t', '/f']);
  assert.equal(calls[0].command, 'taskkill');
  child.close(1);
  const result = await promise;
  assert.equal(result.kill_status, 'kill_failed');
  assert.equal(result.terminal, 'aborted');
});

test('POSIX spawns an isolated group and kills the negative pid', async () => {
  const controller = new AbortController();
  const child = new FakeChild(88);
  let spawnOptions;
  const kills = [];
  const promise = runCloseBoundProcess({
    command: 'fake', signal: controller.signal, platform: 'linux',
    spawnImpl: (_command, _args, options) => {
      spawnOptions = options;
      return child;
    },
    killImpl: (...args) => kills.push(args),
  });
  controller.abort();
  assert.equal(spawnOptions.detached, true);
  assert.deepEqual(kills, [[-88, 'SIGKILL']]);
  child.close(1);
  assert.equal((await promise).terminal, 'aborted');
});

test('spawn error without a process settles immediately; pid-bearing error waits for close', async () => {
  const noProcess = new FakeChild(undefined);
  noProcess.pid = undefined;
  const immediate = runCloseBoundProcess({ command: 'fake', spawnImpl: () => noProcess });
  noProcess.emit('error', new Error('ENOENT'));
  const first = await immediate;
  assert.equal(first.terminal, 'spawn_error');
  assert.equal(first.spawned, false);

  const child = new FakeChild(99);
  const joined = runCloseBoundProcess({ command: 'fake', spawnImpl: () => child });
  let settled = false;
  joined.then(() => { settled = true; });
  child.emit('error', new Error('late process error'));
  await microtask();
  assert.equal(settled, false);
  child.close(1);
  const second = await joined;
  assert.equal(second.terminal, 'spawn_error');
  assert.match(second.error, /late process error/);
});

test('late data/error/close events cannot double-settle or mutate the result', async () => {
  const child = new FakeChild(101);
  const promise = runCloseBoundProcess({ command: 'fake', spawnImpl: () => child });
  child.stdout.write('first');
  child.close(0);
  const result = await promise;
  child.stdout.emit('data', Buffer.from('late'));
  child.emit('error', new Error('late'));
  child.emit('close', 9);
  await microtask();
  assert.equal(result.stdout, 'first');
  assert.equal(result.code, 0);
  assert.equal(result.terminal, 'closed');
});
