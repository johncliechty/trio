# 0119 — Campaign counsel research: live panel killed for silence on round 1

- id: 0119-campaign-counsel-panel-silence-halt
- skill: researchPrime@2026-10-02
- situation: live G3 panel spawn on the grok review family; default silence thresholds
- context: Skill Foundry page plan, Campaign counsel + Piaget sphere grounding (planning/foundry-page-2026-10-02/research-campaign; run dir via junction C:/dev/_rp-campaign-run because pty-launch.py splits argv on the space in "Skill Foundry")
- observation: all three grok seats were declared dead after 92–127 s of silence ("silence is death") while still working; zero survivors HALT. Same class as the open weakness in the journal report ("reviewers cut off as silent before they reply"). Rerun with RESEARCHPRIME_PANEL_CHECKIN_MS=300000, SILENT_KILL_MS=900000, DEAD_MS=1200000 and REVIEW_FAMILY=grok (lineage stamp). Also: the triage lock resolved depth FULL / cap 8, not LITE as the plan text said.
- outcome: friction
- provenance: genuine-execution
