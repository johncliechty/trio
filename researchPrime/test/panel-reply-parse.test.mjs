// Live-seat reply parsing (2026-09-04, journal 0068): a real reviewer answers with a
// ```json-fenced findings object, often after prose; the drivers return { text, rec }.
// Before this fix the panel read `out?.findings` directly, so every live reply counted as
// zero findings and an unparsed reply looked like a clean look. These tests pin the
// extractor and the honesty rule that unparsed !== clean.
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPanelFindings } from '../bin/round.mjs';

const F = { claim_id: 'C7', topic: 'absence', severity: 'high', traces_to_north_star: 'yes', message: 'm' };

test('object with findings passes through', () => {
  const r = extractPanelFindings({ findings: [F] });
  assert.equal(r.parsed, 'object');
  assert.deepEqual(r.findings, [F]);
});

test('driver { text } holding a whole-string ```json fence is parsed', () => {
  const text = '```json\n' + JSON.stringify({ findings: [F] }) + '\n```';
  const r = extractPanelFindings({ text, rec: {} });
  assert.equal(r.parsed, 'json');
  assert.equal(r.findings.length, 1);
  assert.equal(r.raw, text);
});

test('prose followed by two fenced blocks: the LAST block wins', () => {
  const first = '```json\n' + JSON.stringify({ findings: [] }) + '\n```';
  const last = '```json\n' + JSON.stringify({ findings: [F, { ...F, claim_id: 'C6' }] }) + '\n```';
  const r = extractPanelFindings({ text: 'Thinking...\n' + first + '\nFinalizing.\n' + last + '\n' });
  assert.equal(r.parsed, 'json');
  assert.equal(r.findings.length, 2);
});

test('bare JSON text without a fence is parsed', () => {
  const r = extractPanelFindings(JSON.stringify({ findings: [F] }));
  assert.equal(r.parsed, 'json');
  assert.equal(r.findings.length, 1);
});

test('findings object embedded in prose without a fence is recovered by brace scan', () => {
  const r = extractPanelFindings({ text: 'Here is my review: ' + JSON.stringify({ findings: [F] }) + ' — done.' });
  assert.equal(r.parsed, 'json');
  assert.equal(r.findings.length, 1);
});

test('unparseable prose is NOT a clean look: findings null, parsed=unparsed, raw kept', () => {
  const r = extractPanelFindings({ text: 'I looked and I think it is fine.' });
  assert.equal(r.findings, null);
  assert.equal(r.parsed, 'unparsed');
  assert.match(r.raw, /I looked/);
});

test('empty reply is reported as empty, not as zero findings', () => {
  const r = extractPanelFindings({ text: '' });
  assert.equal(r.findings, null);
  assert.equal(r.parsed, 'empty');
});
