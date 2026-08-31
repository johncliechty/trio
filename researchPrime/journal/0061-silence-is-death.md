id: 0061-silence-is-death
skill: researchPrime@2026-08-27
situation: User rejected 45-minute silent KEEP. If a spawned seat is not responding, look in, then kill and respawn. All spawned processes must heartbeat.
context: Tightens 0060. Shared module trio/drivers/swarm-lookin.mjs: 90s first look-in, 60s silent-kill grace, one respawn with a silent nudge. Talking seats with a fresh heartbeat still KEEP past the old 12/15 min walls.
observation: Silence is not work. A seat that cannot heartbeat is not something we keep feeding. Phone ping of the steward is a different (rejected) idea — this is the orchestrator looking at its own children, not paging John.
outcome: worked
provenance: genuine-execution
