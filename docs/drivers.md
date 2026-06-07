# trio — pluggable model drivers

The trio engines (Crucible's planning agents and Foreman's build sub-agents) call a
single seam — `runAgent({ prompt, schema, freshContext, driver })` in
`drivers/index.mjs` — and the model backend behind that seam is swappable. **Claude
is the default and is unchanged**; the alternate backends are additive.

## Selecting a driver

Selection order is: an explicit `driver` argument → the `TRIO_DRIVER` env var → the
`claude` default.

```sh
# default — no env needed; uses the claude CLI + your existing Claude Code auth
TRIO_DRIVER=claude

TRIO_DRIVER=openai     # OpenAI Chat Completions
TRIO_DRIVER=gemini     # Google Gemini (Generative Language API)
TRIO_DRIVER=grok       # xAI Grok (OpenAI-compatible API)
```

An unknown `TRIO_DRIVER` HALTs (it never silently falls back to Claude) so a typo
can't quietly bill the wrong backend.

## Keys (`.env` wiring)

Copy `.env.example` to `.env` (gitignored — never committed) and fill in **only** the
key for the driver you select:

| Driver  | Env var          | Notes                                            |
| ------- | ---------------- | ------------------------------------------------ |
| claude  | *(none needed)*  | the `claude` CLI uses your Claude Code auth      |
| openai  | `OPENAI_API_KEY` | optional model override: `OPENAI_MODEL`          |
| gemini  | `GEMINI_API_KEY` | optional model override: `GEMINI_MODEL`          |
| grok    | `XAI_API_KEY`    | optional model override: `XAI_MODEL`             |

If the selected driver's key is **absent**, the live path HALTs with a clear "key is
not set" message rather than firing a keyless request, and the live smoke tests are
**skipped** (not failed).

## Capability matrix

`capabilityMatrix()` (from `drivers/index.mjs`) returns one row per registered
backend:

| Driver  | `subAgentCapable` | Structured output                                  |
| ------- | ----------------- | -------------------------------------------------- |
| claude  | yes               | CLI sub-agent — schema appended to the prompt      |
| openai  | no                | JSON-mode — `response_format: json_schema`         |
| grok    | no                | JSON-mode — OpenAI-compatible `response_format`    |
| gemini  | no                | JSON-mode — `generationConfig.responseSchema`      |

`subAgentCapable` is `true` only for the Claude CLI, which spawns a real fresh
sub-agent process per call. The raw-API backends are **not** sub-agent-capable; they
approximate context isolation the way researchPrime does — each call is an
independent, stateless request. Regardless of backend, a `schema` request returns a
parsed/validated object, retrying once on unparseable JSON and then **abstaining**
(`answerable: "no"`) so the engine HALTs for a human instead of acting on garbage.

## Cost note

The default Claude driver runs on your existing Claude Code subscription via the
`claude` CLI (no `ANTHROPIC_API_KEY`, no per-call API billing). **The alternate
backends call paid, metered APIs** — every `runAgent` call is billed per-token by the
provider against the key you supply, and the engines fan out across many sub-agent
calls per wave/stage, so usage adds up quickly. Before pointing the trio at an
alternate backend: pick a cost-appropriate model (use the `*_MODEL` overrides),
confirm provider pricing, and set spend limits on the key. Keys live only in your
local `.env`; they are never committed.
