# 0091 — Gate-scope blind spot: plan-declared gates green while the shippable bundle could not start

- **id**: 0091-gate-scope-blindspot-ship-family
- **date**: 2026-07-29
- **run context**: Anchor `foreman/sleep-2026-07-28` (doctor-ui W13–W22, grok-cli driver, Gemini review) + share-canonical-onboard (8/8 GO, gate `pytest -k share_`). Post-run operator-directed verification (Fable session) re-ran a WIDER family (`-k "share_ or startup or distro"`).
- **what the run did well**: 30 waves total across two plans, all committed GREEN with growing gate counts; honest HALT/advance notes in EXECUTION-LOG (e.g. "review seat unparseable JSON (HALT thrash); advanced after proven code+tests"); clean tree, no orphan lock.
- **the blind spot**: each plan's declared gate was scoped to its own feature family. Waves that ADDED modules imported by `anchor_gui` at module scope never ran the distro family — so the deny-by-default ship manifest silently lagged 17 modules behind and **the public bundle could not start**, plus 20 PII-scan hits accumulated in newly-shipped test files. Every wave was "green" by its own gate; the product was red.
- **STANDING RULES (Foreman planning + review)**:
  1. **Ship-family rider**: any wave whose diff touches files matched by the ship manifest (or adds a module import to a shipped module) must APPEND the distro/ship gate family to its wave gate — not replace, append. Crucible should encode this in the plan's test-command per wave; the reviewer should flag a shipped-file diff with no ship-family gate as a finding.
  2. **"Green" claims name their scope**: EXECUTION-LOG/status lines must state the gate EXPRESSION next to the count ("share_ 249/249"), so a narrow scope is visible at a glance instead of reading as product-green.
  3. **Review-seat JSON thrash** (grok-cli review seat emitting unparseable JSON → HALT-thrash → human advance): recurring; when the review seat fails to parse twice, fall back to the coding family's reviewer rather than burning fix-iterations (config-level fallback, not ad-hoc).
- **improvement candidates (skill-side)**: Foreman could auto-detect "diff touches manifest-matched file" and auto-append the ship gate; distro could expose a fast `--gate` subcommand (build+scan+import, no README) as a one-line wave gate.
- **provenance**: genuine-execution (operator-directed verification round; fixes in Anchor commits 543a908 + 4d3ed0c)
