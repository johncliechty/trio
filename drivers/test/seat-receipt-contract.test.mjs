import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ReceiptCallbackError, registerDriver, runAgent } from '../index.mjs';
import { PHYSICAL_RECEIPT_HOOK } from '../seat-contract.mjs';

const SCHEMA = {
  type: 'object',
  required: ['passed'],
  properties: { passed: { type: 'boolean' } },
};

function acceptedRec(family, model, requested = model) {
  return {
    ok: true,
    status: 'success',
    requested_model: requested ?? null,
    model_family: family,
    family_attested: family != null,
    model_served: model ?? null,
    model_attested: model != null,
    degraded: model == null,
  };
}

function failedRec(status = 'usage_limit') {
  return {
    ok: false, status, error: status, requested_model: 'gpt-primary',
    model_family: null, family_attested: false,
    model_served: null, model_attested: false, degraded: true,
  };
}

function codexSequence(texts, recs = null) {
  let index = 0;
  return async () => {
    const i = index++;
    return {
      text: texts[i] ?? texts.at(-1),
      rec: recs?.[i] ?? acceptedRec('chatgpt', 'gpt-primary'),
    };
  };
}

function claudeSequence(texts, recs = null) {
  let index = 0;
  return async (_prompt, _label, callOpts) => {
    const i = index++;
    const model = callOpts.model ?? 'claude-opus-5';
    return {
      text: texts[i] ?? texts.at(-1),
      rec: recs?.[i] ?? acceptedRec('claude', model),
    };
  };
}

function assertClosedReceiptShape(receipt) {
  assert.deepEqual(Object.keys(receipt), [
    'schema', 'ok', 'status', 'label', 'role', 'verification', 'structured',
    'requested', 'served', 'attempts', 'failover', 'error',
  ]);
  assert.deepEqual(Object.keys(receipt.requested), ['driver', 'family', 'model']);
  assert.deepEqual(Object.keys(receipt.failover), ['allowed', 'used', 'blocked_reason']);
  for (const dispatcher of receipt.attempts) {
    assert.deepEqual(Object.keys(dispatcher), [
      'ordinal', 'kind', 'requested', 'ok', 'status', 'served',
      'transport_attempts', 'error',
    ]);
    for (const transport of dispatcher.transport_attempts) {
      assert.deepEqual(Object.keys(transport), [
        'ordinal', 'kind', 'label', 'ok', 'status', 'provider_status', 'served', 'error',
      ]);
    }
    assert.ok(dispatcher.transport_attempts.length >= 1);
    assert.ok(dispatcher.transport_attempts.length <= 2);
    assert.equal(dispatcher.transport_attempts[0].ordinal, 1);
    assert.equal(dispatcher.transport_attempts[0].kind, 'initial');
    if (dispatcher.transport_attempts.length === 2) {
      assert.equal(dispatcher.transport_attempts[0].status, 'schema_rejected');
      assert.equal(dispatcher.transport_attempts[1].ordinal, 2);
      assert.equal(dispatcher.transport_attempts[1].kind, 'schema_reprompt');
    }
  }
}

test('schema rejection then reprompt success nests two transports and one final callback', async () => {
  const receipts = [];
  const out = await runAgent({
    driver: 'chatgpt-cli', role: 'synthesizer', label: 'coding:reprompt',
    model: 'gpt-primary', prompt: 'work', schema: SCHEMA,
    runCodexCli: codexSequence(['not json', '{"passed":true}']),
    onReceipt: async (receipt) => { receipts.push(receipt); },
  });
  assert.deepEqual(out, { passed: true });
  assert.equal(receipts.length, 1);
  const receipt = receipts[0];
  assertClosedReceiptShape(receipt);
  assert.equal(receipt.status, 'success');
  assert.equal(receipt.attempts.length, 1);
  assert.equal(receipt.attempts[0].status, 'success_after_schema_reprompt');
  assert.deepEqual(
    receipt.attempts[0].transport_attempts.map((attempt) => attempt.status),
    ['schema_rejected', 'accepted'],
  );
});

test('primary and fallback reprompts preserve all four physical attempts', async () => {
  const receipts = [];
  const out = await runAgent({
    driver: 'chatgpt-cli', role: 'synthesizer', label: 'coding:four',
    model: 'gpt-primary', prompt: 'work', schema: SCHEMA,
    runCodexCli: codexSequence(['bad-1', 'bad-2']),
    runClaude: claudeSequence(['bad-3', '{"passed":true}']),
    onReceipt: (receipt) => receipts.push(receipt),
  });
  assert.deepEqual(out, { passed: true });
  assert.equal(receipts.length, 1);
  const receipt = receipts[0];
  assert.equal(receipt.status, 'success_after_failover');
  assert.equal(receipt.failover.used, true);
  assert.equal(receipt.attempts.length, 2);
  assert.deepEqual(receipt.attempts.map((attempt) =>
    attempt.transport_attempts.map((transport) => transport.status)), [
    ['schema_rejected', 'schema_rejected'],
    ['schema_rejected', 'accepted'],
  ]);
});

