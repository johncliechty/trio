# trio

**One clone, one command, three skills.** `trio` packages a complementary
trio of [Claude Code](https://claude.com/claude-code) skills that hand off to
one another:

1. **researchPrime** — research: turns a question into a validated, best-in-class report.
2. **Crucible** — planning: turns an intent into a vetted, Foreman-ready implementation plan.
3. **Foreman** — build: drives that plan to a tested, GREEN result, wave by wave.

The chain is **researchPrime → Crucible → Foreman**: research feeds planning,
planning feeds the build.

Clone the repo and run a single `/onboard` command to install and activate all
three skills in Claude Code on **Windows, macOS, or Linux** — without degrading
your existing Claude Code setup (onboarding is idempotent, non-destructive, and
fully reversible). The engine skills' model backend is **pluggable** across
Claude (default), Gemini, OpenAI, and Grok.

## Quickstart

```sh
git clone https://github.com/johncliechty/trio.git
cd trio
claude          # start Claude Code inside the clone
/onboard        # installs + activates researchPrime, Crucible, Foreman
```

`/onboard` symlinks each skill into `~/.claude/skills` (a real junction on
Windows — no admin required; a symlink on macOS/Linux). It detects missing
prerequisites (`node`, `claude`, `git`), refuses to clobber any unrelated skill,
and supports `--dry-run` and `--uninstall`.

> **Note:** The `/onboard` slash command and the cross-OS installer land in a
> later build wave. This repository is being assembled by Foreman; see
> `IMPLEMENTATION-PLAN.md` for the wave-by-wave plan and `DESCRIPTION.md` for the
> design and the load-bearing sibling invariant.

## Layout

```
trio/
  researchPrime/   # research skill (added late, in its own wave)
  crucible/        # planning skill
  foreman/         # build skill — Crucible imports it via ../../foreman/bin/
  tools/           # /onboard installer + verification (added in later waves)
  drivers/         # pluggable model backends (added in later waves)
```

`crucible/` and `foreman/` are **direct top-level siblings on purpose**: Crucible
imports Foreman through the relative specifier `../../foreman/bin/...`, which
resolves only while the two share an immediate parent. The monorepo guarantees
that adjacency, so the import needs zero changes.

## Development

From the repo root:

```sh
npm test        # runs the crucible + foreman suites (and tools/, as waves add them)
```

## License

[MIT](./LICENSE) © John Liechty
