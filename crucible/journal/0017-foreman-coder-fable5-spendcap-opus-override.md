---
id: 0017-foreman-coder-fable5-spendcap-opus-override
skill: crucible
---

- **id:** 0017-foreman-coder-fable5-spendcap-opus-override
- **skill:** crucible (Foreman build phase, tidy-idy GUI effort)
- **situation:** After hardening Wave 0, every Foreman coder call (execute + fix) returned class=error-result, code 1, 0 tools, 0 tokens in <1s — across two fresh resume processes ~1h apart. Looked like a hang/driver bug or rate limit.
- **context:** Build in C:\dev\skill-foundry-tidyidy-wt, branch foreman/tidy-idy-gui. run-live passes the prompt via STDIN (not argv, so not a Windows length limit). Reviewer (Gemini via agy) worked fine — only the claude-family coder failed.
- **observation:** A minimal replica `claude.exe -p ' ' --output-format stream-json --model claude-fable-5` returned a RESULT envelope with is_error=true: "You've hit your monthly spend limit ... keep using Fable 5 or switch models." So the coder was pinned to Fable 5 and John's Fable 5 MONTHLY SPEND LIMIT was exhausted — the first big execute spent the last of it, every call after failed. The pin came from GLOBAL env vars (CLAUDE_MODEL_EXECUTE=claude-fable-5, CLAUDE_MODEL_FIX=claude-fable-5) present in the shell — and run-live's "pre-set env always wins" rule meant a foreman.config.json `models` block set to opus was SILENTLY IGNORED.
- **outcome:** worked — John chose Opus 4.8; forced it by setting $env:CLAUDE_MODEL_EXECUTE/$env:CLAUDE_MODEL_FIX = claude-opus-4-8 in the PowerShell launch BEFORE go.ps1 (overrides both the global default and the config). Verified Opus has budget via the same minimal probe (is_error=false), then resume → model routing shows opus, coder live with real tool calls on Wave 2.
- **provenance:** genuine-execution
- **lesson:** A 0-token / is_error result envelope from `claude -p` is usually a SPEND-CAP or auth failure, not a hang — probe it with a 1-line call and read result.is_error/result text. And foreman.config.json `models` cannot override a pre-set CLAUDE_MODEL_<ROLE> env var (pre-set env wins); to change the coder model when the env pins it, set the env at launch. See [[usage-leak-2026-07-14]], [[feedback-heavy-vs-regular-skill-tiers]], [[0016-tidy-idy-build-wave0-git-pollution-hermeticity]].
