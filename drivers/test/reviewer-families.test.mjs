// (John, 2026-09-05) Grok AND ChatGPT are reviewer seats: a verification seat proves its
// FAMILY; an unattested served MODEL is accepted and stamped. Claude attests both.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAgent } from '../index.mjs';

test('grok reviewer: JSON-attested model → clean verification receipt', async () => {
  const receipts = [];
  const runGrokCli = async () => ({ text: 'fine', rec: {
    ok: true, status: 'success', requested_model: null, model_family: 'grok', family_attested: true,
    model_served: 'grok-4.6-build', model_attested: true, degraded: false } });
  assert.equal(await runAgent({ driver: 'grok-cli', prompt: 'review', role: 'reviewer', runGrokCli,
    onReceipt: (r) => receipts.push(r) }), 'fine');
  assert.equal(receipts[0].status, 'success');
  assert.equal(receipts[0].served.family, 'grok');
  assert.equal(receipts[0].served.model_attested, true);
});

test('chatgpt reviewer: family attested, model unattested → accepted with the stamp; shark and judge too', async () => {
  const runCodexCli = async () => ({ text: 'verdict', rec: {
    ok: true, status: 'success', requested_model: 'gpt-5.6', model_family: 'chatgpt', family_attested: true,
    model_served: null, model_attested: false, degraded: true } });
  for (const role of ['reviewer', 'shark', 'judge', 'refuter', 'gate3']) {
    const receipts = [];
    assert.equal(await runAgent({ driver: 'chatgpt-cli', prompt: 'review', role, runCodexCli,
      onReceipt: (r) => receipts.push(r) }), 'verdict', role);
    assert.equal(receipts[0].verification, true, role);
    assert.equal(receipts[0].status, 'success', role);
    assert.equal(receipts[0].served.family_attested, true, role);
    assert.equal(receipts[0].served.model_attested, false, role);
    assert.equal(receipts[0].failover.allowed, false, 'a verification seat never fails over');
  }
});