test('fallback reprompt exhaustion attaches four transports and calls no callback', async () => {
  let callbackCount = 0;
  await assert.rejects(() => runAgent({
    driver: 'chatgpt-cli', role: 'synthesizer', label: 'coding:four-fail',
    model: 'gpt-primary', prompt: 'work', schema: SCHEMA,
    runCodexCli: codexSequence(['bad-1', 'bad-2']),
    runClaude: claudeSequence(['bad-3', 'bad-4']),
    onReceipt: () => { callbackCount += 1; },
  }), (error) => {
    assert.equal(error.receipt.status, 'seat_unavailable');
    assert.equal(error.receipt.failover.used, true);
    assert.deepEqual(error.receipt.attempts.map((attempt) =>
      attempt.transport_attempts.length), [2, 2]);
    return true;
  });
  assert.equal(callbackCount, 0);
});

test('verification schema exhaustion fails closed without fallback; an unattested-MODEL verifier is accepted with the stamp (John 2026-09-05)', async () => {
  let claudeCalls = 0;
  await assert.rejects(() => runAgent({
    driver: 'chatgpt-cli', role: 'judge', label: 'judge:schema',
    model: 'gpt-primary', prompt: 'judge', schema: SCHEMA,
    runCodexCli: codexSequence(['bad-1', 'bad-2']),
    runClaude: async () => { claudeCalls += 1; },
  }), (error) => {
    assert.equal(error.receipt.status, 'verification_fail_closed');
    assert.equal(error.receipt.attempts.length, 1);
    assert.equal(error.receipt.failover.blocked_reason, 'verification_seat');
    return true;
  });

  const receipts = [];
  const out = await runAgent({
    driver: 'chatgpt-cli', role: 'reviewer', label: 'reviewer:unattested',
    model: 'gpt-primary', prompt: 'review', schema: SCHEMA,
    runCodexCli: codexSequence(['{"passed":true}'], [acceptedRec('chatgpt', null, 'gpt-primary')]),
    runClaude: async () => { claudeCalls += 1; },
    onReceipt: (r) => receipts.push(r),
  });
  assert.deepEqual(out, { passed: true });
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].status, 'success');
  assert.equal(receipts[0].verification, true);
  assert.equal(receipts[0].served.family, 'chatgpt');
  assert.equal(receipts[0].served.family_attested, true);
  assert.equal(receipts[0].served.model_attested, false);
  assert.equal(receipts[0].failover.allowed, false);
  assert.equal(claudeCalls, 0);
});

test('primary and in-fallback aborts preserve attempt/used truth and start no later call', async () => {
  let claudeCalls = 0;
  await assert.rejects(() => runAgent({
    driver: 'chatgpt-cli', role: 'synthesizer', label: 'coding:abort-primary',
    prompt: 'work', runCodexCli: codexSequence([''], [failedRec('aborted')]),
    runClaude: async () => { claudeCalls += 1; },
  }), (error) => {
    assert.equal(error.receipt.status, 'aborted');
    assert.equal(error.receipt.attempts.length, 1);
    assert.equal(error.receipt.failover.used, false);
    return true;
  });
  assert.equal(claudeCalls, 0);

  await assert.rejects(() => runAgent({
    driver: 'chatgpt-cli', role: 'synthesizer', label: 'coding:abort-fallback',
    prompt: 'work', runCodexCli: codexSequence([''], [failedRec('usage_limit')]),
    runClaude: claudeSequence([''], [{
      ...failedRec('aborted'), requested_model: 'claude-opus-5', aborted: true,
    }]),
  }), (error) => {
    assert.equal(error.receipt.status, 'aborted');
    assert.equal(error.receipt.attempts.length, 2);
    assert.equal(error.receipt.failover.used, true);
    return true;
  });
});

test('missing raw receipt normalizes unavailable and requested model never becomes served', async () => {
  await assert.rejects(() => runAgent({
    driver: 'claude', role: 'synthesizer', label: 'coding:missing', prompt: 'work',
    runClaude: async () => ({ text: 'answer' }),
  }), (error) => {
    const transport = error.receipt.attempts[0].transport_attempts[0];
    assert.equal(error.receipt.status, 'seat_unavailable');
    assert.equal(transport.error.code, 'missing_raw_receipt');
    return true;
  });

  const receipts = [];
  assert.equal(await runAgent({
    driver: 'chatgpt-cli', role: 'synthesizer', label: 'coding:partial',
    model: 'gpt-primary', prompt: 'work',
    runCodexCli: codexSequence(['answer'], [acceptedRec('chatgpt', null, 'gpt-primary')]),
    onReceipt: (receipt) => receipts.push(receipt),
  }), 'answer');
  assert.equal(receipts[0].requested.model, 'gpt-primary');
  assert.equal(receipts[0].served.model, null);
  assert.equal(receipts[0].served.model_attested, false);
});

