---
id: 0004
skill: foreman
situation: Repeating test immutability violation due to missing root package.json.
context: The Foreman fix agent continues to violate test immutability by creating `test/package.json` to resolve test module paths.
observation: The original EXECUTE agent failed to provision a root `package.json`. The FIX agent, correctly identifying a module resolution error, is attempting to patch the test suite directly rather than fixing the source code or root environment, causing repeated HALTs.
outcome: friction
provenance: genuine-execution
---

### Resolution
1. Deleted the unauthorized `test/package.json` again to enforce test immutability.
2. Cleared the orchestrator halt flag via `checkpoint.mjs clear`.
3. Re-invoked the build to force the agent into its remaining iterations, with the expectation that it must solve the dependency issue within the implementation source folder (e.g., `src/`) or at the root, rather than inside `test/`.
