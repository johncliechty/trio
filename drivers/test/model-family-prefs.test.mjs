import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadModelFamilies, resolveDriverFromFamilies } from '../index.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trio-prefs-'));
  const home = path.join(root, 'home');
  const data = path.join(root, 'data');
  fs.mkdirSync(path.join(home, '.anchor'), { recursive: true });
  fs.mkdirSync(data, { recursive: true });
  return { root, home, data };
}

test('primary Anchor settings outrank mirror and stale family env', (t) => {
  const fx = fixture();
  t.after(() => fs.rmSync(fx.root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(fx.home, '.anchor', 'model_prefs.json'), JSON.stringify({
    coding_family: 'grok', review_family: 'gemini',
  }));
  fs.writeFileSync(path.join(fx.data, 'settings.json'), JSON.stringify({
    coding_family: 'chatgpt', review_family: 'claude',
  }));
  const env = {
    USERPROFILE: fx.home, ANCHOR_DATA_DIR: fx.data,
    CODING_FAMILY: 'gemini', REVIEW_FAMILY: 'grok', TRIO_DRIVER_SHARK: 'gemini-cli',
  };
  assert.deepEqual(loadModelFamilies(env), {
    coding: 'chatgpt', review: 'claude', cross_model: true,
    source: path.join(fx.data, 'settings.json'),
  });
  assert.equal(resolveDriverFromFamilies('synthesizer', env), 'chatgpt-cli');
  assert.equal(resolveDriverFromFamilies('reviewer', env), 'claude');
});

test('mirror is canonical for non-Anchor hosts; absent prefs use historical defaults', (t) => {
  const fx = fixture();
  t.after(() => fs.rmSync(fx.root, { recursive: true, force: true }));
  const mirror = path.join(fx.home, '.anchor', 'model_prefs.json');
  fs.writeFileSync(mirror, JSON.stringify({ coding_family: 'chatgpt', review_family: 'chatgpt' }));
  assert.deepEqual(loadModelFamilies({ USERPROFILE: fx.home }), {
    coding: 'chatgpt', review: 'chatgpt', cross_model: false, source: mirror,
  });
  fs.unlinkSync(mirror);
  assert.deepEqual(loadModelFamilies({ USERPROFILE: fx.home, CODING_FAMILY: 'grok' }), {
    coding: 'claude', review: 'gemini', cross_model: true, source: 'historical-default',
  });
});

test('corrupt or unknown saved family HALTs instead of guessing', (t) => {
  const fx = fixture();
  t.after(() => fs.rmSync(fx.root, { recursive: true, force: true }));
  const mirror = path.join(fx.home, '.anchor', 'model_prefs.json');
  fs.writeFileSync(mirror, '{bad json');
  assert.throws(() => loadModelFamilies({ USERPROFILE: fx.home }), /unreadable/);
  fs.writeFileSync(mirror, JSON.stringify({ coding_family: 'mystery', review_family: 'claude' }));
  assert.throws(() => loadModelFamilies({ USERPROFILE: fx.home }), /unknown coding_family/);
});

test('preference fields resolve independently settings then mirror then historical default', (t) => {
  const fx = fixture();
  t.after(() => fs.rmSync(fx.root, { recursive: true, force: true }));
  const mirror = path.join(fx.home, '.anchor', 'model_prefs.json');
  fs.writeFileSync(mirror, JSON.stringify({ review_family: 'grok' }));
  fs.writeFileSync(path.join(fx.data, 'settings.json'), JSON.stringify({ coding_family: 'chatgpt' }));
  assert.deepEqual(loadModelFamilies({ USERPROFILE: fx.home, ANCHOR_DATA_DIR: fx.data }), {
    coding: 'chatgpt', review: 'grok', cross_model: true,
    source: path.join(fx.data, 'settings.json'),
  });

  fs.writeFileSync(mirror, JSON.stringify({ coding_family: 'gemini' }));
  assert.deepEqual(loadModelFamilies({ USERPROFILE: fx.home, ANCHOR_DATA_DIR: fx.data }), {
    coding: 'chatgpt', review: 'gemini', cross_model: true,
    source: path.join(fx.data, 'settings.json'),
  });
});

test('explicit data dir is closed and mirror primary_path never redirects reads', (t) => {
  const fx = fixture();
  t.after(() => fs.rmSync(fx.root, { recursive: true, force: true }));
  const redirect = path.join(fx.root, 'redirect.json');
  fs.writeFileSync(redirect, JSON.stringify({ coding_family: 'grok', review_family: 'grok' }));
  fs.writeFileSync(path.join(fx.home, '.anchor', 'model_prefs.json'), JSON.stringify({
    primary_path: redirect, coding_family: 'chatgpt', review_family: 'claude',
  }));
  assert.deepEqual(loadModelFamilies({ USERPROFILE: fx.home }), {
    coding: 'chatgpt', review: 'claude', cross_model: true,
    source: path.join(fx.home, '.anchor', 'model_prefs.json'),
  });
  assert.deepEqual(loadModelFamilies({
    USERPROFILE: fx.home,
    ANCHOR_DATA_DIR: path.join(fx.root, 'missing-data-dir'),
  }), {
    coding: 'chatgpt', review: 'claude', cross_model: true,
    source: path.join(fx.home, '.anchor', 'model_prefs.json'),
  });
});

test('family-value environment variables are ignored field-wise', (t) => {
  const fx = fixture();
  t.after(() => fs.rmSync(fx.root, { recursive: true, force: true }));
  assert.deepEqual(loadModelFamilies({
    USERPROFILE: fx.home,
    CODING_FAMILY: 'grok', REVIEW_FAMILY: 'chatgpt',
    TRIO_DRIVER_REVIEWER: 'grok-cli',
  }), {
    coding: 'claude', review: 'gemini', cross_model: true,
    source: 'historical-default',
  });
});

test('a malformed consulted lower-precedence store HALTs, but an unused mirror does not', (t) => {
  const fx = fixture();
  t.after(() => fs.rmSync(fx.root, { recursive: true, force: true }));
  const settings = path.join(fx.data, 'settings.json');
  const mirror = path.join(fx.home, '.anchor', 'model_prefs.json');
  fs.writeFileSync(settings, JSON.stringify({ coding_family: 'claude' }));
  fs.writeFileSync(mirror, '{bad');
  assert.throws(
    () => loadModelFamilies({ USERPROFILE: fx.home, ANCHOR_DATA_DIR: fx.data }),
    /unreadable/,
  );
  fs.writeFileSync(settings, JSON.stringify({
    coding_family: 'claude', review_family: 'gemini',
  }));
  assert.equal(
    loadModelFamilies({ USERPROFILE: fx.home, ANCHOR_DATA_DIR: fx.data }).review,
    'gemini',
  );
});
