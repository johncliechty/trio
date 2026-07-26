# 0080 — Ecgberht W2 review unparseable JSON HALT + resume

- **id**: 0080-ecgberht-w2-review-json-halt-resume
- **skill**: foreman@2026-07-24
- **situation**: gate GREEN but single reviewer reply not valid JSON after retry → taxonomy:ambiguity HALT
- **context**: C:\dev\Ecgberht wave 2; 18/18 tests; pending_action review:w2#0; resume --clear-halt
- **observation**: W2 execute+gate green; review path failed parse (same friction family as Crucible revise JSON). Operator shepherds resume with --resume --clear-halt so wave re-proves at gate rather than re-running W1. Do not treat as product blocker in frozen docs.
- **outcome**: friction
- **provenance**: genuine-execution
