---
name: run-sync-tasks
description: Process pending Matracet intelligence-queue tasks (matracet:synctasks:v1, appended by the app to the device-sync branch's sync/state.json for judgment calls no deterministic script should make) and write their outcomes to public/data/task-log.json on main. Use whenever the user asks to "run sync tasks", "kör synk-tasks", or process the sync queue.
---

Most of Matracet's GitHub-backed auto-sync (see CLAUDE.md's "GitHub-backed auto-sync"
section) is deterministic: `scripts/merge-device-sync.mjs`, run by
`.github/workflows/merge-device-sync.yml`, mechanically merges the device-sync branch's
`sync/state.json` into canonical `public/data/` files. But not every sync outcome can be
mechanical — the canonical example is a manually-typed shopping-list item like "kaffe",
which needs to be resolved against *real current offers* to a concrete product/price, a
judgment call a regex can't safely make. These flow through a task queue with a strict
division of labor:

- The **device** appends structured task *intents* (never prompt text) to
  `matracet:synctasks:v1` (`src/hooks/useSyncTasks.ts`) at the moment they arise — see
  `src/components/views/HandlaView.tsx`'s `submitAdd()` for the one wired-up emission point
  so far. That store syncs inside `sync/state.json` like any other synced store.
- This **skill** (an interactive Claude Code session, explicitly *not* GitHub Actions — see
  "Why interactive, not Actions" below) reads the queue, processes each task per the catalog
  in `tasks/`, and writes outcomes to `public/data/task-log.json` on `main`.
- The **device** treats `task-log.json` (fetched as ordinary static data, the same way it
  fetches `feedback.json`) as the acknowledgment channel: on boot, `src/lib/
  syncTaskOutcomes.ts`'s `applyTaskOutcome` applies any outcome this client version
  recognizes, and `src/hooks/useSyncTasks.ts`'s `pruneSyncTasks` drops every local task whose
  id now appears in the log — whether or not this client understood its `type`.
- The **deterministic merge Action never touches this store** — `merge-device-sync.mjs`
  only has a canonical merge target for `matracet:feedback:v1`; every other key, including
  `matracet:synctasks:v1`, is skipped and logged untouched (see that script's own header
  comment). This makes it structurally impossible for the Action and this skill to both act
  on the same task, not just unlikely by convention.

## Why interactive, not GitHub Actions

Claude Code running inside a GitHub Actions job would bill per-token against an API key;
an interactive Claude Code session rides the user's existing subscription instead. That
placement is the entire cost model for this half of the pipeline — keep it interactive.

## 1. Get the pending tasks

Fetch `sync/state.json` from the `device-sync` branch (GitHub MCP `get_file_contents` with
`ref: "device-sync"`, or `git show origin/device-sync:sync/state.json` in a clone) and read
its `stores['matracet:synctasks:v1'].data.tasks` array — each entry is
`{ id, type, createdAt, payload }` (see `src/hooks/useSyncTasks.ts`'s `SyncTask`).

Also read the current `public/data/task-log.json` on `main` and collect its entries' `id`s.
**Skip any task whose id is already in the log** — it's already been processed by a prior
run; the device just hasn't hydrated and pruned it locally yet. This makes re-running this
skill idempotent even if it's invoked again before the device catches up.

If there are no tasks left to process after that filter, say so and stop — don't touch
`task-log.json` for a no-op run.

## 2. Process each remaining task by type

For each task, look up its `type` in `tasks/` (one file per recognized type — currently just
`tasks/resolve-manual-item.md`). Follow that file's exact procedure to produce an outcome:
`'applied'` (with a `result` payload, shape defined by that task-type file),
`'not-found'` (no confident match — do NOT guess), or `'skipped'` (the task itself turned
out to be malformed/unprocessable, e.g. an empty `vara`).

**A `type` with no matching file in `tasks/` — do not process it.** Leave it out of
`task-log.json` entirely; it must survive completely untouched in `sync/state.json` for a
future run (of this skill, once its catalog is extended) to pick up. Never guess at an
unrecognized type's intent, never partially process it, never log a placeholder outcome for
it. This is a hard rule, not a style preference — see the plan's Phase 5 critique gate.

## 3. Write outcomes to public/data/task-log.json

Append one entry per task actually processed this run:

```jsonc
{ "id": "<task id>", "type": "<task type>", "processedAt": "<ISO now>", "outcome": "applied", "result": { /* type-specific, see tasks/<type>.md */ } }
```

Never remove or edit an existing entry — this file only ever grows. Keep the existing
`_om`/`app`/`version` fields as they are.

## 4. Never write to device-sync

This skill only ever writes to files on `main` (today, just `public/data/task-log.json`,
plus whatever canonical file a specific task type's own file in `tasks/` says to touch). It
**never** pushes to the `device-sync` branch or edits `sync/state.json` — the device owns
that branch's content; a competing writer there would break the single-writer assumption the
whole sync design depends on. If you find yourself about to `git push` to `device-sync` from
this skill, stop — that's a sign the task type doesn't belong in this catalog the way it's
written.

## 5. Don't auto-commit

Per this repo's git safety rules (same as `sync-local-storage`/`sync-category-feedback`):
write the files and let the user review the diff before asking you to commit — this skill
never commits on its own.

## 6. Report

Summarize: how many tasks were processed (broken down by outcome), how many were skipped
because their type isn't in the catalog yet (and what type, so the user can decide whether to
extend it), and a one-line result per processed task (e.g. "kaffe → Nescafé Snabbkaffe
Refill 200g, Willys, v.29").

## Growing the catalog

**Standing rule** (also recorded in CLAUDE.md): whenever implementation work adds a new
situation that needs cloud/LLM judgment rather than a deterministic script, add a task type
and its `tasks/<type>.md` procedure to this catalog in the same session — don't leave it as
a TODO for later. If a task type later proves fully mechanizable after all, migrate its logic
into `scripts/merge-device-sync.mjs` and update that type's catalog entry to say so instead
of carrying a prompt that's no longer needed.
