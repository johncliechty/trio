# 0103-ba815-overnight-7-artifacts-9-recoveries-coverage-checker-convention

- **id:** 0103-ba815-overnight-7-artifacts-9-recoveries-coverage-checker-convention
- **skill:** foreman@2026-08-17
- **situation:** Unattended overnight drive of a 7-wave content build (pptx/docx from spec) with a
  session-side cadence doing halt triage under a delegated narrow-technical-only authority.
- **context:** BA 815 revamp, `C:\dev\MBA Teaching AI\BA 815\Fall 2026` — five decks + two paper
  artifacts. End state: 5/7 waves closed, ALL 7 artifacts built + gated green with final figures.
- **observation:** (1) **The 20-min call cap is too small for content-build execute agents** — wave 1's
  healthy 41-call agent was SIGKILLed at 20m (0102's exact failure); `-CallTimeoutMin 45` fixed it for
  every later wave. Content waves run 20–40 min routinely. (2) **PLAN-AMENDMENT worked as designed
  end-to-end**: reviewers caught new slides cloned onto Title-Slide divider layouts ("unreadable
  subtitle dumps"), attached a concrete diff, the session applied plan+spec and resumed — the
  layout_name knob should be in every deck-build plan from wave 1. (3) **THE NIGHT'S ENGINE FINDING:
  the delta-coverage checker's test-mention scan did not accept remedies in `build/tests/*.py` NOR a
  hand-written `test/w06-*.test.mjs`** — it flagged the same report files three times across
  differently-shaped remedies (the waves that passed did so via their execute agents' own wNN files,
  suggesting the scan window is the WAVE'S OWN changed test files, not the repo's test corpus). A
  session-side remedy cannot reach it; only the wave's execute agent can. Hard-stopped the class per
  the repeat rule; wave 6/7 formal closes deferred to daylight. Engine fix suggestion: scan the full
  test corpus, or say explicitly which files were scanned in the halt text. (4) **Rscript-missing was
  an environment halt the execution gate caught exactly as designed** — R 4.6.1 installed silently
  with inno `/CURRENTUSER` (winget failed: installer wants UI/elevation without it). (5) 9 recoveries
  total, zero content compromises, zero faked gates; USER GATE files never created.
- **outcome:** worked (all artifacts shipped; 2 formal wave closes deferred with an honest engine
  finding)
- **provenance:** genuine-execution
