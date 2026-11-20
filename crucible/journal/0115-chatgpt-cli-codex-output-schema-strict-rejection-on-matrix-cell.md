# 0115 - `chatgpt-cli` Strict `--output-schema` Rejection on `MATRIX_CELL_REVIEW_SCHEMA` (`CODEX_OUTPUT_SCHEMA=0` Fix)
id: 0115-chatgpt-cli-codex-output-schema-strict-rejection-on-matrix-cell
skill: crucible
situation: Live `runMatrixFastTrack` passed `matrix:stage0-frame` and `matrix:draft`, then failed closed on `matrix:L0-L5:northstar-simplicity` (`chatgpt-cli cli_error. stderr=`).
context: `C:\dev\trio\drivers\chatgpt-cli.mjs` (`--output-schema`) and `C:\dev\trio\crucible\bin\matrix-fast-track.mjs` (`MATRIX_CELL_REVIEW_SCHEMA`).
observation: `chatgpt-cli.mjs` writes `jsonSchema` verbatim to `--output-schema <tmp.json>` unless `CODEX_OUTPUT_SCHEMA=0`, and OpenAI's Structured Outputs API rejects schemas without `additionalProperties: false` and all-properties-required (`MATRIX_CELL_REVIEW_SCHEMA` has optional `fix` and union `traces_to_north_star`) with an HTTP 400 JSONL `turn.failed` frame on stdout (`stderr=""`).
outcome: worked - set `CODEX_OUTPUT_SCHEMA=0` so `chatgpt-cli` uses prompt-embedded JSON schema + `runCliSchemaAttempts` (`conformsJsonSchema`), verified live in 6s (`ok: true, family: "chatgpt", family_attested: true`).
provenance: genuine-execution - Anvil v4 Crucible Matrix-Fast-Track live run (`2026-11-17T18:52-07:00`).
