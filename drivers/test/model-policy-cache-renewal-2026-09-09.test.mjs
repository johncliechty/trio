import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { discoverModelCapabilities } from '../model-policy.mjs';

test('Grok cache renewal preserves timestamp and subscription validation', async (t) => {
  const tempBase = path.resolve(os.tmpdir());
  const prefix = 'trio-model-policy-cache-renewal-';
  const tempHome = fs.mkdtempSync(path.join(tempBase, prefix));
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
    const resolvedHome = path.resolve(tempHome);
    assert.equal(path.dirname(resolvedHome), tempBase);
    assert.ok(path.basename(resolvedHome).startsWith(prefix));
    fs.rmSync(resolvedHome, { recursive: true, force: true });
  });

  // Date.parse(2026) would coerce the number into a fresh date at this time.
  const now = Date.parse('2026-01-01T00:00:30.000Z');
  const timestamp = (offset) => new Date(now + offset).toISOString();
  t.mock.method(Date, 'now', () => now);
  const executable = path.join(tempHome, 'mock-grok.exe');
  const probes = [];
  t.mock.method(childProcess, 'execFileSync', (file, args) => {
    assert.equal(file, executable);
    probes.push([...args]);
    if (args.length === 1 && args[0] === '--version') return 'grok 1.0.25';
    if (args.length === 1 && args[0] === 'models') return 'catalog';
    assert.fail(`Unexpected Grok probe: ${JSON.stringify(args)}`);
  });
  syncBuiltinESMExports();

  const cacheDirectory = path.join(tempHome, '.grok');
  fs.mkdirSync(cacheDirectory);
  const cachePath = path.join(cacheDirectory, 'models_cache.json');
  const env = { USERPROFILE: tempHome, HOME: tempHome, PATH: '' };
  const base = {
    fetched_at: timestamp(-30_000),
    auth_method: 'session',
    origin: 'https://cli-chat-proxy.grok.com/v1/models',
    grok_version: '1.0.25',
    models: {
      new: {
        info: {
          model: 'future-catalog',
          reasoning_efforts: [{ value: 'xhigh' }],
        },
      },
    },
  };
  const renewed = {
    fetched_at: timestamp(-900_000),
    renewed_at: timestamp(-60_000),
  };
  const timestampError = /Grok capability cache is stale or has an invalid timestamp/;
  const identityError = /Grok capability cache does not match the subscription identity, origin, or installed CLI version/;
  const cases = [
    { name: 'fresh renewal accepts an old fetch', patch: renewed },
    { name: 'old fetch without renewal remains stale', patch: { fetched_at: timestamp(-900_000) }, error: timestampError },
    { name: 'renewal at the existing TTL boundary is accepted', patch: { ...renewed, renewed_at: timestamp(-300_000) } },
    { name: 'stale renewal is rejected', patch: { ...renewed, renewed_at: timestamp(-300_001) }, error: timestampError },
    { name: 'future renewal is rejected', patch: { ...renewed, renewed_at: timestamp(1) }, error: timestampError },
    { name: 'malformed renewal is rejected', patch: { ...renewed, renewed_at: 'not-a-timestamp' }, error: timestampError },
    { name: 'numeric renewal cannot be coerced into a timestamp', patch: { ...renewed, renewed_at: 2026 }, error: timestampError },
    { name: 'renewal before the fetch is rejected', patch: { renewed_at: timestamp(-60_000) }, error: timestampError },
    { name: 'fresh legacy fetch is accepted', patch: {} },
    { name: 'null renewal falls back to a fresh fetch', patch: { renewed_at: null } },
    { name: 'null renewal does not refresh an old fetch', patch: { fetched_at: timestamp(-900_000), renewed_at: null }, error: timestampError },
    { name: 'future fetch is rejected', patch: { fetched_at: timestamp(1) }, error: timestampError },
    { name: 'fresh renewal cannot conceal an invalid fetch', patch: { fetched_at: 'not-a-timestamp', renewed_at: timestamp(-10_000) }, error: timestampError },
    { name: 'numeric fetch cannot be coerced into a timestamp', patch: { fetched_at: 2026, renewed_at: timestamp(-10_000) }, error: timestampError },
    { name: 'renewal cannot bypass session authentication', patch: { ...renewed, auth_method: 'api_key' }, error: identityError },
    { name: 'renewal cannot bypass the expected origin', patch: { ...renewed, origin: 'https://example.invalid/v1/models' }, error: identityError },
    { name: 'renewal cannot bypass the installed CLI version', patch: { ...renewed, grok_version: '1.0.24' }, error: identityError },
  ];

  for (const { name, patch, error } of cases) {
    await t.test(name, () => {
      fs.writeFileSync(cachePath, JSON.stringify({ ...base, ...patch }), 'utf8');
      probes.length = 0;
      const discover = () => discoverModelCapabilities('grok', { env, executable });
      if (error) assert.throws(discover, error);
      else assert.doesNotThrow(discover);
      assert.deepEqual(probes, [['--version'], ['models']]);
    });
  }
});
