# 0114 - `cli-schema.mjs` Missing `minItems` Rejected `MATRIX_DRAFT_SCHEMA` Fail-Closed Live
id: 0114-cli-schema-minitems-fail-closed-on-matrix-draft
skill: crucible
situation: Live `runMatrixFastTrack` (`matrix:draft`) rejected a valid 17 KB 3-wave JSON draft as `schema-nonconforming` and entered `#retry`.
context: `C:\dev\trio\drivers\cli-schema.mjs` (`SUPPORTED_SCHEMA_KEYS`, `schemaShapeIsSupported`, `valueConforms`) and `C:\dev\trio\crucible\bin\matrix-fast-track.mjs` (`MATRIX_DRAFT_SCHEMA`).
observation: `MATRIX_DRAFT_SCHEMA` declared `waves: { type: 'array', minItems: 1, ... }`, while `drivers/cli-schema.mjs` excluded `minItems` from `SUPPORTED_SCHEMA_KEYS`, causing `schemaShapeIsSupported(MATRIX_DRAFT_SCHEMA)` to return `false` fail-closed on every real CLI / `host-ipc` seat (`runCliSchemaAttempts`), whereas unit tests injected a stub `agent()` that bypassed `runCliSchemaAttempts`.
outcome: worked - added `minItems`, `maxItems`, `maximum`, and `additionalProperties` support to `drivers/cli-schema.mjs` and removed `timer.unref()` from `drivers/host-ipc.mjs` `sleep()`, restoring full `conformsJsonSchema` compatibility with `MATRIX_DRAFT_SCHEMA`.
provenance: genuine-execution - Anvil v4 Crucible Matrix-Fast-Track live run (`2026-11-17T18:48-07:00`).
