---
name: import-erbjudanden
description: Import a new week's store-offer flyer (Willys/ICA/Hemköp) into public/data/erbjudanden/ — from a raw PDF or Safari .webarchive upload, through text extraction and parsing, to a reviewed JSON file wired into _index.json/_latest.json. Use whenever the user uploads/mentions a new week's reklamblad, erbjudanden, flyer, or "fynd" PDF, or asks to add/update a store's weekly offers.
---

Full schema and background: `public/data/erbjudanden/README.md`. This skill is the
step-by-step procedure; read the README first if anything below is unclear or the
source format doesn't match what's described here (flyer formats drift between weeks).

## 1. Identify the source

- **Best case**: a structured product-list export (e-handel/webshop list), not the
  graphic flyer. It has a real, clean text layer.
- **Willys** may arrive as a Safari `.webarchive` of `willys.se/erbjudanden/ehandel`
  instead of a PDF — strictly better than the PDF, use it if available (exact prices,
  no column-splitting needed). Extract with `scripts/erbjudanden-webarchive-extract.py`,
  then parse with `scripts/erbjudanden-parse-willys-html.mjs`.
- **Check `pdfinfo file.pdf` before trusting any page count the upload UI reports** —
  they can disagree substantially.
- **Some uploads are graphic-only screenshots with no text layer at all**
  (`pdftotext` returns empty). Confirm via `pdfinfo`, then skip straight to reading the
  PDF pages as images with the `Read` tool (`pages: "N-M"`, ≤20 pages/call) and
  transcribe prices by eye. This also sidesteps Hemköp's font-substitution trick where
  the *text layer*'s digits are scrambled but the rendered glyphs are correct.

## 2. Extract and parse (structured PDF path)

```bash
apt-get install -y poppler-utils   # if missing
pdftotext -layout <store>.pdf <store>.txt

# Willys/Hemköp render 2 products per line (2-column) — split first:
node scripts/erbjudanden-split-columns.mjs <store>.txt
# → <store>.left.txt, <store>.right.txt

node scripts/erbjudanden-parse-willys.mjs <store>.left.txt > left.json
node scripts/erbjudanden-parse-willys.mjs <store>.right.txt > right.json
node scripts/erbjudanden-parse-ica.mjs <store>.txt > ica-draft.json       # ICA is one column already
node scripts/erbjudanden-parse-hemkop.mjs <store>.left.txt > left.json
```

Every parser prints a **draft**, not the final file. Known per-store gaps (see README
for the full list): ICA mixes in non-food (clothes, electronics — filter manually);
Hemköp's structured list has no origin-country data (that's only in the separate
graphic reklamblad — cross-reference by product name); page breaks occasionally
scramble a line at the boundary (check against the source `.txt` if a price looks off).

## 3. Classification — the part most likely to silently go wrong

`kategori` is guessed by keyword from the product name (`scripts/erbjudanden-lib.mjs`'s
`guessKategori`, used by the parsers above; `scripts/erbjudanden-recategorize.mjs` has
an equivalent standalone list used for one-off bulk re-migrations — **keep both in sync
when you change one**, nothing enforces it automatically).

Two known false-positive shapes to check for on every import, not just when something
looks obviously wrong:

