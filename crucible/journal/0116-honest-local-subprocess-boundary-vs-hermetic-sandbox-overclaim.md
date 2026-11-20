# 0116 - Cross-Family L2 Catch: Narrowing Overclaimed "Hermetic OS Sandbox" to Honest `consented_local_subprocess`
id: 0116-honest-local-subprocess-boundary-vs-hermetic-sandbox-overclaim
skill: crucible
situation: `matrix:delta-verify` (`gpt-6-luna` cross-family reviewer) halted `runMatrixFastTrack` because `matrix:revise` claimed an "OS-enforced sandbox" via Windows Restricted Token + Job Object + POSIX `RLIMIT` + `sys.addaudithook`.
context: `C:\dev\trio\crucible\bin\matrix-fast-track.mjs` (`L1/L2` security matrix + `delta-verify`).
observation: `gpt-6-luna` rightly noted that Windows Restricted Tokens/Job Objects, POSIX `RLIMIT`, and Python `sys.addaudithook` do not enforce kernel-level filesystem, credential, or network isolation against arbitrary code, and instructed: "Specify and verify OS-enforced filesystem, credential, network, and process isolation, or narrow the hermetic-trace claim."
outcome: worked - replaced the overclaimed "hermetic OS sandbox" wording across Stage-0, North Star, and Wave 1–3 contracts with the honest `isolation_boundary: "consented_local_subprocess"` boundary (`--approve-run` explicit operator consent + isolated scratch copy + `EXECUTION_POLICY` `argv` allowlist + `shell=False` + scrubbed credential env + process-tree timeout termination + explicit non-VM warning for untrusted code), simultaneously simplifying Wave 1 per Gandalf L5.
provenance: genuine-execution - Anvil v4 Crucible Matrix-Fast-Track live run (`2026-11-17T19:06-07:00`).
