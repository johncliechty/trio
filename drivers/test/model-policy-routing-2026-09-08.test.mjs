/**
 * Hermetic configured-family routing tests. All callable transports are injected;
 * fixture preferences live in owned temporary profiles. Empty PATH and an
 * explicit disabled LIVE flag also prevent an accidental native fallback.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runAgent, loadModelFamilies } from '../index.mjs';

const POLICY = { mode: 'latest_supported', effort: 'highest_supported' };
const ACTUAL_MODELS = {
  claude: 'claude-synthetic-served',
  chatgpt: 'gpt-synthetic-served',
  grok: 'grok-synthetic-served',
};

function preferenceObject(coding = 'claude', review = 'chatgpt', terminal = 'grok') {
  return {
    coding_family: coding, review_family: review, default_cli: terminal,
    settings_revision: 23, model_policy: { ...POLICY },
  };
}

function fixture(t, preferences = preferenceObject()) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'trio-policy-routing-test-'));
  const env = {
    USERPROFILE: directory, HOME: directory,
    ANCHOR_DATA_DIR: path.join(directory, 'anchor-data'),
    PATH: '', CRUCIBLE_AGENT_LIVE: '',
  };
  const write = (filename, value) => {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, typeof value === 'string' ? value : JSON.stringify(value), 'utf8');
  };
  const mirror = path.join(directory, '.anchor', 'model_prefs.json');
  const primary = path.join(env.ANCHOR_DATA_DIR, 'settings.json');
  write(mirror, preferences);
  t.after(() => {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('trio-policy-routing-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return { env, write, primary, mirror };
}

function success(family) {
  return {
    text: 'ok',
    rec: {
      ok: true, status: 'ok', requested_model: `${family}-synthetic-requested`,
      model_served: ACTUAL_MODELS[family], model_family: family,
      family_attested: true, model_attested: true,
    },
  };
}

function unavailable(family, replaySafe = true, { partial = false } = {}) {
  return {
    text: partial ? 'Synthetic partial work was already submitted.' : '',
    rec: {
      ok: false, status: 'usage_limit', requested_model: `${family}-synthetic-requested`,
      model_served: partial ? ACTUAL_MODELS[family] : null, model_family: family,
      family_attested: partial, model_attested: partial,
      ...(replaySafe === undefined ? {} : { replay_safe: replaySafe }),
    },
  };
}

function request(env, overrides = {}) {
  return {
    prompt: 'Return the literal text ok. This is an injected routing fixture.',
    label: 'hermetic-model-policy-routing', role: 'execute', env,
    ...overrides,
  };
}

async function expectFailure(promise, status, count) {
  let caught;
  await assert.rejects(promise, error => {
    caught = error;
    assert.equal(error.receipt?.status, status);
    assert.ok(Array.isArray(error.receipt?.attempts));
    assert.equal(error.receipt.attempts.length, count);
    assert.deepEqual(error.receipt.attempts.map(attempt => attempt.status), Array(count).fill('seat_unavailable'));
    for (const attempt of error.receipt.attempts) {
      assert.ok(Array.isArray(attempt.transport_attempts) && attempt.transport_attempts.length > 0);
      for (const transport of attempt.transport_attempts) {
        assert.equal(transport.status, 'seat_unavailable');
        assert.equal(transport.provider_status, 'usage_limit');
      }
    }
    return true;
  });
  return caught;
}

test('complete primary preferences beat a stale mirror and stale driver environment', t => {
  const { env, write, primary } = fixture(t, preferenceObject('claude', 'claude', 'claude'));
  write(primary, preferenceObject('chatgpt', 'grok', 'chatgpt'));
  env.TRIO_DRIVER_CODING = 'claude';
  env.TRIO_DRIVER_REVIEW = 'claude';
  const actual = loadModelFamilies(env);
  assert.equal(actual.coding, 'chatgpt');
  assert.equal(actual.review, 'grok');
  assert.equal(actual.terminal, 'chatgpt');
  assert.equal(actual.cross_model, true);
  assert.equal(actual.source, 'primary');
  assert.equal(actual.settings_revision, 23);
  assert.deepEqual(actual.model_policy, POLICY);
});

test('Claude usage limit safely fails over to configured ChatGPT only after durable journaling', async t => {
  const { env } = fixture(t, preferenceObject('claude', 'chatgpt', 'chatgpt'));
  const order = [];
  const events = [];
  const receipts = [];
  await runAgent(request(env, {
    driver: 'claude',
    runClaude: async () => { order.push('claude'); return unavailable('claude'); },
    runCodexCli: async () => {
      assert.equal(order.at(-1), 'journal-durable', 'Failover must wait for the durable journal callback.');
      order.push('chatgpt');
      return success('chatgpt');
    },
    onRoutingEvent: async event => {
      events.push(event);
      order.push('journal-started');
      await Promise.resolve();
      order.push('journal-durable');
    },
    onReceipt: async receipt => { receipts.push(receipt); },
  }));
  assert.deepEqual(order.filter(item => item === 'claude' || item === 'chatgpt'), ['claude', 'chatgpt']);
  assert.ok(events.length > 0);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].status, 'success_after_failover');
  assert.equal(receipts[0].served.family, 'chatgpt');
});

test('ChatGPT quota fails over to configured Grok and never calls unselected Claude', async t => {
  const { env } = fixture(t, preferenceObject('chatgpt', 'grok', 'grok'));
  const calls = [];
  const receipts = [];
  await runAgent(request(env, {
    driver: 'chatgpt-cli',
    runClaude: async () => { calls.push('claude'); assert.fail('Claude is not a configured family.'); },
    runCodexCli: async () => { calls.push('chatgpt'); return unavailable('chatgpt'); },
    runGrokCli: async () => { calls.push('grok'); return success('grok'); },
    onRoutingEvent: async () => {},
    onReceipt: async receipt => { receipts.push(receipt); },
  }));
  assert.deepEqual(calls, ['chatgpt', 'grok']);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].status, 'success_after_failover');
  assert.equal(receipts[0].served.family, 'grok');
});

test('an ambiguous partial turn is not replayed on another family', async t => {
  const { env } = fixture(t, preferenceObject('chatgpt', 'grok', 'claude'));
  const calls = [];
  const receipts = [];
  await expectFailure(runAgent(request(env, {
    driver: 'chatgpt-cli',
    runCodexCli: async () => { calls.push('chatgpt'); return unavailable('chatgpt', false, { partial: true }); },
    runGrokCli: async () => { calls.push('grok'); return success('grok'); },
    runClaude: async () => { calls.push('claude'); return success('claude'); },
    onRoutingEvent: async () => {},
    onReceipt: async receipt => { receipts.push(receipt); },
  })), 'seat_unavailable', 1);
  assert.deepEqual(calls, ['chatgpt']);
  assert.equal(receipts.length, 0);
});

test('verification fails closed even when the unavailable provider marks replay safe', async t => {
  const { env } = fixture(t, preferenceObject('chatgpt', 'grok', 'claude'));
  const calls = [];
  await expectFailure(runAgent(request(env, {
    driver: 'grok-cli', role: 'review',
    runGrokCli: async () => { calls.push('grok'); return unavailable('grok', true); },
    runCodexCli: async () => { calls.push('chatgpt'); return success('chatgpt'); },
    runClaude: async () => { calls.push('claude'); return success('claude'); },
    onRoutingEvent: async () => {},
  })), 'verification_fail_closed', 1);
  assert.deepEqual(calls, ['grok']);
});

test('an exhausted configured ladder is bounded to one attempt per family', async t => {
  const { env } = fixture(t, preferenceObject('claude', 'chatgpt', 'grok'));
  const calls = [];
  await expectFailure(runAgent(request(env, {
    driver: 'claude',
    runClaude: async () => { calls.push('claude'); return unavailable('claude'); },
    runCodexCli: async () => { calls.push('chatgpt'); return unavailable('chatgpt'); },
    runGrokCli: async () => { calls.push('grok'); return unavailable('grok'); },
    onRoutingEvent: async () => {},
  })), 'seat_unavailable', 3);
  assert.deepEqual(calls, ['claude', 'chatgpt', 'grok']);
  assert.equal(new Set(calls).size, calls.length);
});

test('a failed durable journal callback forbids launching the fallback', async t => {
  const { env } = fixture(t, preferenceObject('claude', 'chatgpt', 'chatgpt'));
  const calls = [];
  await assert.rejects(runAgent(request(env, {
    driver: 'claude',
    runClaude: async () => { calls.push('claude'); return unavailable('claude'); },
    runCodexCli: async () => { calls.push('chatgpt'); return success('chatgpt'); },
    onRoutingEvent: async () => { throw new Error('Synthetic durable journal failure.'); },
  })), /Synthetic durable journal failure/);
  assert.deepEqual(calls, ['claude']);
});

test('invalid primary blocks a valid mirror before any injected transport launches', async t => {
  const { env, write, primary } = fixture(t, preferenceObject('claude', 'chatgpt', 'grok'));
  write(primary, '{');
  assert.throws(() => loadModelFamilies(env), error => error.code === 'settings_invalid');
  const calls = [];
  await assert.rejects(runAgent(request(env, {
    driver: 'claude',
    runClaude: async () => { calls.push('claude'); return success('claude'); },
    runCodexCli: async () => { calls.push('chatgpt'); return success('chatgpt'); },
    runGrokCli: async () => { calls.push('grok'); return success('grok'); },
    onRoutingEvent: async () => {},
  })), error => error.code === 'settings_invalid');
  assert.deepEqual(calls, []);
});

test('one injected transport does not implicitly enable live configured fallbacks', async t => {
  const { env } = fixture(t, preferenceObject('claude', 'chatgpt', 'grok'));
  const calls = [];
  await expectFailure(runAgent(request(env, {
    driver: 'claude',
    runClaude: async () => { calls.push('claude'); return unavailable('claude'); },
    onRoutingEvent: async () => {},
  })), 'seat_unavailable', 1);
  assert.deepEqual(calls, ['claude']);
});

test('an uninjected configured family is skipped in favor of a later injected family', async t => {
  const { env } = fixture(t, preferenceObject('claude', 'chatgpt', 'grok'));
  const calls = [];
  const receipts = [];
  await runAgent(request(env, {
    driver: 'claude',
    runClaude: async () => { calls.push('claude'); return unavailable('claude'); },
    runGrokCli: async () => { calls.push('grok'); return success('grok'); },
    onRoutingEvent: async () => {},
    onReceipt: async receipt => { receipts.push(receipt); },
  }));
  assert.deepEqual(calls, ['claude', 'grok']);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].served.family, 'grok');
  assert.equal(receipts[0].status, 'success_after_failover');
});

for (const [label, replaySafe] of [['numeric truthy', 1], ['string truthy', 'true'], ['absent', undefined]]) {
  test(`${label} replay_safe is not permission to replay a failed turn`, async t => {
    const { env } = fixture(t, preferenceObject('claude', 'chatgpt', 'chatgpt'));
    const calls = [];
    await expectFailure(runAgent(request(env, {
      driver: 'claude',
      runClaude: async () => {
        calls.push('claude');
        const reply = unavailable('claude', replaySafe);
        if (replaySafe === undefined) delete reply.rec.replay_safe;
        return reply;
      },
      runCodexCli: async () => { calls.push('chatgpt'); return success('chatgpt'); },
      onRoutingEvent: async () => {},
    })), 'seat_unavailable', 1);
    assert.deepEqual(calls, ['claude']);
  });
}
