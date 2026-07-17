# Wave 10 Review Transport HALT

**Date:** 2026-07-16
**Skill:** researchPrime (Foreman build)

## The Friction
During Wave 10, after the `execute` phase completed and `fix` iteration 1 passed the tests (gate exit 0), the orchestrator attempted to invoke the `review` phase. It tried to spawn the review agents using the model identifier `"gemini-3.1-pro"` (as configured in `foreman.config.json`). However, the `agy` CLI rejected this identifier with a fatal error: `invalid --model "gemini-3.1-pro"`, stating that it was not recognized among the available models. This resulted in a `review transport HALT` (ALL 2 reviewer(s) unreachable/unparseable).

## The Fix
1. **Model Re-mapping:** I edited `foreman.config.json` to change the reviewer model identifier from the invalid `"gemini-cli:gemini-3.1-pro"` to the valid, high-tier `"gemini-cli:Gemini 3.1 Pro (High)"` to match the exact string required by the system's model registry.
2. **Resume:** Re-invoked the `run-live.mjs` orchestrator with `--resume` to retry the review phase using the correct model transport.
