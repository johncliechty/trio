/** Shared fixtures intentionally expose Python/Node contract disagreements. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DEFAULT_POLICY, PolicyUnavailable, normalizeCatalog, selectModel,
} from '../model-policy.mjs';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/model-policy-v1.json', import.meta.url), 'utf8'));

test('shared model-policy fixture schema and policy are explicit', () => {
  assert.equal(fixture.schema_version, 1);
  assert.equal(fixture.contract, 'anchor-trio-model-policy-v1');
  assert.deepEqual(fixture.policy, DEFAULT_POLICY);
  assert.ok(Array.isArray(fixture.cases) && fixture.cases.length > 0);
  assert.equal(new Set(fixture.cases.map(item => item.id)).size, fixture.cases.length);
});

for (const item of fixture.cases) {
  test(`shared model-policy contract: ${item.id}`, () => {
    const expected = item.expected;
    const evaluate = () => {
      // No adapter or fallback here: both implementations consume identical raw inputs.
      const catalog = normalizeCatalog(item.family, item.raw);
      assert.equal(JSON.stringify(catalog).includes('synthetic-secret-never-retained'), false);
      return selectModel(item.family, catalog);
    };
    if (expected.outcome === 'unavailable') {
      assert.throws(evaluate, error => {
        assert.ok(error instanceof PolicyUnavailable, `Expected PolicyUnavailable for ${expected.reason}; got ${error?.constructor?.name}`);
        assert.ok(error.message.length > 0);
        return true;
      });
      return;
    }
    assert.equal(expected.outcome, 'selected');
    const actual = evaluate();
    for (const key of ['model', 'effort', 'selection_evidence', 'model_attested']) {
      assert.equal(actual[key], expected[key], `${item.id}: ${key}`);
    }
    if (expected.warning_required) {
      assert.equal(typeof actual.warning, 'string', `${item.id}: a visible capability warning is required`);
      assert.ok(actual.warning.trim().length > 0);
    }
  });
}
