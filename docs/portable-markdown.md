# researchPrime — portable / cross-harness install

researchPrime is the third trio skill. On Claude Code it installs automatically with
the other two — `node tools/onboard.mjs` (or the `/onboard` slash command) links
`researchPrime/` into `~/.claude/skills/researchPrime` exactly like `crucible` and
`foreman`, with no extra step.

This doc covers the **copy-paste install for harnesses that don't run `/onboard`**
(Gemini CLI, OpenClaw, and any tool that just reads a markdown skill file), and the
one guardrail that matters for the engine to resolve itself correctly.

## What researchPrime is

It is not a single SKILL.md — it is a self-contained **Node engine** that lives in
`researchPrime/bin/` next to its `SKILL.md`. The engine **imports, never forks**, the
trio's Crucible + Foreman machinery (the adversarial Shark-Tank reviewers, the
context-free Judge, the Deep-Think Synthesizer, Foreman's durable checkpoint/budget
primitives). Because `researchPrime/` is vendored as a direct sibling of `crucible/`
and `foreman/` inside this repo, those imports resolve to the trio's **own internal**
copies — a fresh clone works with zero external (`C:\dev\*`) dependency.

## Engine mode vs. degraded mode

researchPrime binds its Phase-3 mode at runtime by **probing**, not by introspection:

| Host capability | Phase-3 mode | What runs |
| --------------- | ------------ | --------- |
| `node` present **and** the engine import probe returns `go:true` | **ENGINE** | The real stakes-scaled adversarial loop — `bin/governor.mjs runGovernedRound` → `bin/round.mjs orchestrateRound`, assembled by `bin/deliverable.mjs assembleDeliverable` (the worked example is `bin/dogfood.mjs`). Heterogeneous ≥2-agree reviewers, GATE-1 independent origins, the context-free Judge (decides), the active Synthesizer (steers, never decides), convergence-until-dry with the suspiciously-dry guard. G8 cross-lineage fusion stays **INERT/human-gated**. |
| `node` absent, **or** the probe is NO-GO (a trio symbol was renamed) | **DEGRADED** | An honest sequential prose audit. The deliverable carries the literal honesty stamp `schema conforms; adversarial verification did NOT run`, forces `cross_model:false`, and the word "parity" is forbidden in any prose-mode surface. It does **not** fork the engine. |

The mode probe is an **import** probe — run it from the skill's own directory:

```sh
node -e "import('./bin/contract.mjs').then(m=>m.runImportSpike()).then(v=>{process.stdout.write(JSON.stringify(v));process.exit(v.go?0:1)})"
```

Do **not** use `node bin/contract.mjs` for the probe. When the skill is reached
through an onboard junction/symlink, that command prints nothing and exits 0 (its CLI
guard compares the junction path against the symlink-resolved real path), which would
falsely look like NO-GO.

## Copy-paste install (Gemini CLI / OpenClaw / no-`/onboard` hosts)

1. Clone the trio repo (or copy the whole `researchPrime/` directory **together with
   its sibling `crucible/` and `foreman/` directories** — the engine needs all three
   side by side; copying `researchPrime/` alone breaks the in-repo imports).
2. Point your harness at `researchPrime/SKILL.md` the way it loads any markdown skill
   (for Gemini CLI / OpenClaw, register or paste the SKILL.md per that tool's skill
   mechanism). The prose protocol is self-contained in that one file.
3. Make sure `node` is on PATH if you want ENGINE mode; without it the skill runs the
   honest DEGRADED prose pass and says so.

That's it — there is nothing to build and no dependencies to install (the engine is
pure Node with no `node_modules`).

## Guardrail — leave `RP_TRIO_ROOT` UNSET

The engine finds the trio through one pin in `researchPrime/bin/contract.mjs`:

```js
export const TRIO_ROOT = process.env.RP_TRIO_ROOT
  ? pathToFileURL(path.resolve(process.env.RP_TRIO_ROOT) + path.sep)
  : new URL('../../', import.meta.url);
```

With `RP_TRIO_ROOT` **unset** (the default), `new URL('../../', import.meta.url)`
climbs `bin/` → `researchPrime/` → the trio repo root, so Crucible and Foreman resolve
to the trio's **own internal siblings**. This is the correct, self-contained behavior.

**Do not export `RP_TRIO_ROOT`.** An ambient `RP_TRIO_ROOT` in your shell *overrides*
that default and would silently point researchPrime at some other (possibly stale)
checkout — tests could still pass while self-containment is quietly broken. The trio's
`.env.example` deliberately does not list it; keep it out of your environment. The pin
exists only for hermetic CI that needs to aim at an exact, version-pinned copy.
