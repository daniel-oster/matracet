---
name: sync-category-feedback
description: Merge an exported Matracet "wrong Fynd kategori" flag file (or the category-feedback entry inside a full matracet-data-*.json export) into the real erbjudanden data AND teach scripts/erbjudanden-lib.mjs's guessKategori to get it right next time. Use whenever the user pastes/uploads a matracet-category-feedback-*.json file, or asks to "fix the categories I flagged" / "synka kategoriflaggor".
---

The Fynd screen lets the household long-press any offer row and pick the category it
*should* be in (`CategoryFeedbackModal.tsx`, backed by `useCategoryFeedback`,
`matracet:category-feedback:v1`). That only records the correction locally — it never
edits `public/data/erbjudanden/*/*.json` itself, since the phone has no write access to
the repo. This skill is the other half: turn those flags into (1) a real data fix for the
weeks already saved, and (2) a `scripts/erbjudanden-lib.mjs` change so the classifier
stops making the same mistake on future weeks. Read `public/data/erbjudanden/README.md`'s
"Kategorier" section and the many "substring-collision" entries in the top-level
`CLAUDE.md`'s "Lessons learned" before touching `guessKategori` — this file has been
bitten by the same shape of bug (a short Swedish keyword matching inside an unrelated
compound word) many times, and the fix each time was a narrow lookaround guard, not a
blanket rule.

## 1. Get the entries

Two possible input shapes, both from `src/lib/exportData.ts`:

- **Standalone** (`downloadCategoryFeedback`, Synka screen's "⬇ Exportera
  kategori-flaggningar" button): `{ app, version, kind: 'category-feedback', exportedAt, entries: [...] }` — use `entries` directly.
- **Inside a full export** (`downloadLocalData`, "⬇ Exportera data"): the same array
  lives at `stores['matracet:category-feedback:v1'].entries`. Everything else in that
  payload is out of scope for this skill (feedback ratings → `sync-local-storage`,
  everything else → local-only, see that skill's own notes).

Each entry (`CategoryFeedbackEntry` in `src/hooks/useCategoryFeedback.ts`):

```jsonc
{ "name": "Salladsost", "wrongCategory": "gront_farsk", "correctCategory": "mejeri", "updatedAt": "2026-07-17T..." }
```

`name` is the offer's exact `namn` as saved (match case-insensitively — the app itself
normalizes with trim+lowercase). If `entries` is empty, tell the user there's nothing to
sync and stop.

## 2. Fix the actual saved offer data

For each entry, grep every `public/data/erbjudanden/*/2026-W*.json` file for an offer
whose `namn` matches `name` (case-insensitive) **and** whose current `kategori` still
equals `wrongCategory` — only touch offers still in the flagged wrong state, so a) you
don't clobber a category someone already fixed a different way, and b) a stale/duplicate
flag from an old export doesn't silently revert a correct value. Set `kategori` to
`correctCategory` on every matching offer across every week/store file (the same product
name can recur across many weeks — fix all of them, not just the most recent).

If a `name` isn't found in any file, or is found but its `kategori` no longer matches
`wrongCategory`, don't guess — note it in your final report instead of touching anything.

## 3. Teach the classifier so this doesn't recur

`scripts/erbjudanden-lib.mjs`'s `guessKategori` is the **single** source of category
guesses in this repo (`erbjudanden-recategorize.mjs` is just a thin CLI wrapper around it
— see CLAUDE.md) — every future import runs through it, so a flag that only fixes
existing JSON will silently reappear the next time this product is on offer. For each
entry:

