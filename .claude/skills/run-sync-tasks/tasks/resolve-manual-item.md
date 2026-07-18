# Task type: resolve-manual-item

Emitted by `HandlaView.tsx`'s `submitAdd()` whenever someone types a plain "Eget tillägg"
shopping-list item with no offer attached (e.g. "kaffe") — unlike items added from Fynd,
Bevaka, Skafferi, or a recipe's ingredient picker, which already carry a real offer
reference or recipe source. The point of this task is to close that gap: find the item a
real current offer, the same way a human browsing Fynd would.

## Payload

```jsonc
{ "vara": "kaffe" }
```

`vara` is the exact text the user typed (already trimmed by the app).

## Procedure

1. Load the current offer index: `public/data/erbjudanden/_latest.json` (which week is
   "current" per store) and `_index.json` (which weeks exist at all, per store).
2. For each store's current week file (`public/data/erbjudanden/<butik>/<vecka>.json`),
   search `erbjudanden[]` for a `namn` that plausibly matches `vara` — use the same
   substring-either-direction heuristic already established elsewhere in this app
   (`src/lib/suggestions.ts`'s `findOfferMatch`: `hay.includes(name) || name.includes(hay)`,
   case-insensitive), not a stricter exact match — "kaffe" should match "Gevalia
   Mellanrost Snabbkaffe" the same way a household member browsing Fynd would expect.
3. If multiple stores/products match, prefer (in order): a match carrying real savings
   (`besparing` parses to a non-zero kr figure, see `parseSavings` in `suggestions.ts`),
   then the cheapest `pris`. Use judgment, not just the first hit — read a handful of
   candidates before picking, the same discipline `import-erbjudanden`'s classification
   work uses.
4. If nothing plausible matches in any store's current week, outcome is `'not-found'` — do
   **not** guess a semi-related product. A wrong "kaffe" → "kaffegrädde" resolution is worse
   than leaving it unresolved for the household to pick by hand in the app.
5. On a match, outcome is `'applied'` with:
   ```jsonc
   { "vara": "<the original, unmodified payload.vara>", "offerRef": { "store": "<butik id>", "week": "<vecka, e.g. 2026-W29>" } }
   ```
   `vara` in the result must be byte-identical to the payload's `vara` — `src/lib/
   syncTaskOutcomes.ts`'s applier matches on it case-insensitively but doesn't fuzzy-match,
   so an altered string here would silently fail to attach on the device.

## What NOT to do

- Don't write anything to `matracet:shopping:v1` or any other synced store directly — you
  have no write path there anyway (it's the device's local storage), and the whole point of
  `result.offerRef` is that the device applies it itself on its next boot.
- Don't touch the actual `erbjudanden/*.json` offer files — this task only *reads* them to
  find a match, same as the app's own `findOfferMatch` does; it never corrects or recategorizes
  them (that's `sync-category-feedback`'s job, a different task entirely).
