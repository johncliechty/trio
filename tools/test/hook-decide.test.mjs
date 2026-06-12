// Wave-4 (Phase B) tests: the PURE rule-enforcing PreToolUse guard.
//
// Two gated parts, both deterministic and STRICTLY OFFLINE (pure-function + filesystem-path
// math only — no agent(), no API/live call, no spawn):
//   1. hookDecide(payload, context): synthetic PreToolUse payloads -> correct deny/ask/allow + audit.
//   2. static scope: the install target resolves OUTSIDE the repo root, AND the pure guard denies
//      an Edit whose path matches the hook's own glob.
//
// (Actual harness ENFORCEMENT — the live PreToolUse block blocking a real violation — is an
// attended proof on the human checklist, NOT asserted here, per the plan.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  hookDecide,
  hookInstallTarget,
  isOutsideRepo,
  matchesAnyGlob,
  HOOK_GUARD_GLOBS,
  toClaudeHookOutput,
  REPO_ROOT,
} from '../hook-guard.mjs';

// ---------------------------------------------------------------------------
// Part 1 — hookDecide: synthetic payloads -> typed decision + audit
// ---------------------------------------------------------------------------

test('git merge main WITHOUT a GO token -> deny + audit entry', () => {
  const r = hookDecide({ tool_name: 'Bash', tool_input: { command: 'git merge main' } });
  assert.equal(r.decision, 'deny');
  assert.equal(r.rule, 'main-merge-no-go');
  assert.ok(r.audit && r.audit.includes('DENY'), 'a deny carries an audit line');
});

test('git push origin main WITHOUT a GO token -> deny', () => {
  const r = hookDecide({ tool_name: 'Bash', tool_input: { command: 'git push origin main' } });
  assert.equal(r.decision, 'deny');
  assert.equal(r.rule, 'main-merge-no-go');
  assert.ok(r.audit);
});

test('git merge main WITH a GO token (context.go) -> allow, and the override still appends an audit line', () => {
  const r = hookDecide({ tool_name: 'Bash', tool_input: { command: 'git merge main' } }, { go: true });
  assert.equal(r.decision, 'allow');
  assert.equal(r.override, true, 'an authorized merge is flagged as an override');
  assert.ok(r.audit && r.audit.includes('override'), 'override is never silent — it appends an audit line');
});

test('an in-command GO sentinel also authorizes the main merge', () => {
  const r = hookDecide({ tool_name: 'Bash', tool_input: { command: 'TRIO_GO=1 git push origin main' } });
  assert.equal(r.decision, 'allow');
  assert.equal(r.override, true);
});

test('a benign Bash command -> allow with no audit (guard is OFF for what it does not own)', () => {
  const r = hookDecide({ tool_name: 'Bash', tool_input: { command: 'ls -la' } });
  assert.equal(r.decision, 'allow');
  assert.equal(r.rule, null);
  assert.equal(r.audit, null, 'a plain allow carries no audit line');
  assert.equal(r.override, false);
});

test('a non-merge git push to a feature branch is NOT blocked', () => {
  const r = hookDecide({ tool_name: 'Bash', tool_input: { command: 'git push origin foreman/hardening-v3' } });
  assert.equal(r.decision, 'allow');
});

test('a non-dry DESTRUCTIVE apply (rm -rf) -> ask + audit', () => {
  const r = hookDecide({ tool_name: 'Bash', tool_input: { command: 'rm -rf build/' } });
  assert.equal(r.decision, 'ask');
  assert.equal(r.rule, 'destructive-apply');
  assert.ok(r.audit && r.audit.includes('ASK'));
});

test('git reset --hard -> ask (destructive)', () => {
  const r = hookDecide({ tool_name: 'Bash', tool_input: { command: 'git reset --hard HEAD~1' } });
  assert.equal(r.decision, 'ask');
  assert.equal(r.rule, 'destructive-apply');
});

test('the SAME destructive command marked --dry-run -> allow (no real mutation)', () => {
  const r = hookDecide({ tool_name: 'Bash', tool_input: { command: 'rm -rf build/ --dry-run' } });
  assert.equal(r.decision, 'allow');
});

