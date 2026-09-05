// (2026-09-04, John) a dead seat's last words ride the HALT; a usage limit is named.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seatLastWords, isUsageLimitText } from '../bin/run-live.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

test('seatLastWords: one clipped line of the seat\'s own words', () => {
  assert.equal(seatLastWords('  You\'ve hit your\n usage limit.  '), "You've hit your usage limit.");
  assert.equal(seatLastWords(''), '');
  const long = 'word '.repeat(100);
  const out = seatLastWords(long, 60);
  assert.ok(out.length <= 60 && out.endsWith('…'));
});

test('isUsageLimitText: limits are named, ordinary errors are not', () => {
  assert.equal(isUsageLimitText("You've hit your usage limit. Resets at 7pm"), true);
  assert.equal(isUsageLimitText('HTTP 429 too many requests'), true);
  assert.equal(isUsageLimitText('rate-limited'), true);
  assert.equal(isUsageLimitText('TypeError: x is not a function'), false);
});

test('wave-engine: the execute halt carries the seat\'s words and names a usage limit', () => {
  const src = fs.readFileSync(path.join(here, '..', 'bin', 'wave-engine.mjs'), 'utf8');
  assert.match(src, /\[taxonomy:usage-limit\] HALT: the execute seat hit a model session\/usage limit/);
  assert.match(src, /af\.last_words \? ` — it said: \$\{af\.last_words\}` : ''/);
  const live = fs.readFileSync(path.join(here, '..', 'bin', 'run-live.mjs'), 'utf8');
  assert.match(live, /last_words: lastWords, usage_limit: usageLimit,/);
});
