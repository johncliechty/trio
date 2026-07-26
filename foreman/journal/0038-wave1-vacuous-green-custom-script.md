**id**: 0038-wave1-vacuous-green-custom-script
**skill**: foreman
**situation**: Running Foreman for Anchor Doctor UI V2 using a custom python script as the test command.
**context**: The implementation plan declared `test-command: python anchor_healthcheck.py`.
**observation**: Foreman halted on wave 1 with a `vacuous-GREEN` error because the script exited 0 but did not emit standard test runner output (tests=none, pass=none). Foreman requires recognized test output (like pytest) to prove tests actually ran and passed.
**outcome**: halted
**provenance**: genuine-execution
