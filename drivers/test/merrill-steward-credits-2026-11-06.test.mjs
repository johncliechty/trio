import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { classifySubscriptionOutcome } from '../subscription-outcome.mjs';
import {
  DEFAULT_POLICY,
  resolveModelPolicy,
  clearModelPolicyCache,
  modelLaunchArgs,
} from '../model-policy.mjs';
import {
  defaultRunClaude,
  parseClaudeFrames,
  isClaudeModelCreditGate,
} from '../claude.mjs';

const SESSION = 'req_011Cgmth9hwtKWM2QCnFppax';
const MERRILL_CREDITS_MSG =
  'Fable 5.1 requires usage credits. Switch to another model, or manage usage credits at https://claude.ai/admin-settings/usage, to continue.';

const jsonl = (...frames) => frames.map((f) => JSON.stringify(f)).join('\n') + '\n';

test('Merrill reproduction: classifySubscriptionOutcome recognizes credits_required (2-frame and 3-frame synthetic)', () => {
  const initFrame = {
    type: 'system',
    subtype: 'init',
    session_id: SESSION,
    model: 'claude-fable-5-1',
  };
  const syntheticAssistant = {
    type: 'assistant',
    session_id: SESSION,
    api_error_status: 429,
    api_error_code: 'credits_required',
    message: {
      model: '<synthetic>',
      content: [{ type: 'text', text: MERRILL_CREDITS_MSG }],
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  };
  const resultFrame = {
    type: 'result',
    subtype: 'success',
    is_error: true,
    session_id: SESSION,
    num_turns: 1,
    result: MERRILL_CREDITS_MSG,
    api_error_status: 429,
    api_error_code: 'credits_required',
    usage: { input_tokens: 0, output_tokens: 0 },
  };

  const twoFrame = classifySubscriptionOutcome({
    family: 'claude',
    stdout: jsonl(initFrame, { ...resultFrame, num_turns: 0, subtype: 'error_during_execution' }),
    stderr: '',
    code: 1,
    terminal: 'closed',
    kill_status: null,
    spawned: true,
  });
  assert.equal(twoFrame.failure_status, 'usage_limit');
  assert.equal(twoFrame.replay_safe, true);

  const threeFrame = classifySubscriptionOutcome({
    family: 'claude',
    stdout: jsonl(initFrame, syntheticAssistant, resultFrame),
    stderr: '',
    code: 1,
    terminal: 'closed',
    kill_status: null,
    spawned: true,
  });
  assert.equal(threeFrame.failure_status, 'usage_limit');
  assert.equal(threeFrame.replay_safe, true);
});

test('Merrill reproduction: parseClaudeFrames preserves credits_required error text and api_error_code', () => {
  const stdout = jsonl(
    { type: 'system', subtype: 'init', session_id: SESSION, model: 'claude-fable-5-1' },
    {
      type: 'result',
      subtype: 'success',
      is_error: true,
      session_id: SESSION,
      num_turns: 1,
      result: MERRILL_CREDITS_MSG,
      api_error_status: 429,
      api_error_code: 'credits_required',
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  );
  const { rec, _finalEnv } = parseClaudeFrames(stdout, {
    label: 'Ecgberht:conversational',
    cli_status: 1,
    requested_model: 'best',
  });
  assert.equal(rec.ok, false);
  assert.equal(rec.error, MERRILL_CREDITS_MSG);
  assert.equal(rec.api_error_code, 'credits_required');
  assert.equal(rec.api_error_status, 429);
  assert.equal(isClaudeModelCreditGate(rec, _finalEnv), true);
});

test('Merrill reproduction: resolveModelPolicy honors provider_preferences.quality.claude.model = "sonnet"', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'trio-merrill-prefs-'));
  t.after(() => {
    clearModelPolicyCache();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const mirror = path.join(directory, '.anchor', 'model_prefs.json');
  fs.mkdirSync(path.dirname(mirror), { recursive: true });
  fs.writeFileSync(
    mirror,
    JSON.stringify({
      coding_family: 'claude',
      review_family: 'claude',
      default_cli: 'claude',
      model_policy: { ...DEFAULT_POLICY },
      settings_revision: 5,
      provider_preferences: {
        quality: {
          claude: { model: 'sonnet', effort: 'high' },
        },
      },
    }),
    'utf8',
  );
  const fakeBin = path.join(directory, 'bin');
  fs.mkdirSync(fakeBin, { recursive: true });
  const exeName = process.platform === 'win32' ? 'claude.exe' : 'claude';
  fs.writeFileSync(path.join(fakeBin, exeName), 'stub', 'utf8');

  const env = {
    USERPROFILE: directory,
    HOME: directory,
    PATH: fakeBin,
    ANCHOR_DATA_DIR: path.join(directory, 'anchor-data'),
  };
  const discoverer = () => '--effort <level> (low, medium, high, xhigh, max)\n';
  const resolved = resolveModelPolicy('claude', { env, discoverer, force: true });
  assert.equal(resolved.model, 'sonnet');
  assert.equal(resolved.effort, 'high');
  assert.equal(resolved.selection_evidence, 'explicit_setup_choice');
  assert.deepEqual(modelLaunchArgs(resolved), ['--model', 'sonnet', '--effort', 'high']);
});

test('Merrill reproduction: defaultRunClaude automatically falls back best -> opus -> sonnet on credits_required', async () => {
  const seenModels = [];
  const creditErrorStdout = jsonl(
    { type: 'system', subtype: 'init', session_id: SESSION, model: 'claude-fable-5-1' },
    {
      type: 'result',
      subtype: 'success',
      is_error: true,
      session_id: SESSION,
      num_turns: 1,
      result: MERRILL_CREDITS_MSG,
      api_error_status: 429,
      api_error_code: 'credits_required',
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  );
  const sonnetSuccessStdout = jsonl(
    { type: 'system', subtype: 'init', session_id: SESSION, model: 'claude-sonnet-4-6' },
    {
      type: 'assistant',
      session_id: SESSION,
      message: {
        model: 'claude-sonnet-4-6',
        content: [{ type: 'text', text: '{"say":"Hello Merrill, I am ready to help."}' }],
      },
    },
    {
      type: 'result',
      subtype: 'success',
      is_error: false,
      session_id: SESSION,
      num_turns: 1,
      model: 'claude-sonnet-4-6',
      result: '{"say":"Hello Merrill, I am ready to help."}',
      usage: { input_tokens: 12, output_tokens: 10 },
    },
  );

  const out = await defaultRunClaude('Hello Steward', 'Ecgberht:conversational', {
    env: { CRUCIBLE_AGENT_LIVE: '1' },
    role: 'conversational',
    policyResolver: () => ({
      family: 'claude',
      model: 'best',
      effort: 'max',
      selection_evidence: 'provider_moving_alias',
    }),
    processRunner: async (req) => {
      const mIdx = req.args.indexOf('--model');
      const m = mIdx !== -1 ? req.args[mIdx + 1] : null;
      seenModels.push(m);
      if (m === 'best' || m === 'opus') {
        return {
          stdout: creditErrorStdout,
          stderr: '',
          code: 1,
          terminal: 'closed',
          kill_status: null,
          spawned: true,
        };
      }
      return {
        stdout: sonnetSuccessStdout,
        stderr: '',
        code: 0,
        terminal: 'closed',
        kill_status: null,
        spawned: true,
      };
    },
  });

  assert.deepEqual(seenModels, ['best', 'opus', 'sonnet']);
  assert.equal(out.rec.ok, true);
  assert.equal(out.rec.requested_model, 'sonnet');
  assert.equal(out.rec.fallback_from_model, 'best');
  assert.deepEqual(out.rec.attempted_models, ['best', 'opus', 'sonnet']);
  assert.equal(out.rec.model_served, 'claude-sonnet-4-6');
  assert.match(out.text, /Hello Merrill/);
});

test('Merrill reproduction: when all fallback models require credits, rec.error preserves the exact Fable 5.1 message', async () => {
  const seenModels = [];
  const creditErrorStdout = jsonl(
    { type: 'system', subtype: 'init', session_id: SESSION, model: 'claude-fable-5-1' },
    {
      type: 'result',
      subtype: 'success',
      is_error: true,
      session_id: SESSION,
      num_turns: 1,
      result: MERRILL_CREDITS_MSG,
      api_error_status: 429,
      api_error_code: 'credits_required',
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  );

  const out = await defaultRunClaude('Hello Steward', 'Ecgberht:conversational', {
    env: { CRUCIBLE_AGENT_LIVE: '1' },
    role: 'conversational',
    policyResolver: () => ({
      family: 'claude',
      model: 'best',
      effort: 'max',
      selection_evidence: 'provider_moving_alias',
    }),
    processRunner: async (req) => {
      const mIdx = req.args.indexOf('--model');
      seenModels.push(mIdx !== -1 ? req.args[mIdx + 1] : null);
      return {
        stdout: creditErrorStdout,
        stderr: '',
        code: 1,
        terminal: 'closed',
        kill_status: null,
        spawned: true,
      };
    },
  });

  assert.deepEqual(seenModels, ['best', 'opus', 'sonnet']);
  assert.equal(out.rec.ok, false);
  assert.equal(out.rec.status, 'usage_limit');
  assert.equal(out.rec.error, MERRILL_CREDITS_MSG);
  assert.deepEqual(out.rec.attempted_models, ['best', 'opus', 'sonnet']);
});
