# 0004 — Tidy polish W5 reviewer JSON abstain → ambiguity HALT

- **id:** 0004
- **skill:** foreman
- **situation:** Wave 5 after green gate; grok-cli review seat.
- **context:** review:w5#0 not valid JSON after one retry → ABSTAIN answerable:no → ambiguity HALT. Gate was fine. Product waves 1–4 already GO.
- **outcome:** friction
- **provenance:** genuine-execution
- **fix (same day):** `drivers/grok-cli.mjs` — unparseable *review* replies map to `transport_failed` (T10a degrade) instead of `answerable:no` ambiguity HALT.
