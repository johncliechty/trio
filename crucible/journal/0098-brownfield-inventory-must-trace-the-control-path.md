# 0098 — A brownfield inventory that names modules, not control paths, plans the wrong hook

**Date:** 2026-09-05 · **Run:** Anchor reports-links (LITE, elegance pass inside), built by Foreman

## What happened

The Stage-1 plan's criterion 1 ("a finished run registers itself") named three finish hooks, and the
first was "gandalf.run_gandalf finalize" — the module the steward's own baseline-context.md listed under
"finish hooks that exist today". Foreman built it, and its reviewer HALTed wave 2 twice with
plan-amendment proposals, both right:

1. The cockpit's "Commission a Gandalf read" never calls `run_gandalf`: it POSTs `/api/say`, and
   `commission_session` maps skill Gandalf to lane `general` — a managed session, not the dashboard's
   Gandalf engine. Hook A covered the dashboard path only; the cockpit path (the one John uses) had no hook.
2. That managed session runs in an isolated worktree, and the session keystone persists only
   `effort_history._DOC_DIRS` (planning/research/build/deliverables/general) — `gandalf/` is dropped —
   so the report is not in the project folder at PRODUCED time; a campaign-folder scan finds nothing, or
   binds a sibling run by newest mtime.

Neither was ambiguity. Both were module-level facts the plan's inventory had summarized by NAME
("gandalf.py finalize", "session_doc_roles") without tracing the control path from the button to the
process to the file on disk.

## The lesson (for the T1 brownfield inventory)

For every "finish point" a plan hooks, the inventory must carry the CONTROL PATH: the UI control → the
handler → the process that runs → where its files land → what persists them → when. A module name is a
pointer, not a path. The Sharks did not catch it either: they attacked the plan's text, and the text was
internally consistent.

## Owed

- Stage 0 brownfield T1: a "finish points" table with the six columns above, gated: a hook that names
  a module without a traced path is a BLOCKER finding, not a KEEP.
- The Anchor baseline for reports-links is corrected in the effort's plan (two amendments, 99039bf,
  79dd21e on the build branch).
