---
name: sync-category-feedback
description: Merge an exported Matracet "wrong Fynd kategori" flag file (or the category-feedback entry inside a full matracet-data-*.json export) into the real erbjudanden data AND the lexicon/classifier so the fix sticks. Use whenever the user pastes/uploads a matracet-category-feedback-*.json file, or asks to "fix the categories I flagged" / "synka kategoriflaggor".
---

The Fynd screen lets the household long-press any offer row and pick the category it
*should* be in (`CategoryFeedbackModal.tsx`, backed by `useCategoryFeedback`,
`matracet:category-feedback:v1`). That only records the correction locally — it never
edits `public/data/erbjudanden/*/*.json` itself, since the phone has no write access to
the repo. This skill is the other half: turn those flags into (1) a real data fix for
the weeks already saved, (2) a **locked** (`kategori_kalla: "manuell"`) lexicon entry
(`public/data/erbjudanden/_kategori-lexikon.json`, see `scripts/erbjudanden-lexikon.mjs`)
so the same product is never reclassified away from the correction, and (3) — only when
the mistake is a generalizable pattern, not a one-off brand name — a
`src/lib/kategoriClassify.mjs` fix so *other*, not-yet-flagged products with the same
name pattern get it right too. Read `public/data/erbjudanden/README.md`'s "Kategorier"
section and `.claude/skills/import-erbjudanden/klassificering.md` first. The taxonomy is
`src/lib/kategoriTaxonomy.mjs` (leaf ids only — `correctCategory` must be one of those,
never a group id); the many "substring-collision" entries in the top-level `CLAUDE.md`'s
"Lessons learned" document the shape of bug `kategoriClassify.mjs` gets bitten by
repeatedly (a short Swedish keyword matching inside an unrelated compound word) — the
fix each time was a narrow lookaround guard or a haystack-level string rewrite, never a
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

## 2. Fix the actual saved offer data, and lock it in the lexicon

For each entry, grep every `public/data/erbjudanden/*/2026-W*.json` file for an offer
whose `namn` matches `name` (case-insensitive) **and** whose current `kategori` still
equals `wrongCategory` — only touch offers still in the flagged wrong state, so a) you
don't clobber a category someone already fixed a different way, and b) a stale/duplicate
flag from an old export doesn't silently revert a correct value. Set `kategori` to
`correctCategory`, and `kategori_kalla` to `"manuell"`, on every matching offer across
every week/store file (the same product name can recur across many weeks — fix all of
them, not just the most recent). Also `form`/`varutyp` if the correction implies a
different one (e.g. moving something into `glass_dessert`'s `glass`/`dessert` leaves
should also set `form: "fryst"`, see `kategoriTaxonomy.mjs`'s `aisleFor`).

Then write the same verdict into the lexicon via `upsertLexikon()`
(`scripts/erbjudanden-lexikon.mjs`), keyed by `normalizeProductKey(name, marke)`, with
`kalla: "manuell"` — this is a **lock**: `erbjudanden-recategorize.mjs` and
`applyLexikonEntry` both refuse to overwrite a `"manuell"` entry (or an offer already
marked `kategori_kalla: "manuell"`) on a future replay, so this correction survives every
subsequent import of the same product without needing to be re-flagged.

If a `name` isn't found in any file, or is found but its `kategori` no longer matches
`wrongCategory`, don't guess — note it in your final report instead of touching anything.

## 3. Teach the classifier so this doesn't recur for *other* products

The lexicon fix in step 2 only locks in this **one** product. If the mistake was a
generalizable pattern (a keyword collision, a missing plural form, a brand the
classifier didn't know) rather than a one-off brand-only name, also patch
`src/lib/kategoriClassify.mjs` — the single rule engine used both as the cold-start
fallback for lexicon misses and by `scripts/erbjudanden-verify.mjs`'s assertions. Read
its file header first; the decision order is: `BRAND_OVERRIDES` → `NON_FOOD_GATE_RE` →
head-noun guards (`CANNED_TOMAT_RE`/`GLASS_RE`/`SAUCE_RE`/`BROD_RE`/`FARDIGMAT_RE`/
`STARCH_HEAD_RE`/`DAIRY_GATE_RE`) → `PROTEIN_LEAF_RULES` → `BAR_RE`/`FRUIT_RE` →
`SNACKS_RE` → `VEG_LEAF_RULES` → `DRYCK_LEAF_RULES` → `SKAFFERI_LEAF_RULES` → `ovrigt`.

1. Find which constant governs `correctCategory`'s leaf (grep the leaf id as a return
   value/rule target in `kategoriClassify.mjs`) and check whether the flagged product's
   name is already covered by an *existing* pattern there but stolen by a different,
   earlier-checked branch. If an earlier branch is stealing the match, that's the actual
   bug — fix that branch's exclusion (a lookaround guard, or a `haystack` rewrite in
   `classify()`'s preprocessing block, same shape as the existing `automat\w*`/
   `salladsost`/`dessertost`/`costa rica` strips), don't just add a duplicate keyword
   downstream that'll never be reached.
2. If no pattern covers it at all, add one to the right constant (or, for a brand-only
   name with no generic word left — "Präst", "Ballerina" — to `BRAND_OVERRIDES`).
   **Before adding any keyword, grep every offer `namn`/`marke` field across all saved
   weeks for that exact substring** to catch a collision before it ships — this file has
   hit every one of these shapes at least once (see its own header and CLAUDE.md's
   "Lessons learned" for the full running list): a keyword hiding inside an unrelated
   compound word, an adjective form hiding a shorter keyword (`färsk` containing
   `färs`), a non-food product borrowing a food word for scent/shape/brand, a processed/
   pantry product naming its raw ingredient, a plural/vowel-shifted Swedish form not
   matching the singular keyword, a country name embedding a food substring ("Costa
   Rica" contains "ost"), or a blanket brand override preempting a more specific
   real signal in the same product's own name (e.g. a ready-meal brand that also sells
   bread — classify on the product word, not the brand, whenever one is present).
   Fix any real collision with the narrowest guard that solves it — a fixed-width
   lookbehind/lookahead, or a targeted string replace in `classify()`'s haystack
   preprocessing — never a blanket `\w*`-strip that could eat a legitimate compound
   whole (see the `färsk`/`färskpotatis` cautionary note in CLAUDE.md).
3. There is exactly one classifier now (`kategoriClassify.mjs`, imported by both
   `scripts/erbjudanden-lib.mjs` for the parsers and the app itself) — no second copy to
   keep in sync.

## 4. Don't blanket-rerun the categorizer across every saved offer

Per the CLAUDE.md warning: **never** run `erbjudanden-recategorize.mjs` (or any bulk
pass) across every saved week purely because you changed `kategoriClassify.mjs` — it
would silently reclassify every *other* offer whose verdict happens to shift under the
new rule, even ones that were already correct by some other path (and any offer/lexicon
entry already `kategori_kalla: "manuell"` is protected from this anyway, by
construction — but everything else isn't). Only touch:
- the specific `(name, wrongCategory)` matches from step 2, and
- optionally, as a narrow verification pass, offers whose `namn` matches the *specific*
  new/changed pattern from step 3 (to catch other instances of the same mistake the user
  didn't happen to flag) — diff these by eye before writing, same as the past
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
