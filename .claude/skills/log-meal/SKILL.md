---
name: log-meal
description: Record a meal the household actually ate, told to Claude conversationally — especially off-plan/spontaneous meals (chaos-mode weeks, eating out, improvised dinners) that never show up in public/data/weeks/*.json. Appends to public/data/history.json, optionally creates a recipe stub for a good spontaneous dish, and can record per-person ratings. Use whenever the user describes what they ate, e.g. "we grilled burgers Tuesday" or "igår åt vi rester och det gick hem".
---

`public/data/weeks/*.json` already records *planned* meals — that's durable
history for normal weeks. It has no slot at all for the meals that happen
outside a plan: chaos-mode/vacation stretches, eating out, improvising from
whatever's in the fridge. `public/data/history.json` fills that specific gap.
It's read by `scripts/build-brief.ts` (folded into `recentHistory` for the next
week's planning, last 2 weeks only) — so a well-logged spontaneous dish
genuinely feeds future planning, which is the whole point of this skill.

## 1. Extract the basics

From the user's description, get:
- **Date** — default to today if unstated; resolve relative phrases ("i
  tisdags", "igår").
- **Meal kind** (`lunch` or `dinner`) — ask if genuinely ambiguous.
- **A short dish description** (`beskrivning`) — what they said, cleaned up to a
  display-name-like phrase (e.g. "Grillburgare med sallad").
- **Who was present** (`narvarande`, a list of eater ids from
  `public/data/eaters.json`) — ask if not stated; don't guess from the presence
  schedule silently, since the whole point of logging is that this was an
  *exception* to the normal pattern.

## 2. Try to match an existing recipe

Loosely match the description against `public/data/recipes/_index.json` by name
(same "does this look like the same dish" judgment call as anywhere else in this
app — no fuzzy-matching library, just read the names). If there's a confident
match, note its `slug` as `recipeSlug`.

## 3. Offer a recipe stub for a good spontaneous dish

If there's **no** match and the description sounds like a real, repeatable dish
(not "åt ute", not "rester" with no real recipe behind it), ask the user: *"Vill
du spara det här som ett recept (utkast) också?"* If yes:
- Create `public/data/recipes/<slug>/recept.json` with `komplett: false` and the
  required fields from the top-level `CLAUDE.md`'s "Recipe files" section
  (`schema_version`, `slug`, `nummer` — next free number, check
  `_index.json` for the current max — `namn`, `tid_min`, `portioner`,
  `kategorier`, `ingredienser`, `instruktioner`, `komplett`). Best-effort fill
  from what the user described; leave `ingredienser`/`instruktioner` sparse
  rather than inventing detail they didn't give you.
- Add the matching entry to `public/data/recipes/_index.json` (slug, nummer,
  namn, tid_min, kategorier — per that file's existing convention).
- Use the new slug as `recipeSlug` in the history entry below.

If they say no, or it's clearly not a repeatable dish, just log it with
`recipeSlug: null` — history entries don't require a recipe link.

## 4. Append the history entry

Add one entry to `public/data/history.json`'s `entries` array (schema in
`src/types/history.ts`):

```jsonc
{
  "id": "<datum>:<maltid>:<kort slumpsuffix>",
  "datum": "2026-07-14",
  "maltid": "dinner",
  "recipeSlug": "grillburgare" ,   // or null
  "beskrivning": "Grillburgare med sallad",
  "kalla": "spontant",
  "narvarande": ["daniel", "sarah"],
  "anteckning": null,               // optional extra context
  "loggad": "<now, ISO timestamp>"
}
```

Entries are never deduped by date+meal here (unlike a planned-day override) —
a chaos day can reasonably have more than one note-worthy thing happen.

## 5. Offer to record ratings

If a recipe got linked (existing or new stub), ask whether anyone's rating
should be recorded — using the **exact same three values the app's UI uses**:
`likes` / `dislikes` / `refuses` (see `RecipeFeedbackBar`'s Swedish labels:
Gillar / Ogillar / Vägrar äta). If yes, upsert into
`public/data/feedback.json`'s `feedback[recipeSlug].persons` with the same
per-person-replace semantics as `useFeedback.ts`'s `setPersonSentiment` (a new
entry for that `personId` replaces any existing one for that recipe; leave every
other person's entry on that recipe untouched).

## 6. Refresh the derived brief

Since both `history.json` and possibly `feedback.json` changed, run
`npm run brief` so `planning-brief.json` reflects the new entry, and mention
anything notable that changed in your summary to the user.

Per this repo's git safety rules, this skill writes files and lets the user
review before asking for a commit — it never auto-commits.
