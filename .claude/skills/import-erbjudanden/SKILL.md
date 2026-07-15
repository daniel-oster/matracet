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
- **All three stores can now arrive as a Safari `.webarchive`** of the store's live
  erbjudanden page — as of 2026-07 this is the *expected* format going forward (the
  household saves "Save Page As → Web Archive" from Safari on the actual offers page),
  not just a Willys-only path. It's strictly better than a PDF: exact price digits, no
  column-splitting, no font-substitution tricks. Extract the HTML first with
  `scripts/erbjudanden-webarchive-extract.py input.webarchive out.html`, then parse
  with the matching store parser:
  - Willys → `scripts/erbjudanden-parse-willys-html.mjs` (schema.org `Product` markup)
  - ICA → `scripts/erbjudanden-parse-ica-html.mjs` (`<article class="offer-card" data-promotion-id="...">` blocks)
  - Hemköp → `scripts/erbjudanden-parse-hemkop-html.mjs` (`data-testid="product-container"` blocks, plus a
    separate rarer `data-testid="product-main-link"` shape for personal "Bara för dig" coupons)
- **Don't trust the webarchive's `WebResourceURL` metadata (or a `__NEXT_DATA__.page`
  field) to tell you what page was actually saved** — these are SPA sites
  (Willys/ICA/Hemköp all client-route within one shell), so that metadata reflects the
  *original* document load (often just `/` or a store's base URL), not the
  client-side-routed erbjudanden view the user actually saved. Trust the rendered
  `<title>` tag and/or `<link rel="canonical">` in the extracted HTML instead — both
  reflect the live route. (First pass on this import wrongly concluded the Hemköp
  archive had captured the homepage by mistake, purely from `WebResourceURL`/
  `__NEXT_DATA__.page` both saying `/` — the `<title>`/canonical said "Erbjudanden |
  Hemköp" / `hemkop.se/erbjudanden/4638`, i.e. the right page, all along.)
- **Willys' canonical URL can be `/erbjudanden/butik` (in-store) some weeks and
  `/erbjudanden/ehandel` (e-handel/online-order) others** — check the extracted HTML's
  `<link rel="canonical">` and record whichever it actually was in that week's
  `kalla_url`/`urval` (don't silently assume ehandel just because that's what a past
  week used). The two pages can carry different prices/assortment (in-store vs.
  delivery pricing) — this hasn't caused a visible problem yet, but is worth a
  one-line note in the file's `urval` field when it happens so a future comparison
  across weeks isn't silently comparing two different price channels.
- **Hemköp's webarchive is a homepage-embedded offer widget, not a dedicated flyer
  page** — its erbjudanden route renders the week's in-store offers as a
  `data-testid="offline-promotion-products"` grid (`~55-60` items, all tagged "Gäller i
  butik") directly on the page Safari saves, rather than a separate structured list
  like Willys/ICA. This is normal, not a sign of a bad capture — the item count lines
  up with prior weeks' PDF-derived Hemköp counts (52 vs. 59 items). Hemköp also
  occasionally shows a couple of personal, activation-required "Bara för dig" coupons
  in a differently-shaped card (`data-testid="product-main-link"`, no
  `product-container`) — the parser handles both shapes, but if the offer count looks
  suspiciously low, grep the HTML for `product-title` vs. `product-container` counts;
  a mismatch means some offers are in the second shape and need the coupon path.
- **Check `pdfinfo file.pdf` before trusting any page count the upload UI reports** —
  they can disagree substantially.
- **Some uploads are graphic-only screenshots with no text layer at all**
  (`pdftotext` returns empty). Confirm via `pdfinfo`, then skip straight to reading the
  PDF pages as images with the `Read` tool (`pages: "N-M"`, ≤20 pages/call) and
  transcribe prices by eye. This also sidesteps Hemköp's font-substitution trick where
  the *text layer*'s digits are scrambled but the rendered glyphs are correct.

## 2. Extract and parse (structured PDF path — skip if using the webarchive path above)

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

**ICA's webarchive source in particular pulls in a much larger and more varied
non-food catalog than the old PDF export did** (125 raw offers in the 2026-W29 import,
of which 57 — nearly half — were non-food: clothing, small appliances/electronics,
garden tools, toys/books, sports/hobby gear, baby gear, gasol grills). The filtering
rule of thumb that's worked so far: keep food *and* consumable household items in the
everyday "hushåll" grocery-aisle sense (cleaning products, pest control, paper/trash
bags, hygiene/skincare) — exclude anything durable/appliance/electronics/toy/clothing/
garden/book/baby-gear/sporting-goods, even if it's sold at the same hypermarket. When
in doubt, ask: "would this normally be restocked weekly as part of a grocery run, or
is it a one-off durable purchase?" — the latter goes in `urval`'s excluded list, not
`erbjudanden[]`.

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
3. **A common Swedish adjective/verb hides a shorter food keyword inside it** — found
   two new ones in the 2026-W29 import, both fixed with the same "negative lookahead
   on the exact colliding letter" shape already used for `fisk(?!e)`/`sill(?!i)`:
   - `färs` (mince/ground meat) inside `färsk`/`färskt`/`färska` (the adjective
     "fresh" — extremely common: "Färsk pasta", "Färska kryddor", "Färskpotatis") —
     fixed as `färs(?!k)`. A blanket strip of the whole word (`färsk\w*` — matching
     what `src/lib/storeOrder.ts`'s aisle categorizer already did for the same
     collision) was tried first and rejected: it also eats compounds like
     "Färskpotatis" whole, dropping the `potatis` keyword needed to classify it as
     veg and losing the match entirely instead of just fixing the meat
     mis-classification. The negative-lookahead-on-just-the-ambiguous-substring form
     is strictly more precise — ported this exact fix back into
     `guessAisleCategory` too (see that function's own comments) since it had the
     stale, less-precise version.
   - `tomat` (tomato) inside `automat`/`automatic` (appliance names, e.g.
     "Kaffebryggare Automatic") — fixed with `.replace(/automat\w*/gi, '')` in
     `guessKategori`'s haystack (this one *is* safe to blanket-strip, unlike `färsk`,
     since "automat" doesn't compound directly onto another food keyword the way
     "färsk" does).
   When adding any new keyword, grep the existing offer `namn` fields for it as a
   substring first (same check already called out below) — and if the collision is
   with a word that itself *contains* another real keyword as a suffix (like
   `färskpotatis`), prefer a negative lookahead on the ambiguous keyword over
   stripping the containing word.
4. **A generic/borrowed word matches inside a hobby or gadget product name that isn't
   food at all** — e.g. "Magnetfiske" (a magnet-fishing kit, a toy) matched bare
   `fisk`. Fixed the same way as #3, `fisk(?!e)` (real food compounds always glue more
   letters directly onto "fisk" — fiskpinnar, fiskgratäng — never "fisk" + "e" as a
   standalone word). This is different from `NON_FOOD_RE` bailouts (#2) because
   there's no single household-product family to list — check case by case.

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
  number is valid JSON but breaks `FyndView`/`BevakaView` at runtime (`.includes is not
  a function`) since nothing at compile time catches this (JSON has no type checking).
- Amounts use decimal **points**, not Swedish commas: `34.02`, not `34,02`.
- `jamforpris` (kr/kg or kr/l) is the cross-store comparison key — fill it whenever the
  source exposes it.
- **Individual offers can carry their own validity date, distinct from the file-level
  `giltigt_fran`/`giltigt_till`** — Hemköp's webarchive source has a
  `data-testid="end-date"` per product ("Gäller t.o.m. DD/MM-YYYY"). There's no
  per-item schema field for this today, so the convention used so far: set the file's
  `giltigt_till` to whatever the *majority* of items say (normally the ISO week's
  Sunday), and don't worry about the handful of outliers (e.g. personal "Bara för
  dig" coupons routinely run 1-2 weeks longer than the regular flyer) — that
  distinction is already captured in `notering` for those, which is enough context for
  now. Don't invent a new per-item date field for this without checking whether it's
  actually needed by any UI first.
- Hemköp's "Bara för dig" personal coupons carry **no absolute price at all**, just a
  splash like "10 % rabatt" with no reference price nearby — `pris: null`,
  `pris_typ: 'rabatt'` is correct here (same as ICA's "Köp N betala för M" shape,
  which similarly gives no absolute total). Don't try to back-fill `pris` by guessing
  at a "typical" price for the product.

## 5. Wire the week in

- Save the finished file to `public/data/erbjudanden/<butik-id>/<vecka>.json`
  (`<vecka>` is `YYYY-Www`, matching the week-menu convention).
- Add `<vecka>` to `_index.json`'s `veckor` list for that store.
- Point `_latest.json` at the new week (per store) if it should become the UI default.

## 6. Verify

- `npm run test` (existing classification/logic unit tests must still pass).
- Load the app and check the **Fynd** tab (`npm run screenshot` or `npm run dev` +
  manual look) — confirm the new week's offers render under the expected category
  groupings (Protein/Grönt Färskt-Fryst/Frukt/Snacks/Övrigt), not just that the JSON
  parses.