1. Find which regex constant governs `correctCategory` (e.g. `mejeri` → `MEJERI_RE`,
   `hygien_hushall` → `NON_FOOD_RE`/`HYGIEN_RE`, `fardigmat` → `FARDIGMAT_RE`, `skafferi`
   → `SKAFFERI_RE`/`SAUCE_RE`, `protein_farsk`/`protein_fryst` → `PROTEIN_RE`, etc.) and
   check whether the flagged product's name is already covered by an *existing* keyword
   there but blocked by a different, earlier-checked branch in `CATEGORY_KEYWORDS`
   (`guessKategori`'s ordering: `BROD_RE` → `FARDIGMAT_RE` → `CANNED_TOMAT_RE` →
   `SAUCE_RE` → `PROTEIN_RE` → `FRUIT_RE` → `VEG_RE` → `SNACKS_RE` → `MEJERI_RE` →
   `DRYCK_RE` → `SKAFFERI_RE` → `HYGIEN_RE`, with `NON_FOOD_RE` bailing out before all of
   them). If an earlier branch is stealing the match, that's the actual bug — fix that
   branch's exclusion, don't just add a duplicate keyword downstream that'll never be
   reached.
2. If no keyword covers it at all, add one to the right regex constant. **Before adding
   any keyword, grep every offer `namn`/`marke` field across all saved weeks for that
   exact substring** to catch a collision before it ships — this file has hit every one
   of these shapes at least once:
   - a keyword hiding inside an unrelated compound word (`nöt` inside `jordnötsringar`,
     `ost` inside `rostbiff`, `fil` inside `filé`)
   - an adjective form hiding a shorter keyword (`färsk` containing `färs`)
   - a non-food product borrowing a food word for scent/shape/brand (`svamp`
     [mushroom] inside a cleaning sponge's name)
   - a processed/pantry product naming its raw ingredient (canned "Tomater Krossade"
     vs. fresh tomatoes; use the two-lookahead AND pattern like `CANNED_TOMAT_RE`, not a
     single alternation, when the disambiguating word can appear on either side)
   - a plural or vowel-shifted Swedish form not matching the singular keyword
     (`morötter` vs. `morot`)
   Fix any real collision with the narrowest guard that solves it — a fixed-width
   lookbehind/lookahead (`(?<!kokos)mjölk`, `färs(?!k)`) on the specific colliding
   substring, never a blanket `\w*`-strip (see the `färsk`/`färskpotatis` cautionary
   note in CLAUDE.md — stripping the whole adjective ate a legitimate compound whole).
3. Mirror the exact same regex change in **both** `guessKategori` in
   `scripts/erbjudanden-lib.mjs` if a second, independent copy of the same keyword list
   exists anywhere (check — historically `erbjudanden-recategorize.mjs` held its own
   copy that drifted; as of the 2026-07 rewrite it's a thin wrapper and shouldn't need a
   second edit, but verify before assuming).

## 4. Don't blanket-rerun the categorizer

Per the CLAUDE.md warning: **never** run a full recategorization pass across every saved
offer after changing `guessKategori` — it would silently change the category of every
*other* offer whose classification happens to shift under the new rule, even ones that
were already correct by some other path. Only touch:
- the specific `(name, wrongCategory)` matches from step 2, and
- optionally, as a narrow verification pass, offers whose `namn` matches the *specific*
  new/changed keyword pattern from step 3 (to catch other instances of the same mistake
  the user didn't happen to flag) — diff these by eye before writing, same as the past
  `CANNED_TOMAT_RE`/`SAUCE_RE` migration did.

## 5. Verify and report

- Re-grep the fixed product names across all `erbjudanden/*/*.json` files to confirm
  `kategori` is now correct everywhere it appears.
- Spot-check the new/changed regex against a handful of unrelated offer names (the ones
  you grepped in step 2) to confirm no new collision was introduced.
- Report: how many entries were applied to saved data (and how many offer records that
  touched, since one name can recur across weeks), what regex changes were made and
  why, and list any entries skipped (not found / already changed) so the user knows what
  still needs attention.

## 6. Don't auto-commit

Per this repo's git safety rules, write the files and let the user review the diff
before asking you to commit — this skill never commits on its own. It also never clears
`matracet:category-feedback:v1` on the device (there's no backend write path to do that
remotely) — a lingering "✏️" badge in Fynd after a sync just means the flag is now
historical, not still wrong; the user can tap it and "Ångra flaggning" if they want it
gone from the badge view.
