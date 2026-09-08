import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runAgent, loadModelFamilies } from '../../drivers/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const stage = process.argv[2] || 'proposal';
if (!['proposal', 'patch'].includes(stage)) throw new Error('unknown review stage');
const proposal = fs.readFileSync(path.join(here, 'PROPOSAL.md'), 'utf8');
let patch = '';
if (stage === 'patch') {
  const r = spawnSync('git', ['diff', '--', 'drivers/chatgpt-cli.mjs', 'drivers/test/chatgpt-cli-seam.test.mjs', 'foreman/bin/wave-workflow.js', 'foreman/test/codex-host-tools.test.mjs'], {cwd:root,encoding:'utf8',windowsHide:true,shell:false});
  if (r.status !== 0) throw new Error(r.stderr);
  patch = r.stdout + '\nNEW TEST FILE:\n' + fs.readFileSync(path.join(root, 'foreman/test/codex-host-tools.test.mjs'), 'utf8');
}
const families = loadModelFamilies();
if (families.review !== 'grok') throw new Error('Review family changed; this cycle explicitly requires Grok');
process.env.CRUCIBLE_AGENT_LIVE = '1';
const started = new Date().toISOString();
console.log(`Grok ${stage} review started ${started}`);
let receipt = null;
try {
  const verdict = await runAgent({
    role:'judge', label:`chekhov-host-compat-${stage}`, target:root,
    prompt:`You are the independent Grok adversarial/JUDGE seat for a bounded formal Skill Foundry improvement. Refute scope creep, unsafe role widening and ineffective compatibility fixes. All evidence needed is embedded below; use NO tools, Bash, PowerShell, tests or file edits. This is the ${stage} gate. For proposal, decide whether it serves Foreman's North Star and stays strictly within the user-authorized change; for patch, attack the actual implementation against that proposal. Return passed=false for material objections, with concrete evidence. Do not invent extra product requirements.\n\n${proposal}\n\n${patch}`,
    schema: {
      type: 'object', required: ['passed', 'rationale', 'findings'],
      properties: {
        passed: {type: 'boolean'}, rationale: {type: 'string'},
        findings: {
          type: 'array', items: {
            type: 'object', required: ['severity', 'detail'],
            properties: {severity: {enum: ['BLOCKER', 'MAJOR', 'MINOR', 'NIT']}, detail: {type: 'string'}},
          },
        },
      },
    },
    onReceipt: async (r) => { receipt=r; fs.writeFileSync(path.join(here, `${stage}-receipt.json`),JSON.stringify(r,null,2)+'\n'); },
    log: (s) => console.log(s),
  });
  fs.writeFileSync(path.join(here, `${stage}-verdict.json`),JSON.stringify({started,ended:new Date().toISOString(),verdict,receipt},null,2)+'\n');
  console.log(JSON.stringify({verdict,served:receipt?.served}));
  process.exitCode=verdict.passed?0:3;
} catch(error) {
  fs.writeFileSync(path.join(here, `${stage}-error.json`),JSON.stringify({started,ended:new Date().toISOString(),error:String(error),receipt:error.receipt||receipt},null,2)+'\n');
  throw error;
}
