# 0036: Wave 1 test immutability halt

**id:** 0036
**skill:** foreman
**situation:** Foreman halted on wave 1 with a `test-immutability` HALT.
**context:** The execute agent failed to add a required test (`test/wave-1.test.js`) during Wave 1. The gate naturally failed. The fix agent in iter 1 then attempted to create the missing test to satisfy the gate.
**observation:** Foreman's strict test-immutability rule caught the fix agent trying to add a test file. The orchestrator enforced the rule that FIX agents may only change non-test code, as tests are the EXECUTE agent's deliverable.
**outcome:** friction | HALT. The run safely stopped to prevent test-weakening/reward-hacking.
**provenance:** genuine-execution
