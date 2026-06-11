#!/usr/bin/env node
// tools/gemini-key-smoke.mjs — Phase 0.1 backup-auth smoke.
//
// Proves the trio's Gemini host keeps working past the 2026-06-18 consumer-login sunset
// by authenticating via GEMINI_API_KEY (the approved backup auth) instead of login. It
// drives the REAL shipped gemini-cli driver transport (defaultRunGeminiCli) so the smoke
// exercises the production spawn + SR-5 served-model attestation seam, not a bespoke call.
//
//   node tools/gemini-key-smoke.mjs            # one tiny key-active `gemini -p` call
//
// Exit 0  = key present AND a served model was attested from the envelope (SR-5).
// Exit 2  = GEMINI_API_KEY not set (the human must export it — this is the 0.1 blocker).
// Exit 1  = the call ran but no served model could be attested (degraded) / failed.

import { defaultRunGeminiCli } from '../drivers/gemini-cli.mjs';

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('0.1 SMOKE BLOCKED: GEMINI_API_KEY is not set in this process.');
    console.error('Set it (user-level or `$env:GEMINI_API_KEY=...` in this session), then re-run.');
    return 2;
  }
  // The live transport is env-gated; enable it just for this attended smoke.
  process.env.CRUCIBLE_AGENT_LIVE = '1';

  console.error('0.1 SMOKE: one key-active `gemini -p` call (backup auth, not consumer login)…');
  const { text, rec } = await defaultRunGeminiCli(
    'Reply with the single word: ok',
    'gemini-key-smoke',
    { timeoutMs: 90_000, log: (m) => console.error(m) },
  );

  console.error(`  status=${rec.status ?? rec.ok} served=${rec.model_served} attested=${rec.model_attested} reply=${JSON.stringify((text || '').slice(0, 40))}`);

  if (rec.model_attested === true && rec.model_served) {
    console.error(`0.1 SMOKE PASS: backup auth works — served model "${rec.model_served}" attested (SR-5).`);
    return 0;
  }
  console.error('0.1 SMOKE FAIL: the call did not attest a served model (auth failed or envelope degraded).');
  console.error(`  rec=${JSON.stringify(rec)}`);
  return 1;
}

main().then((code) => process.exit(code)).catch((e) => { console.error('0.1 SMOKE ERROR:', e?.message ?? e); process.exit(1); });