test('editing a *.test.mjs DURING a Foreman fix step -> deny', () => {
  const r = hookDecide(
    { tool_name: 'Edit', tool_input: { file_path: 'tools/test/hook-decide.test.mjs' } },
    { foremanFixStep: true },
  );
  assert.equal(r.decision, 'deny');
  assert.equal(r.rule, 'fix-step-gate-edit');
  assert.ok(r.audit);
});

test('editing the gate-inventory manifest DURING a fix step -> deny', () => {
  const r = hookDecide(
    { tool_name: 'Write', tool_input: { file_path: 'tools/gate-inventory.manifest.json' } },
    { foremanFixStep: true },
  );
  assert.equal(r.decision, 'deny');
  assert.equal(r.rule, 'fix-step-gate-edit');
});

test('editing a *.test.mjs OUTSIDE a fix step is NOT blocked by the fix-step rule', () => {
  const r = hookDecide({ tool_name: 'Edit', tool_input: { file_path: 'tools/test/hook-decide.test.mjs' } }, {});
  assert.equal(r.decision, 'allow');
});

test('a malformed payload (no tool_name) -> fail-safe ASK (never a silent allow)', () => {
  for (const bad of [null, undefined, {}, { tool_input: { command: 'git merge main' } }, 'garbage', 42]) {
    const r = hookDecide(bad);
    assert.equal(r.decision, 'ask', `malformed payload ${JSON.stringify(bad)} fails safe to ASK`);
    assert.equal(r.rule, 'fail-safe');
  }
});

test('hookDecide is DETERMINISTIC — identical input yields byte-identical output', () => {
  const payload = { tool_name: 'Bash', tool_input: { command: 'git merge main' } };
  const a = hookDecide(payload);
  const b = hookDecide(payload);
  assert.deepEqual(a, b);
  // every decision is typed with the documented shape
  for (const k of ['decision', 'rule', 'reason', 'audit', 'override']) {
    assert.ok(k in a, `decision record exposes the typed field "${k}"`);
  }
  assert.ok(['allow', 'ask', 'deny'].includes(a.decision), 'decision is one of allow|ask|deny');
});

test('toClaudeHookOutput maps the typed decision onto the Claude Code PreToolUse shape', () => {
  const out = toClaudeHookOutput(hookDecide({ tool_name: 'Bash', tool_input: { command: 'git merge main' } }));
  assert.equal(out.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.ok(typeof out.hookSpecificOutput.permissionDecisionReason === 'string');
});

// ---------------------------------------------------------------------------
// Part 2 — static scope: install target OUTSIDE the repo; self-protection deny
// ---------------------------------------------------------------------------

test('the resolved install target is OUTSIDE the repo root (a build agent cannot reach its own guard)', () => {
  const home = path.join(path.parse(REPO_ROOT).root, 'tmp-fixture-home-trio-guard');
  const target = hookInstallTarget({ home });
  assert.ok(isOutsideRepo(target.script, REPO_ROOT), `${target.script} resolves outside ${REPO_ROOT}`);
  assert.ok(isOutsideRepo(target.settings, REPO_ROOT), `${target.settings} resolves outside ${REPO_ROOT}`);
  // and it is genuinely under the user-level ~/.claude tree
  assert.ok(target.script.includes(path.join('.claude', 'hooks')), 'installs under ~/.claude/hooks');
});

test('the pure guard DENIES an Edit whose path matches the hook glob (self-protection)', () => {
  const home = path.join(path.parse(REPO_ROOT).root, 'tmp-fixture-home-trio-guard');
  const target = hookInstallTarget({ home });

  // sanity: the installed settings path is one the hook glob recognizes as its own
  assert.ok(matchesAnyGlob(target.settings, HOOK_GUARD_GLOBS), 'settings.json matches the guard glob');

  const r = hookDecide({ tool_name: 'Edit', tool_input: { file_path: target.settings } });
  assert.equal(r.decision, 'deny');
  assert.equal(r.rule, 'guard-self-protection');
  assert.ok(r.audit);
});

test('self-protection denies editing the installed guard script too (even without a fix step)', () => {
  const home = path.join(path.parse(REPO_ROOT).root, 'tmp-fixture-home-trio-guard');
  const { script } = hookInstallTarget({ home });
  const r = hookDecide({ tool_name: 'Edit', tool_input: { file_path: script } }, {});
  assert.equal(r.decision, 'deny');
  assert.equal(r.rule, 'guard-self-protection');
});
