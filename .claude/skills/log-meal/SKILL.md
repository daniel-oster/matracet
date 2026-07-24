---
name: log-meal
description: Record a meal the household actually ate, told to Claude conversationally — especially off-plan/spontaneous meals (chaos-mode weeks, eating out, improvised dinners) that never show up in public/data/weeks/*.json. Appends to public/data/history.json, matches or creates an entry in public/data/meals.json for the dish itself, and can record per-person ratings. Use whenever the user describes what they ate, e.g. "we grilled burgers Tuesday" or "igår åt vi rester och det gick hem".
---

`public/data/weeks/*.json` already records *planned* meals — that's durable
history for normal weeks. It has no slot at all for the meals that happen
outside a plan: chaos-mode/vacation stretches, eating out, improvising from
whatever's in the fridge. `public/data/history.json` fills that specific gap.
It's read by `scripts/build-brief.ts` two ways: folded into `recentHistory` for
the next week's planning (last 2 weeks only), and as the source of each
`mealLibrary` entry's derived `antalGånger`/`senastÄten` (computed from the
*entire* history, not just the 2-week window) — so a well-logged spontaneous
dish genuinely feeds future planning, which is the whole point of this skill.

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

## 2. Match or create the meal

`public/data/meals.json` (schema in `src/types/meal.ts`) is the plannable-unit
library — see the top-level `CLAUDE.md`'s "Meals as the plannable unit" section
for the full model. Loosely match the description against its `namn` **and**
`alias` (same "does this look like the same dish" judgment call as anywhere
else in this app — no fuzzy-matching library, just read the names):

- **Confident match** → use its `slug` as `mealSlug`. Nothing to write.
- **Near-miss** (clearly the same dish, just phrased differently — "tacofredag"
  vs. "Tacos") → propose adding the phrase to that meal's `alias` array instead
  of creating a second entry. Alias discipline is the difference between a
  useful library and forty near-duplicates of the same dish.
- **No match at all** → create a new entry in `meals.json`: `slug` (same
  lowercase-hyphen-transliterated convention as recipe slugs), `namn`, `alias:
  []`, `komponenter` best-effort from what the user described (freeform
  `{vara, alternativ: [], valfri?}` — mark something `valfri: true` if they
  called it optional/a side), `receptSlug: null` (see step 3), `taggar`
  best-effort, `tid_min` only if they mentioned roughly how long it took. Don't
  invent components they didn't describe.

This replaces the old behavior of offering a `komplett: false` recipe stub for
a spontaneous dish — a meal-with-components is now the escape valve for "this
isn't a full recipe yet," not a fake recipe file (see CLAUDE.md's "The
problem" section on why `komplett: false` recipe stubs were the wrong shape
for this).

## 3. Try to match an existing recipe

Loosely match the description against `public/data/recipes/_index.json` by
name. If there's a confident match, note its `slug` as `recipeSlug` for the
history entry below. If the meal from step 2 has no `receptSlug` yet and this
recipe is clearly *the* recipe for it (not just *a* recipe — e.g. don't link
"Tacos" to one of the app's four taco recipes just because it matched), you
may also set the meal's `receptSlug` to this recipe's slug.

If there's no match, use `recipeSlug: null` — history entries don't require a
recipe link, and this skill no longer creates new recipe files at all.

## 4. Append the history entry

Add one entry to `public/data/history.json`'s `entries` array (schema in
`src/types/history.ts`):

```jsonc
{
  "id": "<datum>:<maltid>:<kort slumpsuffix>",
  "datum": "2026-07-14",
  "maltid": "dinner",
  "recipeSlug": "grillburgare",   // or null — see step 3
  "mealSlug": "hamburgare",       // or null — see step 2
  "beskrivning": "Grillburgare med sallad",
  "kalla": "spontant",
  "narvarande": ["daniel", "sarah"],
  "anteckning": null,               // optional extra context
  "loggad": "<now, ISO timestamp>"
}
```

Entries are never deduped by date+meal here (unlike a planned-day override) —
a chaos day can reasonably have more than one note-worthy thing happen.
`antalGånger`/`senastÄten` per meal are never hand-maintained here — they're
computed by `scripts/build-brief.ts` from the full history at brief-build
time, not stored fields.

## 5. Offer to record ratings

If a recipe got linked in step 3, ask whether anyone's rating should be
recorded — using the **exact same three values the app's UI uses**:
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