test('requested identity never vetoes or overwrites honestly attested actual service', async () => {
  const receipts = [];
  let fallbackCalls = 0;
  const out = await runAgent({
    driver: 'chatgpt-cli', role: 'reviewer', label: 'reviewer:substituted',
    model: 'gpt-requested', prompt: 'review',
    runCodexCli: codexSequence(['accepted'], [acceptedRec(
      'gemini', 'gemini-actual', 'gpt-requested',
    )]),
    runClaude: async () => {
      fallbackCalls += 1;
      throw new Error('fallback must not run');
    },
    onReceipt: (receipt) => receipts.push(receipt),
  });
  assert.equal(out, 'accepted');
  assert.equal(fallbackCalls, 0);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].requested.family, 'chatgpt');
  assert.equal(receipts[0].requested.model, 'gpt-requested');
  assert.equal(receipts[0].served.family, 'gemini');
  assert.equal(receipts[0].served.model, 'gemini-actual');
  assert.equal(receipts[0].served.family_attested, true);
  assert.equal(receipts[0].served.model_attested, true);
});

test('failed fallback maps to seat_unavailable with used true', async () => {
  await assert.rejects(() => runAgent({
    driver: 'chatgpt-cli', role: 'execute', label: 'execute:fail', prompt: 'work',
    runCodexCli: codexSequence([''], [failedRec('usage_limit')]),
    runClaude: claudeSequence([''], [{
      ...failedRec('cli_error'), requested_model: 'claude-opus-5',
    }]),
  }), (error) => {
    assert.equal(error.receipt.status, 'seat_unavailable');
    assert.equal(error.receipt.failover.used, true);
    assert.equal(error.receipt.served, null);
    return true;
  });
});

test('throwing or rejecting final callback yields one ReceiptCallbackError and no retry', async () => {
  let codexCalls = 0;
  let callbackCalls = 0;
  await assert.rejects(() => runAgent({
    driver: 'chatgpt-cli', role: 'synthesizer', label: 'coding:callback', prompt: 'work',
    runCodexCli: async () => {
      codexCalls += 1;
      return { text: 'answer', rec: acceptedRec('chatgpt', 'gpt-primary') };
    },
    onReceipt: async () => {
      callbackCalls += 1;
      throw new Error('sink unavailable');
    },
  }), (error) => {
    assert.equal(error instanceof ReceiptCallbackError, true);
    assert.equal(error.receipt.ok, true);
    assert.equal(error.receipt.status, 'success');
    return true;
  });
  assert.equal(codexCalls, 1);
  assert.equal(callbackCalls, 1);
});

test('faulty custom drivers cannot hide impossible or excessive physical receipt sequences', async () => {
  const cases = [
    {
      name: 'test-invalid-double-accepted',
      entries: [
        { kind: 'initial', outcome: 'accepted' },
        { kind: 'schema_reprompt', outcome: 'accepted' },
      ],
      message: /second physical attempt requires/,
    },
    {
      name: 'test-invalid-three-physical',
      entries: [
        { kind: 'initial', outcome: 'schema_rejected' },
        { kind: 'schema_reprompt', outcome: 'accepted' },
        { kind: 'schema_reprompt', outcome: 'accepted' },
      ],
      message: /reported 3 physical attempts/,
    },
  ];
  for (const current of cases) {
    registerDriver({
      name: current.name,
      subAgentCapable: true,
      async runAgent(opts) {
        for (const entry of current.entries) {
          opts[PHYSICAL_RECEIPT_HOOK]({
            ...entry,
            label: 'judge:custom',
            receipt: acceptedRec('gemini', 'gemini-test'),
          });
        }
        return { passed: true };
      },
    });
    await assert.rejects(() => runAgent({
      driver: current.name,
      role: 'judge',
      label: 'judge:custom',
      prompt: 'judge',
      schema: SCHEMA,
    }), (error) => {
      assert.equal(error.receipt.status, 'verification_fail_closed');
      assert.equal(error.receipt.attempts[0].status, 'seat_unavailable');
      assert.equal(error.receipt.attempts[0].error.code, 'invalid_physical_receipt_sequence');
      assert.match(error.receipt.attempts[0].error.message, current.message);
      assertClosedReceiptShape(error.receipt);
      assert.equal(error.receipt.attempts[0].transport_attempts.length, 1);
      const [synthetic] = error.receipt.attempts[0].transport_attempts;
      assert.equal(synthetic.status, 'seat_unavailable');
      assert.equal(synthetic.provider_status, null);
      assert.equal(synthetic.served, null);
      assert.equal(synthetic.error.code, 'invalid_physical_receipt_sequence');
      return true;
    });
  }
});
