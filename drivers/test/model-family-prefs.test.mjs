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
    coding_family: 'grok', review_family: 'gemini', default_cli: 'grok',
  }));
  fs.writeFileSync(path.join(fx.data, 'settings.json'), JSON.stringify({
    coding_family: 'chatgpt', review_family: 'claude', default_cli: 'chatgpt',
  }));
  const env = {
    USERPROFILE: fx.home, ANCHOR_DATA_DIR: fx.data,
    CODING_FAMILY: 'gemini', REVIEW_FAMILY: 'grok', TRIO_DRIVER_SHARK: 'gemini-cli',
  };
  const actual = loadModelFamilies(env);
  assert.equal(actual.coding, 'chatgpt');
  assert.equal(actual.review, 'claude');
  assert.equal(actual.cross_model, true);
  assert.equal(actual.source, 'primary');
  assert.equal(resolveDriverFromFamilies('synthesizer', env), 'chatgpt-cli');
  assert.equal(resolveDriverFromFamilies('reviewer', env), 'claude');
});

test('mirror is canonical for non-Anchor hosts; absent prefs use historical defaults', (t) => {
  const fx = fixture();
  t.after(() => fs.rmSync(fx.root, { recursive: true, force: true }));
  const mirror = path.join(fx.home, '.anchor', 'model_prefs.json');
  fs.writeFileSync(mirror, JSON.stringify({
    coding_family: 'chatgpt', review_family: 'chatgpt', default_cli: 'chatgpt',
  }));
  const fromMirror = loadModelFamilies({ USERPROFILE: fx.home });
  assert.equal(fromMirror.coding, 'chatgpt');
  assert.equal(fromMirror.review, 'chatgpt');
  assert.equal(fromMirror.cross_model, false);
  assert.equal(fromMirror.source, 'mirror');

  fs.unlinkSync(mirror);
  const fromDefault = loadModelFamilies({ USERPROFILE: fx.home, CODING_FAMILY: 'grok' });
  assert.equal(fromDefault.coding, 'claude');
  assert.equal(fromDefault.review, 'claude');
  assert.equal(fromDefault.cross_model, false);
  assert.equal(fromDefault.source, 'historical-default');
});

test('corrupt or unknown saved family HALTs instead of guessing', (t) => {
  const fx = fixture();
  t.after(() => fs.rmSync(fx.root, { recursive: true, force: true }));
  const mirror = path.join(fx.home, '.anchor', 'model_prefs.json');
  fs.writeFileSync(mirror, '{bad json');
  assert.throws(
    () => loadModelFamilies({ USERPROFILE: fx.home }),
    (err) => err.code === 'settings_invalid',
  );
  fs.writeFileSync(mirror, JSON.stringify({
    coding_family: 'mystery', review_family: 'claude', default_cli: 'claude',
  }));
  assert.throws(
    () => loadModelFamilies({ USERPROFILE: fx.home }),
    /Missing or invalid coding_family/,
  );
});

test('explicit data dir is closed and mirror primary_path never redirects reads', (t) => {
  const fx = fixture();
  t.after(() => fs.rmSync(fx.root, { recursive: true, force: true }));
  const redirect = path.join(fx.root, 'redirect.json');
  fs.writeFileSync(redirect, JSON.stringify({
    coding_family: 'grok', review_family: 'grok', default_cli: 'grok',
  }));
  fs.writeFileSync(path.join(fx.home, '.anchor', 'model_prefs.json'), JSON.stringify({
    primary_path: redirect, coding_family: 'chatgpt', review_family: 'claude', default_cli: 'chatgpt',
  }));
  const a = loadModelFamilies({ USERPROFILE: fx.home });
  assert.equal(a.coding, 'chatgpt');
  assert.equal(a.review, 'claude');
  assert.equal(a.source, 'mirror');

  const b = loadModelFamilies({
    USERPROFILE: fx.home,
    ANCHOR_DATA_DIR: path.join(fx.root, 'missing-data-dir'),
  });
  assert.equal(b.coding, 'chatgpt');
  assert.equal(b.review, 'claude');
  assert.equal(b.source, 'mirror');
});

test('family-value environment variables are ignored field-wise', (t) => {
  const fx = fixture();
  t.after(() => fs.rmSync(fx.root, { recursive: true, force: true }));
  const actual = loadModelFamilies({
    USERPROFILE: fx.home,
    CODING_FAMILY: 'grok', REVIEW_FAMILY: 'chatgpt',
    TRIO_DRIVER_REVIEWER: 'grok-cli',
  });
  assert.equal(actual.coding, 'claude');
  assert.equal(actual.review, 'claude');
  assert.equal(actual.cross_model, false);
  assert.equal(actual.source, 'historical-default');
});

test('an incomplete primary store HALTs, while a complete primary ignores a malformed mirror', (t) => {
  const fx = fixture();
  t.after(() => fs.rmSync(fx.root, { recursive: true, force: true }));
  const settings = path.join(fx.data, 'settings.json');
  const mirror = path.join(fx.home, '.anchor', 'model_prefs.json');
  fs.writeFileSync(settings, JSON.stringify({ coding_family: 'claude' }));
  fs.writeFileSync(mirror, '{bad');
  assert.throws(
    () => loadModelFamilies({ USERPROFILE: fx.home, ANCHOR_DATA_DIR: fx.data }),
    (err) => err.code === 'settings_invalid',
  );
  fs.writeFileSync(settings, JSON.stringify({
    coding_family: 'claude', review_family: 'gemini', default_cli: 'claude',
  }));
  assert.equal(
    loadModelFamilies({ USERPROFILE: fx.home, ANCHOR_DATA_DIR: fx.data }).review,
    'gemini',
  );
});
