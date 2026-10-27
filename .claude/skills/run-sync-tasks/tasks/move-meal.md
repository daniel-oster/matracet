# Task type: move-meal

Not emitted by the app. Written by **Läget's inbox routine** (`livet-data/.claude/skills/inkorg`)
when the owner asks to move a planned meal ("flytta gårdagens middag till lunch idag"). Läget
cannot edit the week plan (it lives in each phone's localStorage and syncs via `device-sync`,
which only a device may write), so it appends an already-resolved entry straight to
`livet-data/matracet/task-log.json`; every device applies it once on its next boot
(`src/lib/syncTaskOutcomes.ts::applyMoveMeal`). There is no queued task to process, so this
skill's §1–§3 loop never sees it.

## Entry

```jsonc
{ "id": "flytta:<inkorgsmeddelandets id>", "type": "move-meal", "processedAt": "<ISO now>",
  "outcome": "applied",
  "result": { "from": { "date": "2026-10-26", "kind": "dinner" }, "to": { "date": "2026-10-27", "kind": "lunch" } } }
```

`kind` is `lunch` or `dinner`. The id must be unique: a device applies each id once.

## Semantics on the device

- The dish at `from` must be in a local week-plan override; if not (a day that only exists in
  a git week file) the entry is marked applied and does nothing.
- The dish moves to `to`; whatever was at `to` becomes unslotted in the meal pool (not deleted).
- Only that one move: attendance and fast flags stay on their slots.

## Before writing the entry

Read `matracet/sync/state.json` on `device-sync` (`matracet:weekplan:v3`) and confirm a dish
really sits at `from`. If not, don't write anything — ask which meal is meant.
