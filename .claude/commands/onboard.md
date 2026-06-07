---
description: Install and activate the trio skills (researchPrime, Crucible, Foreman) into Claude Code — idempotent, non-destructive, reversible.
allowed-tools: Bash(node tools/onboard.mjs), Bash(node tools/onboard.mjs:*)
---

Run the trio onboarding installer and report the result to the user.

The installer links every skill in this repo into `~/.claude/skills` (a real
directory junction on Windows — no admin required; a symlink on macOS/Linux). It
is **idempotent** (a link already pointing here is left alone), **non-destructive**
(it refuses to clobber any unrelated skill dir without `--force`), and
**reversible** (`--uninstall`).

Steps:

1. From the repo root, run the installer. If the user supplied arguments
   (`--dry-run`, `--force`, `--uninstall`), pass them through:

   ```sh
   node tools/onboard.mjs $ARGUMENTS
   ```

2. Show the installer's output, then summarize for the user:
   - which skills were linked (or were already linked),
   - any missing prerequisites it reported (`node` / `claude` / `git`),
   - any foreign skill directories it **refused** to overwrite. Only suggest
     re-running with `--force` if the user confirms those entries are safe to
     replace — `--force` is destructive.

3. If anything was newly linked, remind the user to restart Claude Code (or
   reload skills) so the newly linked skills activate.
