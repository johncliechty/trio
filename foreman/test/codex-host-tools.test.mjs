import test from 'node:test';
import assert from 'node:assert/strict';
import { _internals as prompts } from '../bin/wave-workflow.js';

function withHost(env, fn) {
  const keys = ['FOREMAN_CODEX_CONPTY', 'CODING_FAMILY', 'TRIO_DRIVER_EXECUTE', 'TRIO_DRIVER_FIX'];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) {
      if (env[key] == null) delete process.env[key];
      else process.env[key] = env[key];
    }
    return fn();
  } finally {
    for (const key of keys) {
      if (saved[key] == null) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

const ctx = {
  wave:{n:4,title:'Checker'},projectDir:'.',iteration:1,
  planText:'## Wave 4 — Checker\n**Deliverables:** lib/t0.mjs\n**done-when:** named tests pass\n',
};
const gate = {artifact_path:'.foreman/wave-4-gate.json',exit_code:1,tap:{pass:78,tests:79}};

test('ordinary hosts and incomplete opt-ins preserve the terminal-command ban', () => {
  for (const env of [
    {}, {CODING_FAMILY:'chatgpt'}, {FOREMAN_CODEX_CONPTY:'1'},
    {FOREMAN_CODEX_CONPTY:'1',CODING_FAMILY:'claude'},
    {FOREMAN_CODEX_CONPTY:'0',CODING_FAMILY:'chatgpt'},
  ]) {
    withHost(env, () => {
      for (const prompt of [prompts.executePrompt(ctx),prompts.fixPrompt(ctx,gate,[])]) {
        assert.match(prompt,/Do NOT run any git commands, terminal commands, or tests yourself/);
        assert.doesNotMatch(prompt,/may use batched terminal/);
      }
    });
  }
});

test('explicit ConPTY Codex authoring can read files while git, tests and process workloads remain orchestrator-owned', () => {
  withHost({FOREMAN_CODEX_CONPTY:'1',CODING_FAMILY:'chatgpt'}, () => {
    for (const prompt of [prompts.executePrompt(ctx),prompts.fixPrompt(ctx,gate,[])]) {
      assert.match(prompt,/when dedicated file tools are absent/);
      assert.match(prompt,/may use batched terminal commands only to read\/search/);
      assert.match(prompt,/within the authorized project workspace/);
      assert.match(prompt,/Do NOT run git commands, tests, installs, servers/);
      assert.doesNotMatch(prompt,/Do NOT run any git commands, terminal commands/);
    }
    assert.match(prompts.executePrompt(ctx),/do not weaken or delete tests/);
    assert.match(prompts.fixPrompt(ctx,gate,[]),/TESTS ARE FROZEN/);
  });
});

test('a seat routed to the headless chatgpt-cli driver is a Codex host: it may read/edit by terminal, never git/tests (2026-10-05)', () => {
  withHost({TRIO_DRIVER_EXECUTE:'chatgpt-cli',TRIO_DRIVER_FIX:'chatgpt-cli'}, () => {
    for (const prompt of [prompts.executePrompt(ctx),prompts.fixPrompt(ctx,gate,[])]) {
      assert.match(prompt,/may use batched terminal commands only to read\/search/);
      assert.match(prompt,/Do NOT run git commands, tests, installs, servers/);
    }
  });
  withHost({TRIO_DRIVER_EXECUTE:'claude',TRIO_DRIVER_FIX:'claude',CODING_FAMILY:'chatgpt'}, () => {
    assert.match(prompts.executePrompt(ctx),/Do NOT run any git commands, terminal commands, or tests yourself/);
  });
  withHost({TRIO_DRIVER_EXECUTE:'chatgpt-cli',TRIO_DRIVER_FIX:'claude'}, () => {
    assert.match(prompts.executePrompt(ctx),/may use batched terminal/);
    assert.match(prompts.fixPrompt(ctx,gate,[]),/Do NOT run any git commands, terminal commands/);
  });
});

test('the authoring host opt-in never changes a verification prompt', () => {
  const ordinary = withHost({}, () => prompts.reviewPrompt(ctx,gate));
  const codex = withHost({FOREMAN_CODEX_CONPTY:'1',CODING_FAMILY:'chatgpt'}, () => prompts.reviewPrompt(ctx,gate));
  assert.equal(codex,ordinary);
  assert.match(codex,/INDEPENDENT, READ-ONLY reviewer/);
});
