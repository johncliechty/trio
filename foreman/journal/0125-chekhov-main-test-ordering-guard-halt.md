- id: 0125
- skill: foreman
- situation: main's over-specified regression caused an unnecessary ordering fix and an in-flight test-immutability HALT
- context: Chekhov W6 line-replay run2026-09-08T19:46:50.001Z to19:51:44Z; Astra ultra coding requested; no Grok review reached in this run; cap3/max-waves1/gitfalse.
- observation: Fix2 correctly added optional scene.line binding. My positive test wrongly required physical scene order although tuples are canonically ID-sorted; gate128/127/1 failed19:49:41. Main corrected only its new assertion during fix3, triggering the correct immutability guard despite128/128GREEN19:51:44. The test edit was MAIN's, not the coder's. The coder's one-line source-order workaround was unnecessary and main restored the original empty-sidecar serialization after HALT; the actual line matcher and docs stay. Frozen W6:214 requires candidate-only per-scene replay and insert-only writes, not array order; both values/IDs/receipt lines and prose byte identity remain asserted.
- outcome: friction
- provenance: genuine-execution

Next: normal --resume --clear-halt, cap3 unchanged, establishes the corrected static test baseline and re-proves gate/review; no guard bypass or checkpoint edit. Main-owned test maintenance must occur between runs, never inside FIX. This and the paired positive/negative-test lesson are future formal Foreman tickets, not authority to patch skill scripts. Machine companion: Chekhov/journal/runs/2026-09-08T19-46-00Z-codex-w6-line-replay.json. No quota failure or unexplained worker death.
