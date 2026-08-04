# Launch long engines outside the agent job tree (universal)

**Date:** 2026-07-23  
**Why:** Live portfolio runs under **Grok Build** showed silent process death (~8–11 min) for Crucible/Foreman children launched from the agent tool shell. Detached `Start-Process` still died (watchdog too). **Windows Scheduled Task** (breakaway) survived past Oranges → phased plan → Shark. Same class of failure can hit **any** host that reaps tool-spawned process trees.

## Is this Grok-only?

**No.** It is a **host process-tree / Job Object** issue, not a model family issue.

| Host that spawns tools | Risk for long trio/foundry engines |
|------------------------|-------------------------------------|
| **Grok Build** | Confirmed (F048–F050): agent-tree launches reaped |
| **Claude Code / Cowork** | Same pattern possible (session job reaps tool children) |
| **Cursor / VS Code agent** | Same pattern possible |
| **agy / Gemini tool shells** | Same pattern possible |
| **Anchor job_runner** | Preferred path when it uses a durable holder (not a one-shot agent tool) |

So: **universal for trio + foundry long runs**, whenever the **orchestrating chat agent** is also the process that spawned the engine.

## What to do (operator rule)

For multi-minute / multi-hour **Crucible, Foreman, researchPrime, Gandalf-Heavy, etc.**:

1. **Prefer durable holders:** Anchor `job_runner`, Windows Scheduled Task, or a process that **breakaways** from the agent Job Object (`CREATE_BREAKAWAY_FROM_JOB` / schtasks / WMI Create).
2. **Do not rely** on “background” alone if the parent is still the agent’s tool process tree.
3. **ConPTY** (`pty-launch.py`) prevents console flash; it does **not** by itself escape session job reaping.
4. **Trio process-lifetime guards** (`drivers/process-lifetime.mjs`) make JS deaths fail-loud and improve resume — they **cannot** stop external SIGKILL of the whole tree.

## Zombie-hunter interaction

- **Session-tied (KEEP supervision):** under an **active** VS Code / Anchor / terminal (etc.) session — see zombie-hunter host-walk active-session hardening.
- **Long engines outside the chat tool tree** may look unsupervised to the **Node** classifier if parents are only Task Scheduler/services — that is correct for the unsupervised leg; under **shadow** mode this is observe-only. Do **not** arm kill against schtask-held production engines without a registry of “known durable launches.”
- Anchor Python reaper only targets **registered Anchor sessions** — separate path.

## Foundry skill implication

Any foundry skill that spawns a **long** background engine from an interactive agent session should document the same launch rule in its SKILL / operator notes — not only Grok, and not only Legal/Financial.
