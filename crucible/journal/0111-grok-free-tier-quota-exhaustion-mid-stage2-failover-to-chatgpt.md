# 0111 - Grok Build Free-Tier Quota Exhaustion Mid-Stage-2 Classified as `protocol_error` & Failover to `chatgpt-cli`
id: 0111-grok-free-tier-quota-exhaustion-mid-stage2-failover-to-chatgpt
skill: crucible
situation: During Crucible Stage-2 verification (`runPlanElegancePass` + `runWaveCountPass` + Shark review) for the Anchor system-wide overhaul (`C:\dev\Anchor\planning\anchor-overhaul-2026-11-12`), `grok-cli` (`grok-4.7` at `xhigh`) hit the xAI free-tier usage cap mid-turn (`Error: You've reached your free Grok Build usage limit for now. Get SuperGrok for much higher limits, or try again later`).
context: Windows 11 host (`PUTER`), `C:\dev\trio` + `C:\dev\Anchor`, Gemini 4 Carbon primary planner session, `grok-cli` free tier exhausted after 10 agent turns (`725,844` total tokens), `chatgpt-cli` (`gpt-6-luna` `high`) healthy and authenticated.
observation: `subscription-outcome.mjs` classified Grok's `"reached your free Grok Build usage limit"` stderr as `status: "protocol_error"` (`replay_safe: false`) rather than `quota_error` / `rate_limit`, aborting `Promise.all` across the Stage-2 verification bundle.
outcome: worked - failed over Stage-2 Catcher, Adversary, RC-8, and Shark seats to independent fresh-context `chatgptCliDriver` (`gpt-6-luna`, `reasoningEffort: "high"`) invocations, preserving genuine cross-family verification (`Gemini 4 Carbon` planner vs. `OpenAI GPT-6-Luna` reviewers).
provenance: genuine-execution - live Crucible Stage-2 run on `C:\dev\Anchor\planning\anchor-overhaul-2026-11-12` (`2026-11-13`).

## 1. Root Cause Analysis

1. **Unmatched Quota String in `subscription-outcome.mjs`:**
   - Grok CLI (`grok.exe`) exits with code `1` and stderr `"Error: You’ve reached your free Grok Build usage limit for now. Get SuperGrok for much higher limits, or try again later"` (with curly apostrophe `’`).
   - Because that message was not matched as a quota/allowance exhaustion pattern, `classifySubscriptionOutcome()` labelled it `protocol_error` with `replay_safe: false`.
2. **Parallel `Promise.all` Short-Circuit:**
   - Running Grok Catcher and ChatGPT Shark inside an unguarded `Promise.all` caused Grok's quota exhaustion to reject the combined promise before ChatGPT's completed review was persisted.

## 2. Remedy & Operational Rule

1. **Route Cross-Family Verification to Healthy Quota-Backed `chatgpt-cli` (`gpt-6-luna` `high`) When `grok-cli` Hits Usage Cap:**
   - When the primary planner/builder session is Gemini (`Gemini 4 Carbon`), fresh-context `chatgpt-cli` (`gpt-6-luna`, `reasoningEffort: "high"`) provides full cross-family adversarial independence across Stage-2 Elegance, RC-8, and Foreman wave diff reviews without hitting Grok Build's free-tier ceiling.
2. **Future Trio Driver Enhancement:**
   - Add `/reached your (?:free )?Grok Build usage limit/i` to `subscription-outcome.mjs`'s `quota_exceeded` classifier (`replay_safe: true` onto alternate healthy seat).
