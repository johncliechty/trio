// Anchor attribution sink (Wave 2 S3): when Anchor spawned this process,
// `ANCHOR_RECEIPTS_DIR` names a folder and every physical receipt becomes one
// small JSON file there, carrying the inherited ids and the seat's own session,
// usage and cost. Without the env nothing is written. An observer must never
// break the seat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerDriver, runAgent, sinkAnchorReceipt } from '../index.mjs';
import { PHYSICAL_RECEIPT_HOOK } from '../seat-contract.mjs';

function receipt(extra = {}) {
  return {
    label: 'reviewer', ok: true, status: 'success', requested_model: 'claude-fable-5-1',
    model_served: 'claude-fable-5-1', model_family: 'claude', family_attested: true, model_attested: true,
    session_id: '3f2c1b0a-9d8e-4c7b-8a6f-5e4d3c2b1a09', cost_usd: 0.37, duration_ms: 1200,
    usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 },
    ...extra,
  };
}

test('sink: writes one receipt file with the inherited ids when ANCHOR_RECEIPTS_DIR is set', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anchor-receipts-'));
  const env = {
    ANCHOR_RECEIPTS_DIR: dir, ANCHOR_PROJECT_ID: 'p1', ANCHOR_EFFORT_DIR: 'C:\\dev\\proj\\eff',
    ANCHOR_JOB_ID: 'job-7', ANCHOR_SESSION_ID: '01a08260-068d-76a1-99f6-5a7bdf3aaab8',
  };
  const file = sinkAnchorReceipt({ name: 'claude' }, { label: 'reviewer' },
    { kind: 'initial', outcome: 'accepted', label: 'reviewer', receipt: receipt() }, env);
  assert.ok(file && fs.existsSync(file));
  const body = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(body.schema, 'anchor.receipt.v1');
  assert.equal(body.family, 'claude');
  assert.equal(body.native_id, '3f2c1b0a-9d8e-4c7b-8a6f-5e4d3c2b1a09');
  assert.equal(body.cost_usd, 0.37);
  assert.deepEqual(body.usage, receipt().usage);
  assert.deepEqual(body.env, { project_id: 'p1', effort_dir: 'C:\\dev\\proj\\eff', job_id: 'job-7',
    session_id: '01a08260-068d-76a1-99f6-5a7bdf3aaab8' });
  assert.equal(typeof body.cwd, 'string');
  assert.match(body.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  assert.equal(fs.readdirSync(dir).filter((f) => f.endsWith('.part')).length, 0, 'no torn file left behind');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('sink: a Codex receipt keys by thread id; an empty receipt writes nothing; no env writes nothing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anchor-receipts-'));
  const env = { ANCHOR_RECEIPTS_DIR: dir };
  const file = sinkAnchorReceipt({ name: 'chatgpt-cli' }, {}, {
    kind: 'initial', outcome: 'accepted', label: 'coder',
    receipt: { ok: true, status: 'success', thread_id: '01a0b0c6-2222-7b50-a38b-b91aad842222', model_served: 'gpt-6-astra',
      usage: { input_tokens: 10, cached_input_tokens: 5, output_tokens: 3, reasoning_output_tokens: 1 } },
  }, env);
  const body = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(body.native_id, '01a0b0c6-2222-7b50-a38b-b91aad842222');
  assert.equal(body.family, 'chatgpt');
  assert.equal(body.cost_usd, null);
  assert.deepEqual(body.env, { project_id: null, effort_dir: null, job_id: null, session_id: null });
  assert.equal(sinkAnchorReceipt({ name: 'claude' }, {}, { kind: 'initial', outcome: 'aborted', receipt: null }, env), null);
  assert.equal(sinkAnchorReceipt({ name: 'claude' }, {}, { kind: 'initial', outcome: 'accepted', receipt: receipt() }, {}), null);
  assert.equal(fs.readdirSync(dir).length, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('dispatcher: every physical receipt of a seat reaches the sink, and the seat is unharmed', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anchor-receipts-'));
  const prev = process.env.ANCHOR_RECEIPTS_DIR;
  process.env.ANCHOR_RECEIPTS_DIR = dir;
  try {
    registerDriver({
      name: 'mock-sink-backend',
      subAgentCapable: false,
      async runAgent(opts) {
        opts[PHYSICAL_RECEIPT_HOOK]({ kind: 'initial', outcome: 'accepted', label: opts.label, receipt: receipt() });
        return `mock:${opts.prompt}`;
      },
    });
    const out = await runAgent({ driver: 'mock-sink-backend', prompt: 'ping', label: 'reviewer' });
    assert.equal(out, 'mock:ping');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    assert.equal(files.length, 1);
    const body = JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf8'));
    assert.equal(body.driver, 'mock-sink-backend');
    assert.equal(body.label, 'reviewer');
    assert.equal(body.native_id, '3f2c1b0a-9d8e-4c7b-8a6f-5e4d3c2b1a09');
  } finally {
    if (prev === undefined) delete process.env.ANCHOR_RECEIPTS_DIR; else process.env.ANCHOR_RECEIPTS_DIR = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
