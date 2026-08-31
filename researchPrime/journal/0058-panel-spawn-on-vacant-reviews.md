id: 0058-panel-spawn-on-vacant-reviews
skill: researchPrime@2026-08-27
situation: Live Phase-3 rounds required the operator to paste reviewer findings; empty reviews[] meant an empty round, not a spawned G3 swarm (journal 0057).
context: Named shortfall from the 2026-08-27 Grok portfolio review + 0057 (PSU paywall). Construction-freeze ticket: current version used on a real job and fell short in a named way.
observation: runPanelRound already existed but was only wired to measureSteering. Live path now spawns the Shark roster when reviews are vacant, persists round-N-spawned-reviews.json, HALTs without an absolute artifact path, and does not re-spawn a supplied panel or an existing sidecar. Replay with empty reviews is unchanged (honest skip).
outcome: worked
provenance: genuine-execution
