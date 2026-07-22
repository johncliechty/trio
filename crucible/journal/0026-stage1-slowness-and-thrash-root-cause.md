# 0026 — Stage-1 “too long / thrashing”: root-cause investigation

See canonical copy: `C:\dev\trio\crucible\journal\0026-stage1-slowness-and-thrash-root-cause.md`

- **id:** 0026
- **skill:** crucible (+ trio grok-cli)
- **outcome:** friction
- **provenance:** genuine-execution

**Headline:** Slowness is mostly serial multi-minute agentic Grok calls (LITE doesn’t shrink brainstorm). Thrashing is process death + restart (operator kills misread as stuck + at least one parent-node death mid phased-plan with orphan grok). Checkpoints reached `triaged` before last death.
