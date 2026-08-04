- `id`: 0098-env-overrode-prefs-and-the-build-ran-with-seats-backwards
- `skill`: foreman@steward-v3-heavy
- `situation`: An operator copies a working launcher script to start a new run, and the
  copied env block silently overrides the host's configured model seats.
- `context`: Ecgberht steward build, 22 waves, 2026-08-03/04. The user's question was
  blunt: *"I am confused as to why fabel was not the driver and grok the review (that is
  what was set in the anchor settings)."*
- `observation`:

  **The build ran with the seats BACKWARDS for its entire length, and every artifact
  looks normal.** Anchor `settings.json` said `coding_family: claude`,
  `review_family: grok`. The launcher `.bat` exported `CODING_FAMILY=grok` and
  `REVIEW_FAMILY=claude`. **Env beats prefs**, so the configured seats never applied.

  Three things made this survivable-but-invisible, and each is the real lesson:

  1. **It was INHERITED, not decided.** The env lines came verbatim from the original
     `_run-foreman-root.bat` (commit `0831b3f`, whose message literally says "grok code /
     claude review"). When I built the corrected launcher I copied the env block and
     changed only the flags I was thinking about (`--force`, `--clear-halt`). A copied
     launcher carries a **seat decision** as well as a command line, and I never
     re-examined the part I wasn't debugging.
  2. **The resolved seat is not the family you named.** The "claude" review seat resolved
     to **Gemini 3.1 Pro (High)** through the cross-family ladder. So the run stamp
     saying `review_family=claude` was true and still told you almost nothing about which
     model actually reviewed. The stamp must record the RESOLVED DRIVER, not the family
     label.
  3. **Nothing compares env to prefs.** Both values existed on disk, differed, and no
     gate said so. A one-line preflight diff (`prefs.coding_family` vs
     `env.CODING_FAMILY`) would have printed the inversion in the banner at t=0 for free.

  Cost: not a failed build (it completed, 22/22, 1193 tests green) but an
  **unfalsifiable one** — for a week I could not answer "which model wrote this code?"
  from the artifacts alone, and the user's mental model of who was driving was wrong the
  whole time.
- `outcome`: friction — build succeeded; seat provenance was wrong in every artifact and
  only surfaced when the user asked a direct question about it
- `provenance`: genuine-execution

## Lesson (one line)

**When a launcher sets model seats in env, it OVERRIDES the host prefs silently — so
print `prefs vs env` in the t=0 banner and stamp the RESOLVED DRIVER, never the family
label; and when you copy a launcher, re-read the lines you are not debugging, because
they carry decisions.**
