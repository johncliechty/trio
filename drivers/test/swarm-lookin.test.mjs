import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHeartbeat,
  verdictFromTrail,
  composeLookinNudge,
  lookinAppendix,
  superviseSeat,
  DEFAULT_CHECKIN_MS,
  DEFAULT_SILENT_KILL_MS,
  DEFAULT_DEAD_IDLE_MS,
} from '../swarm-lookin.mjs';

test('verdictFromTrail: long wall-clock with a fresh on-path heartbeat is KEEP, not dead', () => {
  assert.equal(verdictFromTrail({
    trail: { mtime: 1_000, load_bearing: true, rabbit: false, doing: 'reviewing claim c1' },
    idle: 5_000,
    deadIdleMs: 45 * 60 * 1000,
  }), 'keep');
});

test('verdictFromTrail: silence is looked into, then DEAD if still silent', () => {
  assert.equal(verdictFromTrail({
    trail: null, idle: 1_000, demanded: false,
    checkInMs: 90_000, silentKillMs: 60_000,
  }), 'keep', 'brand-new seat gets a moment to heartbeat');
  assert.equal(verdictFromTrail({
    trail: null, idle: 90_000, demanded: false,
    checkInMs: 90_000, silentKillMs: 60_000,
  }), 'lookin-silent');
  assert.equal(verdictFromTrail({
    trail: null, idle: 150_000, demanded: true,
    checkInMs: 90_000, silentKillMs: 60_000,
  }), 'dead');
});

test('verdictFromTrail: heartbeat admits a rabbit → LOOKIN, not kill-for-time', () => {
  assert.equal(verdictFromTrail({
    trail: { mtime: 1, load_bearing: false, rabbit: false, doing: 'extra charts' },
    idle: 1_000,
    deadIdleMs: 45 * 60 * 1000,
  }), 'lookin');
  assert.equal(verdictFromTrail({
    trail: { mtime: 1, load_bearing: true, rabbit: true, doing: 'side quest' },
    idle: 1_000,
    deadIdleMs: 45 * 60 * 1000,
  }), 'lookin');
});

test('parseHeartbeat and lookin appendix name RC-6 + elegance', () => {
  const hb = parseHeartbeat('{"doing":"x","why":"y","next":"z","load_bearing":false,"rabbit":true}');
  assert.equal(hb.load_bearing, false);
  assert.equal(hb.rabbit, true);
  const app = lookinAppendix({ heartbeatPath: '/tmp/hb.json', northStar: 'NS' });
  assert.match(app, /RC-6/);
  assert.match(app, /Elegance/);
  assert.match(app, /\/tmp\/hb\.json/);
  assert.match(composeLookinNudge({ trail: { doing: 'x' } }), /not a kill/);
});

test('superviseSeat: a silent seat is looked into, then killed (no 45-minute wait)', async () => {
  let now = 0;
  const t0 = Date.now();
  await assert.rejects(
    () => superviseSeat({
      run: () => new Promise((_, reject) => {
        const t = setTimeout(() => reject(new Error('leftover')), 10_000);
        if (typeof t.unref === 'function') t.unref();
      }),
      getTrail: () => null,
      checkInMs: 15,
      silentKillMs: 20,
      deadIdleMs: 50,
      maxRespawn: 0,
      now: () => now,
      sleep: async (ms) => { now += ms; },
    }),
    /DEAD/,
  );
  assert.ok(now < 80, `must die on the look-in+grace window, not a long wall (now=${now})`);
  assert.ok(Date.now() - t0 < 1500);
});

test('superviseSeat: silent death respawns once with a look-in nudge', async () => {
  let now = 0;
  let attempts = [];
  const result = await superviseSeat({
    run: ({ attempt, nudge } = {}) => {
      attempts.push({ attempt, nudged: !!nudge });
      if (attempt === 0) {
        return new Promise((_, reject) => {
          const t = setTimeout(() => reject(new Error('leftover')), 10_000);
          if (typeof t.unref === 'function') t.unref();
        });
      }
      return Promise.resolve({ ok: true, attempt });
    },
    getTrail: () => null,
    checkInMs: 10,
    silentKillMs: 10,
    deadIdleMs: 40,
    maxRespawn: 1,
    now: () => now,
    sleep: async (ms) => { now += ms; },
  });
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].attempt, 0);
  assert.equal(attempts[1].nudged, true);
  assert.deepEqual(result, { ok: true, attempt: 1 });
});

