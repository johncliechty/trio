import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeAgentSeam as makeClaudeSeam } from '../claude.mjs';
import { conformsJsonSchema } from '../cli-schema.mjs';
import { makeGeminiCliSeam } from '../gemini-cli.mjs';
import { makeGrokCliAgentSeam } from '../grok-cli.mjs';
import { makeChatgptCliAgentSeam } from '../chatgpt-cli.mjs';

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['passed', 'findings'],
  properties: {
    passed: { type: 'boolean' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'count'],
        properties: {
          severity: { enum: ['MAJOR', 'MINOR'] },
          count: { type: 'integer', minimum: 1 },
          note: { type: 'string', pattern: '^grounded:' },
          optional: { type: 'string', nullable: true },
        },
      },
    },
  },
};

test('shared recursive schema validator covers the in-repo subset and fails unknown semantics closed', () => {
  const good = {
    passed: true,
    findings: [{ severity: 'MAJOR', count: 1, note: 'grounded:file', optional: null }],
  };
  assert.equal(conformsJsonSchema(good, VERDICT_SCHEMA), true);
  assert.equal(conformsJsonSchema({ findings: [] }, VERDICT_SCHEMA), false, 'missing required');
  assert.equal(conformsJsonSchema({ ...good, passed: 'true' }, VERDICT_SCHEMA), false, 'wrong type');
  assert.equal(conformsJsonSchema({
    ...good, findings: [{ severity: 'MAJOR', count: 0, note: 'grounded:file' }],
  }, VERDICT_SCHEMA), false, 'nested minimum');
  assert.equal(conformsJsonSchema({
    ...good, findings: [{ severity: 'BLOCKER', count: 1, note: 'ungrounded' }],
  }, VERDICT_SCHEMA), false, 'nested enum and pattern');
  assert.equal(conformsJsonSchema(good, { ...VERDICT_SCHEMA, anyOf: [] }), false, 'unsupported keyword');
});

const SEAMS = [
  ['Claude', (run) => makeClaudeSeam({ runClaude: run })],
  ['Gemini', (run) => makeGeminiCliSeam({ runGemini: run })],
  ['Grok', (run) => makeGrokCliAgentSeam({ runGrokCli: run })],
  ['ChatGPT', (run) => makeChatgptCliAgentSeam({ runCodexCli: run })],
];

for (const [name, make] of SEAMS) {
  test(`${name} seam rejects valid JSON with missing/wrong-type required fields twice`, async () => {
    let calls = 0;
    const replies = ['{"findings":[]}', '{"passed":"true","findings":[]}'];
    const { agent } = make(async () => ({
      text: replies[calls++],
      rec: { ok: true, status: 'success' },
    }));
    await assert.rejects(
      () => agent('judge', { schema: VERDICT_SCHEMA, role: 'judge', label: `${name}:schema` }),
      (error) => error.seat_status === 'schema_nonconforming',
    );
    assert.equal(calls, 2);
  });
}
