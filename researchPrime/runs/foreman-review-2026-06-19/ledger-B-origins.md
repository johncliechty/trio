# LEDGER B — primary-origin verification (agent 2)

Sources (no paywalls):
- Anthropic "How we built our multi-agent research system" anthropic.com/engineering/built-multi-agent-research-system — Jun 13 2025
- Cognition (Walden Yan) "Don't Build Multi-Agents" cognition.ai/blog/dont-build-multi-agents — Jun 2025

## Evidence items
- ITEM 1 Anthropic parallelizes READ-ONLY research — rung OBSERVED. "lead agent spins up 3-5 subagents in parallel"; "cut research time by up to 90%". Independent, read-only search subagents. NOT parallel code-writing.
- ITEM 2 Anthropic self-reports coding less parallelizable — rung OBSERVED/CLAIMED (self-report). Quote: "most coding tasks involve fewer truly parallelizable tasks than research, and LLM agents are not yet great at coordinating... in real time." Qualifiers: "fewer" (not zero), "not yet" (capability-now, not law).
- ITEM 3 Cognition = conflicting implicit decisions — rung CLAIMED (reasoned principle + Flappy Bird anecdote, not a study). Principle 2 "Actions carry implicit decisions, and conflicting decisions carry bad results." Cause: assumptions "not prescribed upfront." GENERAL claim, coding is the worked example.
- ITEM 4 Independence: same-day (~Jun 13), framed as a clash ("Cognition vs Anthropic"). NO cross-citation either way. Convergent reasoning on the SAME mechanism (shared context/dependencies) reached independently. NOT a single-lineage bandwagon.
- ITEM 5 Nuance for bounded parallelism: Anthropic's disqualifier is "share the same context / many dependencies" => corollary: independent low-dependency subtasks ARE parallelizable. Cognition's failure mode is UNSHARED assumptions "not prescribed upfront" => prescribed-upfront interfaces attack the failure mode directly. Coda: Cognition shipped "Manage Devins" (~Mar 2026), coordinator over isolated Devin instances — walk-back toward bounded multi-agent coding (CLAIMED, secondary).

## Verdict
CORROBORATED (2 independent origins) that multi-agent degrades on shared-context/high-dependency work, and code is a strong instance.
But Foreman's wording OVER-CLAIMS: "least-parallelizable" is not stated by either; Anthropic is a PRO-parallel paper cited as anti-parallel witness; Cognition's claim is condition-laden (unspecified interfaces), not a blanket ban.
Both license BOUNDED parallelism under: independent subtasks · prescribed-upfront interfaces · low cross-agent dependency · synthesizing lead sharing full context. == exactly the AXIS relaxation conditions.
