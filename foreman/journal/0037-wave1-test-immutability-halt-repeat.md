# 0037: Wave 1 test immutability halt repeat

**id:** 0037
**skill:** foreman
**situation:** Foreman halted again on wave 1 with a `test-immutability` HALT during the fix loop.
**context:** After restarting the wave, the Execute agent successfully created a test (1 test executed), but it failed the gate. The Fix agent (iter 1) then attempted to modify or add another test file (`test/gate.test.mjs`) to make it pass, rather than fixing the underlying code.
**observation:** Foreman's strict test-immutability guard correctly caught the fix agent trying to alter test files. FIX agents are strictly bound to changing implementation code to satisfy the tests written by the EXECUTE agent.
**outcome:** friction | HALT. Run safely stopped again to prevent test-weakening.
**provenance:** genuine-execution
