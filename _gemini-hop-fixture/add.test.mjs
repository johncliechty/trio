import { test } from 'node:test';
import assert from 'node:assert/strict';

import { add } from './add.mjs';

test('add returns the arithmetic sum', () => {
  assert.equal(add(2, 3), 5);
  assert.equal(add(-1, 1), 0);
  assert.equal(add(0, 0), 0);
  assert.equal(add(10, 32), 42);
});
