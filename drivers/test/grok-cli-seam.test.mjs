// drivers/test/grok-cli-seam.test.mjs — gate for the grok-cli agent seam's
// schema/retry/fail-closed contract (2026-08-20, Jumper gate-3 repair).
//
// Field evidence (live probes, this date): the grok CLI in plain mode narrates its
// agentic steps into stdout and then emits ONE JSON object whose string values can
// contain LITERAL newlines (invalid JSON without extractJson's control-char
// candidate). The Jumper r2 run additionally proved a parsed-but-shapeless reply
// (no boolean `passed`) was returned WITHOUT any retry — the strict retry only
// fired on unparseable text. These tests pin both behaviors:
//   * narration + control-char JSON parses on the FIRST call (no retry burned);
//   * a parsed reply missing a schema-required boolean now triggers the ONE
//     strict retry; the retry's parse wins;
//   * a reply that stays shapeless fails rather than inventing/coercing a verdict;
//   * unparseable-after-retry fails closed with both physical attempts preserved;
//   * non-boolean required fields use the same recursive validator.
//
// Hermetic: injected runGrokCli stub, no subprocess. Exercises REAL source in
// drivers/grok-cli.mjs + drivers/index.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runAgent } from '../index.mjs';
import { conformsRequiredBooleans } from '../grok-cli.mjs';

// Jumper Gate-3's exact schema (skills/jumper/index.js ~888).
const gate3Schema = {
  type: 'object',
  properties: { passed: { type: 'boolean' }, reasoning: { type: 'string' } },
  required: ['passed', 'reasoning'],
};

function acceptedGrokReceipt() {
  return {
    ok: true,
    status: 'success',
    requested_model: 'grok-test',
    model_family: 'grok',
    family_attested: true,
    model_served: 'grok-test',
    model_attested: true,
    degraded: false,
  };
}

// Authentic captured shape (grok-bigprobe-seq2, 2026-08-20, trimmed): narration
// prose glued to a JSON object with LITERAL newlines inside the reasoning string.
const narrationPollutedReply =
  `I'll read the full offloaded prompt and Jumper skill so the Gate 3 evaluation ` +
  `is against the complete concept, not the truncated text.The analogical mapping ` +
  `is complete enough to judge the resolution.` +
  `{"passed":false,"reasoning":"KILL. The edition-page architecture is a real TRIZ transfer.\n` +
  `Sigla harvest and successor-editor checklist survive.\n` +
  `But register-separation on the student surface is unpriced."}`;

test('grok-cli seam, no schema: returns plain text via injected runGrokCli', async () => {
  const out = await runAgent({
    driver: 'grok-cli', prompt: 'say hi',
    runGrokCli: async () => ({ text: 'hello from grok', rec: acceptedGrokReceipt() }),
  });
  assert.equal(out, 'hello from grok');
});

test('grok-cli seam + schema: REGRESSION — narration-polluted reply with literal control chars parses on the FIRST call (no retry)', async () => {
  let calls = 0;
  const out = await runAgent({
    driver: 'grok-cli', prompt: 'gate 3', schema: gate3Schema, label: 'KillFilterGate3',
    runGrokCli: async () => {
      calls += 1;
      return { text: narrationPollutedReply, rec: acceptedGrokReceipt() };
    },
  });
  assert.equal(calls, 1, 'a parseable conforming reply must not burn the retry');
  assert.equal(out.passed, false);
  assert.equal(typeof out.passed, 'boolean');
  assert.match(out.reasoning, /KILL\. The edition-page architecture/);
});

test('grok-cli seam + schema: unparseable first reply retries once then succeeds', async () => {
  let calls = 0;
  const out = await runAgent({
    driver: 'grok-cli', role: 'gate3', prompt: 'gate 3', schema: gate3Schema,
    runGrokCli: async () => {
      calls += 1;
      return {
        text: calls === 1 ? 'not json at all' : '{"passed":true,"reasoning":"ok"}',
        rec: acceptedGrokReceipt(),
      };
    },
  });
  assert.equal(calls, 2, 'one initial call + exactly one retry');
  assert.equal(out.passed, true);
});

test('grok-cli seam + schema: unparseable twice fails verification closed', async () => {
  let calls = 0;
  let fallbackCalls = 0;
  await assert.rejects(() => runAgent({
    driver: 'grok-cli', role: 'gate3', prompt: 'gate 3', schema: gate3Schema,
    label: 'gate3:g3',
    runGrokCli: async () => {
      calls += 1;
      return { text: 'never json', rec: acceptedGrokReceipt() };
    },
    runClaude: async () => {
      fallbackCalls += 1;
      throw new Error('verification fallback must not run');
    },
  }), (error) => {
    assert.equal(error.receipt.status, 'verification_fail_closed');
    assert.equal(error.receipt.attempts[0].status, 'schema_exhausted');
    assert.deepEqual(
      error.receipt.attempts[0].transport_attempts.map((attempt) => attempt.status),
      ['schema_rejected', 'schema_rejected'],
    );
    return true;
  });
  assert.equal(calls, 2, 'initial + one retry, then fail closed');
  assert.equal(fallbackCalls, 0);
});

