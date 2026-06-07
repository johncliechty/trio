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
and supports `--dry-run` and `--uninstall`. Equivalent CLI (no Claude Code
required to install):

```sh
node tools/onboard.mjs            # install (link every skill)
node tools/onboard.mjs --dry-run  # preview, change nothing
node tools/onboard.mjs --uninstall
```

> **Gemini CLI / OpenClaw users:** the same skills work outside Claude Code —
> see [`docs/portable-markdown.md`](./docs/portable-markdown.md) for the
> copy-paste install and the engine-vs-degraded matrix.

## Model backends (drivers)

The engine skills route every model call through one pluggable seam, so you can
swap the backend without touching skill logic. Claude is the default; Gemini,
OpenAI, and Grok are selectable via `TRIO_DRIVER` once the matching API key is in
your environment. A missing key makes that backend's live smoke **skip**, never
fail. See [`docs/drivers.md`](./docs/drivers.md) for the capability matrix, the
`.env` wiring, and the cost note.

```sh
TRIO_DRIVER=openai   # or gemini | grok ; unset = claude (default)
```

## Layout

```
trio/
  researchPrime/   # research skill (engine-backed)
  crucible/        # planning skill
  foreman/         # build skill — Crucible imports it via ../../foreman/bin/
  drivers/         # pluggable model backends (claude default; gemini/openai/grok)
  tools/           # /onboard installer, publish-safety scrubber, e2e verifier
  docs/            # drivers + cross-harness install notes
```

`crucible/` and `foreman/` are **direct top-level siblings on purpose**: Crucible
imports Foreman through the relative specifier `../../foreman/bin/...`, which
resolves only while the two share an immediate parent. The monorepo guarantees
that adjacency, so the import needs zero changes.

## Development

From the repo root:

```sh
npm test                       # crucible + foreman + drivers + tools + researchPrime suites
node tools/verify-e2e.mjs      # fresh-clone smoke: copy → onboard → activate all three
node tools/scrub.mjs --check   # publish-safety gate: fail on any personal path / key / email
```

`tools/verify-e2e.mjs` copies the working tree into a throwaway directory,
onboards it against a throwaway HOME, and confirms each engine resolves trio's
own internal `crucible/` + `foreman/` + `drivers/` through the install junction —
i.e. that a brand-new clone activates with no dependency on the original source
trees. It is the executable form of the quickstart above.

## Publishing (maintainer)

The build never pushes — creating the public repository and the first push are a
deliberate human step. Once `npm test`, `node tools/verify-e2e.mjs`, and
`node tools/scrub.mjs --check` are all green, publish with:

```sh
# 1. Create the public repo (GitHub CLI), or make it by hand at github.com/new.
gh repo create johncliechty/trio --public \
  --description "researchPrime → Crucible → Foreman: one clone, one /onboard, three skills." \
  --disable-wiki

# 2. Point this checkout at it and push.
git remote add origin https://github.com/johncliechty/trio.git
git push -u origin main
```

Without the GitHub CLI, create `github.com/johncliechty/trio` (public, no
README/license — this repo already has them) in the web UI, then run step 2.

## License

[MIT](./LICENSE) © John Liechty