test('superviseSeat: fresh on-path heartbeat KEPT past what used to be a kill wall', async () => {
  let now = 0;
  let resolveRun;
  const p = superviseSeat({
    run: () => new Promise((r) => { resolveRun = r; }),
    getTrail: () => ({ mtime: now, load_bearing: true, doing: 'still on path' }),
    checkInMs: 10,
    silentKillMs: 10,
    deadIdleMs: 40,
    now: () => now,
    sleep: async (ms) => { now += ms; },
    onCheckin: ({ elapsed }) => {
      if (elapsed >= 50 && resolveRun) {
        const r = resolveRun;
        resolveRun = null;
        r({ ok: true });
      }
    },
  });
  const result = await p;
  assert.deepEqual(result, { ok: true });
  assert.ok(now >= 50, 'must have stayed alive past the old 40-unit kill wall');
});

test('superviseSeat: lookin-cut when the seat admits a rabbit hole', async () => {
  await assert.rejects(
    () => superviseSeat({
      run: () => new Promise((_, reject) => {
        const t = setTimeout(() => reject(new Error('leftover')), 10_000);
        if (typeof t.unref === 'function') t.unref();
      }),
      getTrail: () => ({ mtime: 1, load_bearing: false, doing: '50 extra charts' }),
      checkInMs: 10,
      deadIdleMs: 10_000,
      now: () => 100,
      sleep: async () => {},
      onLookin: async () => 'cut',
    }),
    /CUT: off the critical path/,
  );
});

test('superviseSeat: strict mode aborts and joins before respawn, carries nudge, and isolates trail context', async () => {
  let now = 0;
  const events = [];
  const trailContexts = [];
  let resolveSecond = null;
  const result = await superviseSeat({
    strictAbortJoin: true,
    run: ({ attempt, nudge, signal }) => {
      events.push(`start:${attempt}:${nudge ? 'nudged' : 'plain'}`);
      assert.ok(signal instanceof AbortSignal);
      if (attempt === 1) return new Promise((resolve) => { resolveSecond = resolve; });
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          events.push('abort:0');
          queueMicrotask(() => {
            const error = new Error('transport joined');
            error.receipt = { schema: 'trio.seat.v1', ok: false, status: 'aborted' };
            events.push('settled:0');
            reject(error);
          });
        }, { once: true });
      });
    },
    getTrail: (context = {}) => {
      trailContexts.push(context);
      return null;
    },
    checkInMs: 10,
    silentKillMs: 10,
    deadIdleMs: 40,
    maxRespawn: 1,
    now: () => now,
    sleep: async (ms) => { now += ms; },
    onCheckin: () => {
      if (resolveSecond) {
        const resolve = resolveSecond;
        resolveSecond = null;
        resolve({ ok: true, attempt: 1 });
      }
    },
  });
  assert.deepEqual(result, { ok: true, attempt: 1 });
  assert.ok(events.indexOf('abort:0') < events.indexOf('settled:0'));
  assert.ok(events.indexOf('settled:0') < events.indexOf('start:1:nudged'));
  assert.ok(trailContexts.some((context) => context.attempt === 0));
  assert.ok(trailContexts.some((context) => context.attempt === 1));
});

test('superviseSeat: legacy default does not inject a signal or await the abandoned attempt', async () => {
  let now = 0;
  const shapes = [];
  const result = await superviseSeat({
    run: (context) => {
      shapes.push(Object.keys(context).sort());
      if (context.attempt === 0) return new Promise(() => {});
      return Promise.resolve('legacy-ok');
    },
    getTrail: () => null,
    checkInMs: 10,
    silentKillMs: 10,
    maxRespawn: 1,
    now: () => now,
    sleep: async (ms) => { now += ms; },
  });
  assert.equal(result, 'legacy-ok');
  assert.deepEqual(shapes, [['attempt', 'nudge'], ['attempt', 'nudge']]);
});

test('superviseSeat: strict terminal death carries the joined transport receipt', async () => {
  let now = 0;
  const receipt = { schema: 'trio.seat.v1', ok: false, status: 'aborted' };
  await assert.rejects(() => superviseSeat({
    strictAbortJoin: true,
    run: ({ signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('joined abort');
        error.receipt = receipt;
        reject(error);
      }, { once: true });
    }),
    getTrail: () => null,
    checkInMs: 10,
    silentKillMs: 10,
    maxRespawn: 0,
    now: () => now,
    sleep: async (ms) => { now += ms; },
  }), (error) => {
    assert.equal(error.lookin_verdict, 'dead');
    assert.equal(error.receipt, receipt);
    assert.equal(error.cause.message, 'joined abort');
    return true;
  });
});
