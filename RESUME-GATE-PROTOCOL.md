# Resume-Gate Human Protocol (Belt-and-Suspenders)

## Context
The Trio monorepo orchestrates multiple builds (researchPrime, Crucible, Foreman).
A resume interlock is enforced to prevent double-committing and corrupting state. 
This document defines the **human intervention protocol** when the lock crashes or is left stale.

## CRASH-RECOVERY: Fail-Closed via Named Human-Clear Step

If a wave is executing a commit and the engine crashes or is forcefully terminated, the `build-lock.json` lockfile may be left with `committing_state = true`.

When `go.ps1 -Resume` is invoked, the pre-resume guard reads this lock.
If it detects a live OR stale `committing_state`, it **ABORTS** the resume.

### How to Clear a Crashed Committing Hold
1. **Verify the commit status:** Check `git status` in the monorepo to ensure you aren't interrupting a live git transaction.
2. **Review the log:** Ensure the `liveness_heartbeat` in `build-lock.json` is genuinely stale, or verify the `pid` is dead.
3. **Manually release the lock:**
   Edit `build-lock.json` in the root of the trio repository.
   Set:
   ```json
   "holder": null,
   "committing_state": false,
   "resume_interlock": false,
   "liveness_heartbeat": null,
   "pid": null
   ```
4. **Resume:** You may now safely invoke `go.ps1 -Resume`.

This ensures that no automatic system steps over a crashed commit state, leaving the convergence authority in the hands of the operator (John).
