# 0003 — Tidy polish W5 skip inventory false positive

- **id:** 0003
- **skill:** foreman
- **situation:** Wave 5 panel-render fixtures; gate 492 pass 1 fail/skip.
- **context:** Anti-weakening skip inventory matched `test.skip` inside a *meta* assert that bans skip in oracle files. Plus host topology t.skip (actuallySkipped>0) → HALT. Fixed assert encoding; resume.
- **outcome:** friction
- **provenance:** genuine-execution
