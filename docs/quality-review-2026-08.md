# Kvalitetsgenomgång 2026-08

A quality review of the whole repo at commit `967ba42` (post-#101/#102), plus a staged plan
to fix what it found. Written to be actionable without re-deriving the evidence — every
finding below was verified by running something, not by reading code and guessing.

**Status: all four stages implemented in the same session the review was written.** See
"What shipped" at the end of this document for exactly what changed and how each fix was
verified.

## Baseline: what's actually healthy

Worth stating first, because most of this repo is in good shape and the plan below should
not read as "everything is broken":

- `npm run build` passes with a real `tsc -b` type-check (the no-op-`tsc` trap from
  CLAUDE.md's Lessons learned is genuinely fixed — verified by running it).
- `npm test`: 18 files, 187 tests, all green, 1.5s.
- **Data integrity is clean.** Verified by script, not by eye:
  - 129 recipes, 129 directories, index ↔ filesystem match exactly, no duplicate slugs,
    no recipe missing a required field, every `slug` matches its directory name, every
    ingredient has a `vara`.
  - 2,197 offers across 6 weeks × 3 stores: **zero** schema violations — no numeric
    `ord_pris`/`pris_30dgr`/`besparing` (the runtime-crash trap documented in Lessons
    learned), no non-numeric `pris`, no offer missing `namn`.
  - `parseSavings` was checked against all 338 distinct real `besparing` strings; the
    en-dash range format (`"8.80–10.00kr"`) parses correctly. No misfires found.
- Code hygiene is good: no `any`, no `@ts-ignore`, no stray `console.log` in app code,
  memoization used consistently and correctly in the large components.

The findings below are the exceptions.

---

## Findings

### F1 — A failed boot fetch strands the app on "Laddar…" forever · **High**

`src/App.tsx:110-111`:

```ts
fetch('/matracet/data/eaters.json').then(r => r.json()),
fetch('/matracet/data/recipes/_index.json').then(r => r.json()),
```

These two have no `.catch()` and no `r.ok` check, unlike the four fetches directly beneath
them which have both. The outer `Promise.all(...).then(...)` also has no `.catch()`. So if
either request fails — offline, flaky kitchen wifi, a GitHub Pages hiccup, or a 404 whose
HTML body makes `r.json()` throw `SyntaxError` — the whole chain rejects, `setEaters` never
runs, and `App`'s gate

```ts
if (!eaters || rollingDays.length === 0) return <div className="app-loading">Laddar…</div>
```

renders "Laddar…" **permanently**, with an unhandled rejection in the console and no retry
path short of a manual reload.

This is the same failure mode CLAUDE.md explicitly designs *against* for the sync effects
("so a slow or failing device-sync fetch can't add a second way for `Laddar…` to spin
forever") — the primary data path just never got the same treatment. It matters most on a
phone in a kitchen, which is the app's entire deployment target.

### F2 — Module-level promise caches poison permanently on a failed fetch · **High**

`usePantry.ts:9`, `useBevakningslista.ts:9`, and `useOffers.ts:12,17`:

```ts
if (!cache) cache = fetch(URL).then(r => r.json() as Promise<Pantry>)
```

The cache stores the *promise*. If it rejects, the rejected promise stays cached for the
lifetime of the page — every later call, every remount, every navigation back to the screen
returns the same rejection. There is no recovery even after the network comes back.

`useRecipes.ts` and `useMeals.ts` get this right (`r.ok` check + `.catch()` fallback), so the
correct pattern already exists in the codebase — these four are the drift.

Consequences differ by hook, and the pantry one is the nastiest because it's silent:

| Hook | Symptom if the fetch ever fails |
|---|---|
| `useOffers` (`loadIndex`/`loadLatest`) | Fynd, Bevaka, Skafferi and Planera's offer panel stuck on "loading" forever |
| `usePantry` | **Silent wrong behaviour** — `pantry` stays `null`, so "redan hemma" never applies and the ingredient picker pre-checks staples the household already owns |
| `useBevakningslista` | Bevaka renders empty as if the watch-list were empty |

### F3 — `findOfferMatch` false-positives on ~half its matches · **High**

`src/lib/suggestions.ts:53-63` matches a recipe to an offer with a bare
substring-either-direction test. Run against the real corpus (129 recipes × 377 offers in
2026-W31):

- **121 of 129 recipes (94%) get an offer match.**
- Of those 121, only 62 are word-boundary plausible. **34 are clear mid-word false
  positives**, 25 more are reverse-direction (some legitimate, e.g. offer `"Pasta"` inside
  ingredient `"pasta, gärna tagliatelle"`; some not).

Real examples straight out of the data:

| Recipe | Matched because | Offer |
|---|---|---|
| Råggmunk med lingon | `"ägg"` inside `pål**ägg**` | Smörgåspålägg |
| Linsgryta med kokos och lime | `"ris"` inside `F**ris**co` | Frisco Hamburgerbröd |
| Böngryta med spenat | `"bröd"` inside `Wiener**bröd**` | Wienerbröd |
| Fisksoppa med saffran | `"olja"` inside `Oliv**olja**` | Olivolja Classico |

This is exactly the substring-collision family CLAUDE.md has documented and fixed **five
separate times** in the erbjudanden classifier (`pålägg` is even called out by name there) —
but `findOfferMatch` is a completely separate matcher that never got any of those guards.
`TRIVIAL_INGREDIENTS` only covers water/salt/pepper.

Why it matters beyond noise: the offer match is the single largest term in the ranking
(`score += 3`, more than any other signal), it renders a `🏷 spara Xkr` badge that reads as a
concrete reason to cook the dish, and it's what the `🏷 Fynd` filter chip and the `savings`
sort key off. When it fires for 94% of recipes with half of those wrong, the bargain signal
carries approximately no information.

Secondary flaw in the same function: `offers.find(...)` returns the **first** offer in array
order, not the highest-savings one — so even a correct match can advertise a 2 kr saving
while a 40 kr match on the same recipe sits further down the array.

### F4 — No error boundary anywhere · **Medium**

`grep` for `ErrorBoundary|componentDidCatch|getDerivedStateFromError` across `src/` returns
nothing, and `main.tsx` renders `<App />` bare. Any render-time exception unmounts the whole
tree to a white screen. There's no service worker and no router, so the only recovery is a
manual reload — and per CLAUDE.md, an iOS home-screen install can be serving a stale bundle
that reliably re-triggers the same crash.

### F5 — Test coverage gaps in pure, high-traffic logic · **Medium**

`src/lib/` is generally well tested (13 of 24 modules), but four untested ones carry real
decision logic that a bug hides silently in:

| Module | What's untested |
|---|---|
| `suggestions.ts` | `rankSuggestions` scoring/sorting, `findOfferMatch`, `parseSavings` — F3 lives here and no test would have caught it |
| `storeOrder.ts` | Aisle ranking/grouping, the whole shopping-list ordering |
| `bevaka.ts` | `matchesBevakning` (incl. the empty-`sok` category-wide watch case), `tagOffers`, `toOfferRef` |
| `useWeekPlan.ts` | `applyOverride`, `effectivePresentIds`, `diffAttendance` — the core of every plan-rendering screen, 292 lines, reachable as pure functions |

`useWeekPlan` is the highest-value of the four: six call sites depend on `applyOverride`, and
CLAUDE.md already records one shipped bug in this area (the swap path having no coverage,
found only in review).

### F6 — `classify()` runs in the browser inside sort comparators · **Low**

Two things stacked, both already flagged in CLAUDE.md as an unmet acceptance criterion
("no classifier runs in the browser") but never quantified:

`storeOrder.ts`'s `guessAisleId` calls the full regex cascade with no memoization, and it's
called from `aisleRank` *inside* a sort comparator, then again from `groupByAisle` (which
re-sorts). Measured: **~196 `classify()` calls per HandlaView render** for a 40-item list.

Measured cost: 5.2µs per call, so ~1.1 ms per render. **Not a user-visible problem** — worth
fixing as a 3-line memo `Map` when the file is next touched, not worth a dedicated pass. The
more interesting half is the correctness one already documented: classifying a bare
hand-typed name with no brand context is the weakest input the classifier ever gets.

### F7 — Modal accessibility · **Low**

`IngredientPickerModal`, `CategoryFeedbackModal` and `MealEditorModal` have no `role="dialog"`,
no `aria-modal`, no focus trap, and **no Escape-to-close** (only `RecipeOverlay` handles
Escape). Eight list rows (`HandlaView`, `SkafferiView`, `VeckanOverview`) are clickable
`<div>`s with no keyboard equivalent.

For a phone-first app used by one family this is genuinely low priority; Escape-to-close is
the one bit with real day-to-day value, since the app is also used on a desktop browser.

### F8 — `VeckanPlanner.tsx` is 703 lines with a 280-line JSX return · **Low**

Nearly 2× the next-largest component. It is *well* organised internally (19 correct `useMemo`s,
no obvious re-render bugs) — this is a maintainability observation, not a defect, and it should
only be split when a feature lands that needs to touch it anyway. Flagged so it doesn't grow
unnoticed.

### Not in scope / already tracked

Open issues #101 and #103 (recipe share-link preview cards) are separate live work and are not
addressed here. The known-open items CLAUDE.md already discloses honestly — `varutyp` populated
for only 12 of 1,348 lexicon entries, the `merge-device-sync` workflow never dispatched, "✕
Avboka" being a no-op on a purely derived row — remain open and remain correctly documented; no
new information was found about any of them.

---

## Plan

Ordered by value-per-effort. Stages 1–3 are the ones that matter; each is independently
shippable and independently reviewable.

### Stage 1 — Boot and fetch resilience (fixes F1, F2, F4)

The app's failure modes should be visible and recoverable rather than silent and permanent.

1. Give `eaters.json` and `_index.json` the same `r.ok` check the four fetches below them
   already have, and add a `.catch()` on the outer `Promise.all`.
2. Add a real error state to `App`: on failure, render a message plus a "Försök igen" button
   that re-runs the effect, instead of an eternal "Laddar…". These two files are the only
   ones the app genuinely cannot start without.
3. Fix the poisoned-cache pattern in `usePantry`, `useBevakningslista`, and `useOffers`'s
   `loadIndex`/`loadLatest` — mirror the shape `useRecipes`/`useMeals` already use, and
   additionally **clear the cache variable on rejection** so a later attempt can retry rather
   than replaying the failure.
4. Add a minimal `ErrorBoundary` around `<App />` in `main.tsx` — one message, one reload
   button that appends the `?_r=<timestamp>` cache-buster `Hub.hardRefresh()` already uses, so
   it doubles as the escape hatch from a stale home-screen bundle.

Verify: unit tests for the retry-after-failure behaviour of each cache, plus one Playwright
pass with the data routes mocked to fail, confirming the error UI renders and the retry button
actually recovers once the mock is lifted.

### Stage 2 — Make the bargain signal mean something (fixes F3)

1. Add tests for `suggestions.ts` **first**, capturing today's behaviour including the four
   documented false positives as explicit "currently wrong" cases — so the fix is demonstrably
   a fix and not a values change.
2. Tighten `findOfferMatch`:
   - Require a **word-boundary** match on the offer-name side, using the whitespace/edge
     anchoring technique from CLAUDE.md's `\böl\b` lesson — *not* `\b`, which silently
     mismatches around å/ä/ö.
   - Keep reverse-direction matching (offer name inside a longer ingredient phrase) — the data
     shows it's mostly legitimate (`"Pasta"` ⊂ `"pasta, gärna tagliatelle"`) — but require the
     offer name to be a whole word there too, which is what kills `"Paj"` ⊂ `"pajdeg"`.
   - Add a minimum length guard so 3-letter ingredients (`ris`, `ägg`) can't match mid-word at
     all.
3. Return the **best** match rather than the first: rank candidates by `parseSavings`
   descending.
4. Re-run the corpus measurement afterwards and record the new match rate in the commit
   message. Target: the match rate drops well below today's 94% and the mid-word false
   positives go to zero. Do not chase 100% precision — a loose heuristic is fine here, an
   uninformative one is not.

### Stage 3 — Cover the untested decision logic (fixes F5)

In value order, one test file each, no production changes unless a test finds something:

1. `useWeekPlan.ts` — `applyOverride` (all six call sites depend on it), `effectivePresentIds`,
   `diffAttendance`, and the skip/attendance interaction.
2. `bevaka.ts` — `matchesBevakning` including `undvik_marken` and the empty-`sok` category-wide
   case, `tagOffers` (specifically that `week` is populated — CLAUDE.md records a real shipped
   bug there), `toOfferRef`.
3. `storeOrder.ts` — aisle rank/sort/group, plus a regression test per collision family already
   documented (`färs`/`färsk`, `mjöl`/`mjölk`, `fil`/`filé`).

Use real fixture data pulled from `public/data/`, not invented strings — the corpus is where
every collision bug in this repo has actually come from, and CLAUDE.md's own post-mortems are
emphatic that a fixture derived from the code under test proves nothing.

### Stage 4 — Opportunistic, only when touching the file anyway

- Memoize `guessAisleId` with a `Map` (F6) — do it next time `storeOrder.ts` is edited.
- Escape-to-close on the three modals (F7) — the one a11y item with real daily value; extract
  the `useEffect` `RecipeOverlay` already has into a tiny shared hook rather than copying it
  three times.
- Split `VeckanPlanner.tsx` (F8) — only alongside a feature that already touches it.

### Explicitly not proposed

- **No linter.** CLAUDE.md notes there's no lint script, and adding ESLint to a
  single-developer repo with a clean `tsc -b` would cost more in setup and churn than it
  returns here.
- **No `<div onClick>` → `<button>` sweep.** Eight rows, phone-first app, one household; the
  work isn't repaid.
- **No restructuring of the sync/classifier architecture.** Both are extensively reasoned about
  in CLAUDE.md, and this review found no evidence contradicting those decisions.

---

## What shipped

All four stages were implemented in the same session, in order, each verified before moving
to the next. 241 tests pass (up from 187), `npm run build` (real `tsc -b`) is clean.

**Stage 1 — fetch resilience.**
- `App.tsx`'s `eaters.json`/`_index.json` fetches now check `r.ok` and throw on failure; the
  whole boot `Promise.all` has a `.catch` that sets a new `loadError` state instead of an
  unhandled rejection.
- A real error screen ("Kunde inte ladda appen… Försök igen") replaces the eternal "Laddar…"
  — the retry button re-runs the boot effect via a `reloadAttempt` counter.
- `usePantry`, `useBevakningslista`, and `useOffers`'s `loadIndex`/`loadLatest` all clear their
  module-level cache on a failed fetch, so a later call retries instead of replaying the same
  rejection forever (mirrors the pattern `useRecipes`/`useMeals` already used correctly).
- `src/components/ErrorBoundary.tsx` (new) wraps `<App />` in `main.tsx` — a render-time
  exception now shows a reload button (which appends `?_r=<timestamp>`, the same cache-buster
  `Hub.hardRefresh()` uses) instead of a white screen.
- Verified with a throwaway Playwright script (not committed): mocked `eaters.json` to 500,
  confirmed the error UI appears; un-mocked it and confirmed the retry button recovers into
  the normal app shell.

**Stage 2 — `findOfferMatch` precision.**
- `src/lib/suggestions.test.ts` (new, 16 tests) written *first*, capturing the four documented
  mid-word false positives (`ägg`/`Smörgåspålägg`, `ris`/`Frisco`, `bröd`/`Wienerbröd`,
  `olja`/`Olivolja`) as failing cases against the un-fixed implementation — confirmed they
  actually failed (6 of 16) before touching the implementation.
- `findOfferMatch` now requires a real word boundary on both match directions
  (`containsWord`, anchored on literal non-word characters rather than JS's `\b`, which
  doesn't treat å/ä/ö as word characters — same trap as CLAUDE.md's `\böl\b` lesson), and
  returns the candidate with the highest `parseSavings`, not the first array match.
- Re-measured against the real 2026-W31 corpus (129 recipes × 377 offers) after the fix: 116
  of 129 recipes still get a match (down slightly from 121), but every one of the 116 was
  hand-checked and is a genuine whole-word ingredient↔offer pairing (butter, olive oil,
  ground beef, coconut milk, …) — zero mid-word false positives remain. The fix mainly
  changed *which* offer wins per recipe, not how many recipes match at all, which in
  hindsight is the right outcome: most recipes in this library really do share a plausible
  ingredient with at least one of 377 real offers.
- All 16 new tests pass; full suite green.

**Stage 3 — test coverage.**
- `src/hooks/useWeekPlan.test.ts` (new, 16 tests): `applyOverride` (meal resolution, virtual
  vs. real meals, `varianter` clearing, skip-attendance priority), `effectivePresentIds`,
  `diffAttendance` (away/extra in both directions, null-plan edge case).
- `src/lib/bevaka.test.ts` (new, 11 tests): `matchesBevakning` (keyword match, brand-field
  match, `undvik_marken`, the empty-`sok` category-wide case and its interaction with
  `undvik_marken`), `tagOffers`, `toOfferRef`, `findBevakaHits`.
- `src/lib/storeOrder.test.ts` (new, 11 tests): `guessAisleId` regression tests for all three
  documented collision families (`färs`/`färsk`, `mjöl`/`mjölk`, `fil`/`filé`), `aisleRank`,
  `aisleLabel`, `sortByAisle`, `groupByAisle` — using real classifier output as fixtures, not
  invented strings, per CLAUDE.md's repeated "verify against the real corpus" lesson.
- One test-authoring mistake caught by running the suite, not assumed: an initial
  `sortByAisle`/`groupByAisle` test expected plain ASCII alphabetical order
  (Äpplen before Bananer); Swedish `localeCompare` collation sorts Å/Ä/Ö *after* Z, so the
  code was right and the test's expectation was fixed, not the code.

**Stage 4 — opportunistic cleanups.**
- `guessAisleId` now memoizes by name in a `Map`, eliminating the ~196 `classify()` calls per
  HandlaView render measured during the review (cheap either way at ~5µs/call, but free to
  remove entirely).
- `src/hooks/useEscapeToClose.ts` (new) extracts the Escape-key-dismiss behavior
  `RecipeOverlay` already had into a shared hook, now also used by
  `IngredientPickerModal`, `CategoryFeedbackModal`, and `MealEditorModal` — previously only
  outside-click/backdrop-tap could dismiss those three.
- Verified with a throwaway Playwright script (not committed): opened the ingredient picker
  from a real recipe card, pressed Escape, confirmed the modal actually closed.
- `VeckanPlanner.tsx`'s size (F8) was left as-is per the plan — a maintainability note, not a
  defect, to split only when a feature already touches that file.
