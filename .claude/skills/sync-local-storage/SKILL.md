---
name: sync-local-storage
description: Merge an exported Matracet localStorage payload (from the app's Synka screen / "⬇ Exportera data" button) into the git-tracked public/data/feedback.json backend, so per-person recipe ratings (gillar/ogillar/vägrar) entered on one device become visible on every device. Use whenever the user pastes or uploads a matracet-data-*.json export, or asks to "sync my ratings" / "synka appen".
---

Matracet has no backend — per-person recipe feedback (`useFeedback`,
`matracet:feedback:v1`) lives only in the browser's `localStorage`, so it doesn't
travel between the household's devices on its own. The **Synka** screen in the
app (Hub → 🔄 Synka, built on `src/lib/exportData.ts`'s `downloadLocalData`)
downloads a `matracet-data-<date>.json` file containing **every** `matracet:*`
localStorage key on that device (see `ExportPayload` — the export is generic, so
it automatically includes any store added after this skill was written). The
user pastes or uploads that file's contents here; this skill's job is to fold
just the feedback entry out of it into `public/data/feedback.json` (the file
`scripts/build-brief.ts` already reads for sentiment + exclusions when
generating `planning-brief.json`).

## 1. Get the export payload

The user will paste JSON directly, or attach/reference the downloaded file. Its
shape (`ExportPayload` in `src/lib/exportData.ts`):

```jsonc
{
  "app": "matracet", "version": 2, "exportedAt": "...",
  "stores": {
    "matracet:feedback:v1": { "<recipeSlug>": { "recipeId": "...", "persons": [...], "excludeFromWeekPlan": false, "updatedAt": "..." } },
    "matracet:weekplan:v2": { /* out of scope for this skill, see below */ },
    "matracet:shopping:v1": { /* out of scope */ },
    "matracet:stash:v1": { /* out of scope */ },
    "matracet:chaosmode:v1": { /* out of scope */ },
    "matracet:irrelevant-offers:v1": { /* out of scope */ }
    // ...and any other matracet:* key present on that device — see below
  }
}
```

Only `stores['matracet:feedback:v1']` matters to this skill. **Do not touch any
other key** — weekplan, shopping list, stash, chaos-mode, irrelevant-offers, and
anything else under `stores` stay local-only/per-device by design; syncing them
is explicitly out of scope. Because the export is a generic dump of whatever's
in `localStorage`, a newly-added store shows up here automatically without this
skill needing an update — it's still correct to just ignore any key besides
`matracet:feedback:v1` unless the user explicitly asks you to start syncing it
too, in which case update this skill's instructions to describe the merge rule
for that key specifically (see the "Local storage export" note in the top-level
`CLAUDE.md`).

## 2. Merge into public/data/feedback.json — per (recipe, person), not whole-file overwrite

Read the current `public/data/feedback.json` (shape: `{ app, version, feedback }`,
or occasionally a bare feedback map — see its own `_om` field). This file already
holds ratings synced in from *other* devices/sessions, so **never replace it
wholesale with the pasted export** — that would silently erase every rating the
export's device doesn't know about.

For each `recipeId` in the pasted `stores['matracet:feedback:v1']`:
- For each entry in `persons`, upsert it into the git file's record for that
  `recipeId` by `personId` (the pasted entry replaces any existing entry for that
  same person on that recipe — it's the freshest edit for that person; entries
  for *other* people on the same recipe are left untouched).
- Carry over `excludeFromWeekPlan` if the pasted record sets it `true` (a `true`
  from either side should win — don't let a stale `false` clear an exclusion).
- If the git file has a `recipeId` the export doesn't mention at all, leave it
  exactly as-is.

Keep the file's `_om`/`app`/`version` fields as they are.

## 3. Refresh the derived brief

`public/data/feedback.json` feeds `scripts/build-brief.ts`. After merging, run:

```bash
npm run brief
```

and let `planning-brief.json`'s diff show what changed (new sentiment,
exclusions). Report a short summary to the user: how many recipes/persons were
merged, and whether anything in the brief changed as a result.

## 4. Don't auto-commit

Per this repo's git safety rules, write the files and let the user review the
diff before asking you to commit — this skill never commits on its own.