test('grok-cli seam + schema: RETRY-GAP FIX — parsed reply MISSING boolean `passed` now fires the strict retry; retry parse wins', async () => {
  let calls = 0;
  const prompts = [];
  const out = await runAgent({
    driver: 'grok-cli', role: 'gate3', prompt: 'gate 3', schema: gate3Schema,
    label: 'gate3:g3',
    runGrokCli: async (prompt) => {
      calls += 1;
      prompts.push(prompt);
      return {
        text: calls === 1
          ? '{"reasoning":"looks structurally sound to me"}' // parses; no `passed` at all
          : '{"passed":true,"reasoning":"verified"}',
        rec: acceptedGrokReceipt(),
      };
    },
  });
  assert.equal(calls, 2, 'parsed-but-shapeless must fire the ONE strict retry (was: returned with none)');
  assert.match(prompts[1], /did not conform to the requested JSON Schema/,
    'the strict reprompt names the nonconformance');
  assert.equal(out.passed, true);
  assert.equal(out.reasoning, 'verified');
});

test('grok-cli seam + schema: string "passed":"true" is NONCONFORMING — retried, never coerced', async () => {
  let calls = 0;
  const out = await runAgent({
    driver: 'grok-cli', role: 'gate3', prompt: 'gate 3', schema: gate3Schema,
    runGrokCli: async () => {
      calls += 1;
      return {
        text: calls === 1
          ? '{"passed":"true","reasoning":"string verdict"}'
          : '{"passed":false,"reasoning":"real boolean verdict"}',
        rec: acceptedGrokReceipt(),
      };
    },
  });
  assert.equal(calls, 2, 'a string passed is not a verdict — it must be reprompted');
  assert.equal(out.passed, false, 'the retried REAL boolean wins; "true" was never coerced to true');
  assert.equal(typeof out.passed, 'boolean');
});

test('grok-cli seam + schema: shapeless then unparseable fails closed without inventing a verdict', async () => {
  let calls = 0;
  await assert.rejects(() => runAgent({
    driver: 'grok-cli', role: 'gate3', prompt: 'gate 3', schema: gate3Schema,
    runGrokCli: async () => {
      calls += 1;
      return {
        text: calls === 1 ? '{"reasoning":"only prose-shaped"}' : 'retry collapsed to prose',
        rec: acceptedGrokReceipt(),
      };
    },
  }), (error) => error.receipt.status === 'verification_fail_closed'
    && error.receipt.attempts[0].status === 'schema_exhausted');
  assert.equal(calls, 2);
});

test('grok-cli seam + schema: non-boolean required fields use the shared validator', async () => {
  let calls = 0;
  const sharkSchema = {
    type: 'object',
    properties: { answerable: { type: 'string' }, findings: { type: 'array' } },
    required: ['answerable'],
  };
  const out = await runAgent({
    driver: 'grok-cli', role: 'reviewer', prompt: 'review', schema: sharkSchema,
    runGrokCli: async () => {
      calls += 1;
      return {
        text: '{"answerable":"yes","findings":[]}', rec: acceptedGrokReceipt(),
      };
    },
  });
  assert.equal(calls, 1);
  assert.equal(out.answerable, 'yes');
});

test('legacy conformance export delegates to the shared recursive validator', () => {
  assert.equal(conformsRequiredBooleans({ passed: true, reasoning: 'r' }, gate3Schema), true);
  assert.equal(conformsRequiredBooleans({ passed: false, reasoning: 'r' }, gate3Schema), true);
  assert.equal(conformsRequiredBooleans({ passed: 'true', reasoning: 'r' }, gate3Schema), false);
  assert.equal(conformsRequiredBooleans({ reasoning: 'r' }, gate3Schema), false);
  assert.equal(conformsRequiredBooleans(null, gate3Schema), false);
  assert.equal(conformsRequiredBooleans([], gate3Schema), false);
  assert.equal(conformsRequiredBooleans({ passed: true }, gate3Schema), false);
  assert.equal(conformsRequiredBooleans({ anything: 1 }, { type: 'object' }), true);
  assert.equal(conformsRequiredBooleans({ anything: 1 }, undefined), false);
});