1. **A short food keyword substring-matches inside an unrelated compound word** —
   e.g. bare `nöt` (beef) inside `jordnötsringar` (peanut rings), `sill` (herring)
   inside `fusilli` (pasta), `ägg` (egg) inside `pålägg` (any sandwich topping). Not
   fixable with word boundaries (Swedish compounding needs substring-anywhere matching
   for the *correct* cases too) — fix by extending the specific strip-list
   (`sanitize()` in `erbjudanden-recategorize.mjs`, the inline `.replace()` calls in
   `erbjudanden-lib.mjs`'s `guessKategori`).
2. **A non-food product borrows a food word as scent/shape/brand** — e.g.
   "Allrengöringssvamp" (cleaning sponge — `svamp` also means mushroom) or an
   apple-scented "Städservett" (wipe, matched `äpple`). Guarded by `NON_FOOD_RE` in
   `erbjudanden-lib.mjs` (checked before any produce/protein keyword) — extend that
   list first if a new household/hygiene product slips through, rather than adding an
   exception to the food keyword itself.

Before merging a draft, spot-check it:

```bash
node -e "
const d = require('./left.json'); // or whichever draft file
for (const o of d.erbjudanden ?? d) {
  const n = (o.namn||'').toLowerCase();
  if (/reng|städ|disk|tvätt|toalettpapper|hushållspapper|servett|tvål|schampo|deo|blöj/.test(n)
      && ['gront_farsk','gront_fryst','frukt','protein_farsk','protein_fryst','snacks_godis'].includes(o.kategori)) {
    console.log('SUSPECT non-food in a food category:', o.namn, o.kategori);
  }
}
"
```

`ovrigt` is an accepted fallback for anything genuinely unmatched — it is not itself a
bug. A *food* category on a cleaning/hygiene product is the bug.

## 4. Schema gotchas when finishing the JSON

- `ord_pris`, `pris_30dgr`, `besparing` are `string | null` in `src/types.ts` — always
  quote them (`"49.85-52.95"`), even if hand-transcribing a single number. A bare
  number is valid JSON but breaks things at runtime since nothing at compile time
  catches this (JSON has no type checking) — and the two crash sites are in different
  screens, so testing only one won't catch both: `FyndView` calls `ord_pris.includes('-')`
  directly; `besparing` instead breaks later, in `parseSavings` (`src/lib/suggestions.ts`,
  used by `VeckanPlanner`'s suggestion tags and `SkafferiView`'s savings-highlighted offer
  chips) — `BevakaView` doesn't touch either field, so it won't reveal this class of bug.
- Amounts use decimal **points**, not Swedish commas: `34.02`, not `34,02`.
- `jamforpris` (kr/kg or kr/l) is the cross-store comparison key — fill it whenever the
  source exposes it.

## 5. Wire the week in

- Save the finished file to `public/data/erbjudanden/<butik-id>/<vecka>.json`
  (`<vecka>` is `YYYY-Www`, matching the week-menu convention).
- Add `<vecka>` to `_index.json`'s `veckor` list for that store.
- Point `_latest.json` at the new week (per store) if it should become the UI default.

## 6. Verify

Four screens read this data, each exercising a different code path — checking only Fynd
does not exercise the other three, and each has broken silently on bad data before:

- `npm run test` (existing classification/logic unit tests must still pass).
- **Fynd** tab (`npm run screenshot` or `npm run dev` + manual look) — confirm the new
  week's offers render under the expected category groupings (Protein/Grönt
  Färskt-Fryst/Frukt/Snacks/Övrigt), not just that the JSON parses.
- **Bevaka** tab — spot-check the matched-offers side against
  `public/data/erbjudanden/bevakningslista.json`. Most `sok` keywords are generic
  (`"tandkräm"`, `"schampo"`, `"toalettpapper"` match every brand in that category), so
  for any watch-list item with `onskat_marke` set, confirm the offers it actually
  matched are that brand — `matchesBevakning` (`src/lib/bevaka.ts`) enforces
  `onskat_marke` as a hard filter, but a brand-name typo in either the watch-list entry
  or a freshly-imported offer's `marke`/`namn` field silently produces zero matches
  instead of an error. `HandlaView`'s bevaka column reads the same
  `findBevakaHits`/`matchesBevakning` path, so the Bevaka tab check covers it too — no
  need to check both.
- **Veckan → Planera** (or **Skafferi**) — open the suggestion list briefly. This is the
  only check that exercises `findOfferMatch`/`parseSavings` (`src/lib/suggestions.ts`)
  against the new week's data; a malformed `besparing` field (see the schema-gotchas
  note above) crashes here, not in Fynd or Bevaka.
