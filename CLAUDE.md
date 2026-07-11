# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working on this repo: cost discipline

This runs on a low-tier/personal account — token usage matters. Optimize for it:
- Read only the files you need, and only the parts you need (use offsets/limits on large files instead of reading everything).
- Don't spawn subagents for work you can do directly with a few tool calls — subagents re-derive context from scratch, which costs more than doing it inline.
- Batch independent tool calls (reads, greps) into one turn instead of one-at-a-time round trips.
- Reuse tooling already documented below instead of re-discovering it (see "Tooling" and "Lessons learned").
- Skip re-reading files you just wrote/edited — the tool result already confirms the change landed.

**Always be learning:** when a session uncovers a reusable trick, workaround, or gotcha (a working tool invocation, an environment quirk, a naming/terminology trap), add it to this file and/or commit the tool as a script under `scripts/`, so future sessions don't have to re-derive it. Treat this file as a living memory of the project, not a one-time writeup.

## Project overview

Matracet is a personal meal-planning web app for one Swedish family. It is intentionally minimal: no backend, no auth, no state manager, no router. All data lives as JSON files in Git. The app is a static React build hosted on GitHub Pages at `/matracet/`. A small `vitest` suite covers pure logic (`src/meals`, `src/presence`) — see Commands.

## Commands

```bash
npm install      # install dependencies (required first — a fresh clone has no node_modules,
                  # and `npm run build` fails with "vite: not found" until this has run)
npm run dev       # start dev server (Vite)
npm run build     # tsc + vite build → dist/
npm run preview   # serve the production build locally
npm run test      # vitest run (unit tests exist for src/meals, src/presence)
npm run screenshot -- <url> <output.png> [click-selector]  # visual verification, see below
```

There is no lint script configured.

### Visual verification (`scripts/screenshot.mjs`)

For UI changes, don't just eyeball the diff — actually render it. `playwright` is a devDependency purely for this; it's dev/agent tooling, not shipped to users.

```bash
npm run preview -- --port 4321 &        # or `npm run dev` for HMR while iterating
npm run screenshot -- http://localhost:4321/matracet/ /tmp/out.png "text=Fynd"
```

The third argument is an optional selector to click before capturing (e.g. to switch tabs). See the script's header comment for why it needs an explicit Chromium `executablePath` in the Claude Code remote sandbox (the sandbox's pre-installed browser build doesn't match what a freshly-installed `playwright` version expects by default — the script handles this with a fallback, no manual workaround needed).

## Architecture

### Two entry points

Vite is configured with two HTML entry points (`vite.config.ts`):
- `index.html` → main app (`src/main.tsx`)
- `sysdoc.html` → system documentation (`src/sysdoc.tsx`, at `/matracet/sysdoc/`)

### Component hierarchy

As of the 2026 "paper" redesign, the app dropped its old binder/two-page-spread/side-tabs
metaphor entirely in favor of a single-column phone-app layout with a home screen:

```
App          – fetches all data (rolling 7-day window, eaters, recipe index, presence)
├── Hub      – landing screen: tonight glance card, "Veckan" primary button, tool tile grid
├── VeckanView       – Vecka (read) / Planera (edit) mode toggle
│   ├── VeckanOverview – 7-day list, tap a day to jump into Planera
│   └── VeckanPlanner  – day cards (lunch|middag halves) + bottom/docked suggestion tray
├── HandlaView, ReceptView, FamiljView, AnteckningarView, FyndView, BevakaView
│                      – each a full single-column screen (own TopBar), no left/right split
├── RecipeOverlay      – full-screen recipe reader modal (unchanged by the redesign)
└── TopBar             – shared header (back button, eyebrow, title, optional right slot/progress)
```

There is no `Page`/`Tabs`/`Binder`/`PageSide` anymore — each screen owns its full content and
decides its own responsive layout (see "Styling" below for the wide/landscape breakpoint).
Navigation is a simple `screen: ScreenName` state in `App.tsx` (`'hub' | TabName`), not a router.

### Screens

| Screen (`ScreenName`) | Content |
|---|---|
| `hub` | Landing: tonight's dinner, "Veckan" shortcut, tiles for the rest |
| `veckan` | Vecka: 7-day overview. Planera: suggestion tray, tap/drag a recipe onto a day's lunch or middag slot |
| `handla` | Shopping list — ingredients column + bevaka/manual column (2-col on wide) |
| `recept` | Recipe list + detail, master-detail (stacked on mobile, side-by-side on wide) |
| `familj` | Presence schedule + eater profiles/rules (2-col on wide) |
| `anteckningar` | Current notes + long-term ideas (2-col on wide) |
| `bevaka` | Standing watch-list + current bargain matches (2-col on wide) |
| `fynd` | Store offers, all categories in one scroll (2-col grid on wide) |
| `skafferi` | Semesterläge: pantry-match cooking ideas, the stash pool, this week's offer cloud, manual add, recipe browser |

### Semesterläge: the Skafferi stash pool (2026-07)

A second, deliberately *not*-calendar planning mode for chaotic stretches (summer vacation,
"we don't know where we'll be or what we'll have") where planning specific days doesn't work,
but you still want to walk into the kitchen/freezer with real options. Added alongside — not
instead of — the existing Veckan calendar; nothing about Veckan/VeckanPlanner changed.

- **`usePlanMode`** (`matracet:planmode:v1`, `'normal' | 'semester'`) — one household-wide local
  flag, flipped by the pill button in `Hub`'s top bar (`.planmode-toggle`). It only changes what
  `Hub` leads with: `'normal'` shows the usual tonight-glance card, `'semester'` replaces it with
  a compact picker over the active stash pool (`.semester-card`). The `hub-primary` "Veckan"
  button and the rest of the tile grid are unaffected by the mode — the calendar stays one tap
  away either way. The **`skafferi`** hub tile is always visible, in both modes.
- **`useStash`** (`matracet:stash:v1`) — a flat (not date-keyed) pool of `StashItem`s, each either
  `kind: 'dish'` (a recipe-linked or freeform meal idea, e.g. "Grillburgare" with no recipe file
  behind it — there's no new recipe schema for this; per `komplett: false`'s existing precedent,
  a stub idea that proves to be a keeper should graduate into a real recipe file later, not grow
  its own parallel schema) or `kind: 'stock'` (a raw ingredient/offer pickup, e.g. "Fläskfärs
  500g"). `done: true` moves an item into an "Avklarat" section (kept, not deleted — same
  restore-don't-delete pattern as `useShoppingList`'s `removedIds`), consistent with this app's
  local-only-override convention (same tier as `useWeekPlan`/`useShoppingList`, not a git-tracked
  data file — this pool is meant to be disposable/reset-per-stretch, not durable).
- **`SkafferiView`** ties these together in one screen, funnel-shaped:
  1. *"Veckans fynd"* — every current offer (`useOffers`/`tagOffers`) as a tappable chip cloud
     (`.offer-cloud`), colored red when it carries real savings (`parseSavings`, now exported
     from `suggestions.ts`). Tapping pulls it into the pool as a `kind: 'stock'` item.
  2. *"Din pool"* — the current active stash items (both kinds), each removable/markable-done.
  3. *"Lägg till för hand"* — freeform add, with a `dish`/`stock` kind toggle, covering both
     "an idea to build a meal around" and "something we already have" (the latter is also where
     you'd note something bought last week that isn't from this week's offers at all).
  4. *"Vad kan vi laga?"* (`src/lib/pantryMatch.ts::matchPantryRecipes`) — recipes whose
     ingredients loosely match (same substring-either-direction heuristic as
     `suggestions.ts::findOfferMatch`) a **current `kind: 'stock'` pool item's name** specifically
     — deliberately a narrower/different question than `rankSuggestions`' "any offer matches any
     ingredient this week," since this is meant to answer "what can I actually cook from what
     I've already decided to buy/have," not "what's cheap in general." Kept as its own pure,
     tested function (`pantryMatch.test.ts`) rather than folded into `rankSuggestions`.
  5. *"Fler förslag"* — the same recipe-browser engine as `VeckanPlanner` (`rankSuggestions`,
     filter/sort chips), reused as-is, for open-ended browsing beyond what the pantry match found.
- Scope choice: a literal drag-and-drop "product cloud" (as originally described) was simplified
  to tap-to-toggle chips/buttons — same functional outcome ("pull this into the pantry"), far less
  fragile than drag physics on a mobile-first single-column layout, and consistent with this
  app's no-drag-in-Planera-anymore precedent (see the Planera history above).

### Week planning: discover-style suggestion list

`VeckanPlanner` (`src/components/week/VeckanPlanner.tsx`) went through two redesigns: first
replaced the old "⇄ Ersätt" modal with a horizontally-scrollable drag-to-day tray, then (2026-07)
that tray itself was replaced by a "select day, then tap a suggestion" flow, because the tray
made the day cards the main event when the actual job was to browse options. The day list now
collapses to a thin scrollable strip of pills at top (`.day-strip`/`.day-pill`, one per day in
the rolling window, each with two small dots showing whether lunch/middag are filled) — tapping
a pill sets `activeDate`, defaulting on mount to the first day with an empty slot. Below it,
`.active-day` shows the selected day's current lunch/middag (with "Recept ›" and "✕ clear"
actions), and everything under that is the suggestion list — now the tall, primary,
vertically-scrolling element (2-column grid at `min-width: 860px`), not a docked sidebar.

Each suggestion card (`src/lib/suggestions.ts::rankSuggestions`) shows *why* it's ranked — tags
render a matched offer's savings (`🏷 spara Xkr`, parsed from the offer's `besparing` string via
`parseSavings`, taking the max figure out of a range like `"10.80-14.58kr"`), prep time, vegan
status, and which present eaters like/refuse it (`❤ name` / `⚠️ name vägrar`) — and ends in two
always-visible assign buttons, `☼ Lunch` / `☾ Middag`, that write straight to `activeDate` via
`useWeekPlan.setMeal` (no drag, no intermediate "picked" state). A button shows `✓` instead of the
icon when that slug is already in that slot for the active day. Sort is a separate axis from the
existing filter chips (`Alla`/`🏷 Fynd`/`⚡ Snabbt`/`🌱 Vegansk`): `SuggestionSort` in
`suggestions.ts` — `match` (default score) / `savings` / `favorites` (like-count) / `fastest`
(tid_min) — deliberately kept as independent controls rather than one combined "smart" order, per
the intended "discover" feel of browsing ~30 ranked options many ways rather than one funnel.

Swaps for **both** lunch and dinner now persist through `useWeekPlan` (`matracet:weekplan:v2`,
`Record<date, { dinner?: WeekPlanOverride; lunch?: WeekPlanOverride; dinnerAttendance?: MealAttendance;
lunchAttendance?: MealAttendance }>` — bumped from `v1`, which only tracked dinners). Every place
that displays a day's meal must call
`applyOverride(rawMeal, getOverride(date, 'dinner' | 'lunch'), getAttendance(date, 'dinner' | 'lunch'))`.

Each active-day slot in `VeckanPlanner` also has a 👪 button opening a per-meal attendance editor:
toggle chips for every eater (defaulting to that day's presence-schedule group, from `DayPlan.presentPersons`)
let you mark someone normally home as away for just this one meal, or add someone not normally home
(e.g. a visiting guest) — stored as `MealAttendance.presentIds` (`null` = derive from the day's
presence plan; a non-null array is an explicit override). A separate "Ingen måltid behövs" toggle
(`MealAttendance.skip`) clears the meal slot entirely (dish and all) for nights/days no meal is
needed at all, e.g. eating out — `applyOverride` turns this into `recept: null` +
`anteckning: 'Ingen måltid behövs'`, so it also drops out of the `HandlaView` shopping-list
aggregation like any other note-only day. Assigning a new dish via `setMeal` automatically un-skips
the slot. `effectivePresentIds(planPresentIds, attendance)` is the shared helper for "who's actually
eating" — an explicit attendance override wins, otherwise it falls back to the day's presence-plan
group — used by `VeckanPlanner`'s suggestion ranking, `VeckanOverview`'s refusal-warning badges,
and `WeekWarnings`. Note this only affects meal-level display/aggregation, not `DayPlan.portions` or
the custody presence schedule itself — the presence resolver (Side A) remains the single source of
truth for custody; per-meal attendance is a lightweight, meal-scoped override on top of it, not a
way to edit the underlying schedule. `diffAttendance(planPresentIds, attendance)` (also in
`useWeekPlan.ts`) computes the away/extra id lists an override adds relative to the schedule
default — shared by `VeckanOverview` and `VeckanPlanner`'s own badge rendering. `FamiljView`'s
schedule pane (`SchedulePane`) additionally surfaces every active override for the rolling window
as an "Undantag denna vecka" list (via `collectAttendanceExceptions`, using the same
`getAttendance`/`diffAttendance`/`applyOverride` calls), so exceptions made while planning meals
are visible from the family/presence view too, not just inside Planera itself.

### Data loading

`App.tsx` computes a rolling 7-day window starting today (not a hardcoded week constant) and
fetches, in one `Promise.all`:
- `/matracet/data/eaters.json`
- `/matracet/data/recipes/_index.json`
- `/matracet/data/weeks/<w>.json` for every distinct ISO week (`YYYY-Www`) the 7-day window touches

It also resolves the custody/presence schedule for the same window via
`resolvePresenceRange` (`src/presence/resolver.ts`). Both `ReceptView` and `RecipeOverlay`
fetch individual recipes lazily: `/matracet/data/recipes/<slug>/recept.json`.

### URL base path

All fetch URLs and internal links must use the `/matracet/` prefix (Vite `base` is `/matracet/`). This is already set in `vite.config.ts`.

### Styling

A single vanilla CSS file `src/styles/paper.css` covers the entire app (replaced the old
`filofax.css` binder skin in the 2026 redesign — cream paper, near-black chrome, gold accent,
"paper" design language). There is no Tailwind. Design tokens live in `:root`:
- `--cream`, `--paper`, `--ink`: page background, card background, primary text/chrome
- `--gold`, `--gold2`: accent (active states, links, highlights)
- `--green`/`--green-d`/`--green-bg`, `--red`/`--red-bg`, `--blue`/`--blue-bg`: status colours (done/vegan, warning/refuses, info)
- `--muted`, `--muted2`, `--sub`, `--line`, `--line2`, `--checked`: secondary text and hairlines

Typography is plain Georgia/serif system stack (`font-family: Georgia, 'Times New Roman', serif`
on `body`) — no Google Fonts, no `<link>` tags in `index.html`. This is a deliberate simplification
from the old 5-webfont setup; don't re-add webfonts without discussing it, since the whole visual
language is built around the plainness of a system serif.

**Mobile-first, one shared wide/landscape breakpoint**: every screen renders single-column by
default; `@media (min-width: 860px)` is the one breakpoint used throughout to opportunistically
use extra width — multi-column tile grids (`.hub-grid`), 2-column screen bodies
(`.handla-grid`, `.familj-grid`, `.bevaka-grid`, `.note-grid`, `.fynd-scroll--wide`), a
list+detail split (`.recept-grid`), and the Planera suggestion tray docking to a sidebar instead
of a bottom sheet. This is CSS-only — no JS layout branching, no more per-side `PageSide` prop
threaded through every view.

## Data conventions

### Recipe files

Each recipe lives at `public/data/recipes/<slug>/recept.json`. The slug is the directory name — lowercase, hyphens, Swedish vowels transliterated (ö→o, ä→a, å→a).

Required JSON fields: `schema_version`, `slug`, `nummer`, `namn`, `tid_min`, `portioner`, `kategorier`, `ingredienser`, `instruktioner`, `komplett`.

Ingredients use Swedish field names: `vara` (item), `mangd` (amount), `enhet` (unit), optional `grupp` (ingredient subgroup).

Category values: `vegansk`, `vegetarisk`, `fisk`, `kott`, `glutenfri`, `laktosfri`.

`dagkedja` links a recipe to a "day chain" (e.g. use Monday's leftovers on Tuesday). Set to `null` if not applicable.

### Recipe index

`public/data/recipes/_index.json` is a manually maintained list of all recipes with lightweight fields only (slug, nummer, namn, tid_min, kategorier, bildUrl). **When adding a new recipe, add an entry here too.**

### Week menus

`public/data/weeks/YYYY-Www.json` — one file per week. The `recept` field in each day entry contains the **display name** of the meal (free text), not the recipe slug. Set `recept: null` and use `anteckning` for nights out.

Lunches use the same `DayMeal` shape as dinners, in a sibling `luncher` array (optional field on `WeekMenu`) instead of `middagar`. Only include the days that are actually planned — `App.tsx` falls back to `recept: null` for any day/meal not present. `VeckanView` renders a lunch line above the dinner dish when a matching entry exists for that date.

### Currently hardcoded data

`AnteckningarView` has its content hardcoded as constants inside the component. This is an MVP placeholder — it is not yet driven by JSON files.

### Shopping list ("Handla" tab)

`HandlaView` is fully derived, not hardcoded. It aggregates ingredients from this week's `rollingDays` **and** `rollingLunches` (both — a meal doesn't cook itself just because it's lunch; both go through `weekPlanStore` overrides now, since the Planera suggestion tray can swap either meal, not just dinner) by fetching each planned recipe (`useRecipes`) and summing `vara`+`enhet` across dishes (`aggregateIngredients` in `src/lib/shoppingList.ts`); items listed in `public/data/pantry.json` (`always_have` / `current_stock`) are skipped since the household already has them. A second section shows current watch-list bargains (`findBevakaHits`, shared with `BevakaView` via `src/lib/bevaka.ts`) plus manually added items.

All user edits are local-only (no backend, per this app's design), via `useShoppingList` (`src/hooks/useShoppingList.ts`, a `matracet:shopping:v1` local store): checking a row's checkbox means "I already have this / don't need it" — it moves the row into a "Bortmarkerat" section below the list (not deleted), where unchecking it moves it straight back to the active list above. This applies uniformly to computed ingredients, bevaka hits, and manually added items. There's no in-app way to permanently edit the underlying recipe/pantry/watch-list data from this view — the **"⧉ Kopiera lista"** button copies a plain-text snapshot of the current (active) list, grouped by section, plus a "Bortmarkerat" footer of currently-removed items, to the clipboard via a hidden `<textarea>` fallback, meant to be pasted into a Claude Code prompt so a future session can act on it (e.g. update `pantry.json`, tweak a recipe's ingredients, or refine `bevakningslista.json`).

Note the aggregate week data can be sparse — `rollingDays`/`rollingLunches` fall back to `recept: null` for any date without a JSON entry (see `App.tsx`), so a mostly-empty upcoming `weeks/*.json` file means a thin shopping list, not a bug in the aggregation. Check the actual week JSON before assuming the list is dropping something.

Two other flows feed the manual shopping list besides typing into "Eget tillägg": **double-clicking any offer row in `FyndView`** (both Alla and Jämför modes), and **pulling an offer into the Skafferi stash pool** (`SkafferiView`'s "Veckans fynd" chips, `kind: 'stock'`). Both go through `useShoppingList`'s `addOrRestoreByName`/`removeOrMarkByName`/`isActiveByName` helpers, which dedupe by name (case-insensitive) instead of creating a fresh `ManualShoppingItem` every time, and toggle through the existing restore-don't-delete `removedIds` mechanism rather than adding a second deletion path. `SkafferiView` also renders its own compact, small-format render of the active manual items (`.stash-shoplist`, `.shop-row--compact`) — the vacation-mode screen wants a glanceable list, not `HandlaView`'s full-size rows, so the compact styling was added as a second class rather than shrinking `.shop-row` everywhere.

### Store offers ("Fynd" tab)

`public/data/erbjudanden/<butik-id>/<vecka>.json` holds weekly store-offer flyers, one file per store per week (see `public/data/erbjudanden/README.md` for the full schema). `_index.json` lists all stores and all saved weeks (`veckor`); `_latest.json` points at the default week shown in the UI. **When adding a new week's offers, add the week to `_index.json.veckor` and repoint `_latest.json`, per store.**

The UI tab is called **Fynd** (`FyndView.tsx`, "finds/bargains" in Swedish) — a voice-transcribed request for "weekly fines" turned out to mean this feature ("fynd" → mis-heard as "fines"). If a request mentions store deals, discounts, offers, or savings and doesn't obviously match an existing tab, check `public/data/erbjudanden/` and `FyndView.tsx` before assuming the feature doesn't exist yet.

**Category taxonomy (2026-07 redesign)**: offers are now grouped by "what do I cook with" rather than store-shelf placement — `protein_farsk`/`protein_fryst` (meat, poultry, fish, seafood, eggs, and vegetarian/vegan protein like tofu/quorn/legumes, split fresh/frozen), `gront_farsk`/`gront_fryst` (vegetables, same split), `frukt` (fruit, no split), `snacks_godis` (unchanged), and `ovrigt` as a deliberate catch-all for dairy, bread, drinks, dry goods, hygiene/household, and ready-meals/desserts — see `public/data/erbjudanden/README.md`. `FyndView`'s `AllView` groups by this taxonomy with Färskt/Fryst sub-headings inside Protein/Grönt. `scripts/erbjudanden-lib.mjs`'s `guessKategori` (used by the `erbjudanden-parse-*.mjs` draft parsers) already guesses into this new scheme for future weeks.

### Watch-list ("Bevaka" tab)

`public/data/erbjudanden/bevakningslista.json` holds a standing list of products to bulk-buy whenever they're a genuine bargain (e.g. a coffee brand, toilet paper in the usual big pack, a specific toothpaste). Each entry (`BevakningItem` in `types.ts`) has `sok` (lowercase keyword substrings matched against an offer's `namn`/`marke`), `undvik_marken` (brand substrings that disqualify a match — e.g. "not Gevalia"), and `onskat_marke` (`src/lib/bevaka.ts::matchesBevakning`): when set, it's a **hard filter**, not just informational — the offer's `namn`/`marke` must contain it or the item is excluded, same tier as `undvik_marken`. This matters because `sok` alone is often generic (e.g. `"tandkräm"`/`"schampo"`/`"toalettpapper"`) and would otherwise flag every brand in that product category, not just the one the household actually wants. `storlek_hint`/`troskel_kr`/`anteckning` remain informational-only. `BevakaView.tsx` cross-references this list against the current week's offers (via `useOffers`, same hook as Fynd): the left page shows the full watch-list with a 🔔 badge on any item currently matched, the right page shows the matched offers grouped by item. **When adding a watch-list item, add an entry to `bevakningslista.json`** — there's no in-app "add" UI (consistent with this app's no-backend/JSON-in-git model), so new items or refinements (e.g. filling in a specific brand once decided) go straight into the file.

## Lessons learned

Durable gotchas discovered while working in this repo. Add to this list rather than rediscovering the same thing in a future session.

- **Fresh clone build failure**: `npm run build` fails with `vite: not found` until `npm install` has run — there's no lockfile-committed `node_modules`.
- **Playwright `text=` locators are substring matches, not exact**: `page.locator('text=Skafferi').first()` silently grabbed a "→ Öppna Skafferiet" button instead of the "Skafferi" hub tile once both existed on the same screen (semester mode), because both contain "Skafferi" as a substring and `.first()` just took whichever came first in DOM order — no error, the click just did nothing useful. When a screen might have more than one element containing your target word (increasingly likely as tabs/tiles/buttons accumulate), target a specific class/structure instead, e.g. `'.hub-tile:has-text("Skafferi")'`, or `page.locator('text=Skafferi').count()` first to check for ambiguity.
- **Offer/recipe data loads async in two extra hops beyond the page's own `networkidle`**: `useOffers` chains `_index.json` → `_latest.json` → the actual week file, and `useRecipes` fetches per-slug on mount — neither is done by the time `scripts/screenshot.mjs`'s fixed 400ms post-click wait fires. For a screen that renders from these hooks (anything using `useOffers`/`useRecipes`, e.g. `SkafferiView`, `VeckanPlanner`), write a one-off multi-step script (see the pattern already noted below) and `page.waitForSelector` on something only present once data has actually arrived (e.g. `.offer-chip`), rather than trusting a fixed timeout.
- **Playwright in the Claude Code remote sandbox**: the sandbox pre-installs Chromium at `/opt/pw-browsers/chromium` (a symlink to the real binary) and sets `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, but a `playwright` version installed via `npm install` in this repo may not match the pre-installed browser revision, so the default `chromium.launch()` (no `executablePath`) can fail with "Executable doesn't exist". `scripts/screenshot.mjs` handles this: try the default resolution first (works on non-sandbox machines), fall back to the sandbox path. Don't run `playwright install` — it's disabled by design and will just fail/no-op.
- **Playwright multi-step interaction scripts** (clicking through several UI steps, not just one screenshot) should mirror `scripts/screenshot.mjs`'s launch pattern exactly: `chromium.launch()` in a try/catch falling back to `executablePath: '/opt/pw-browsers/chromium'`, and `page.goto(url, { waitUntil: 'networkidle' })`. A bare `chromium.launch()` + default `waitUntil: 'load'` intermittently hung/timed out against a local `vite preview` server in this sandbox even though `curl` reached it fine — switching to that exact pattern fixed it immediately. Also: `vite preview`'s dev server has no persistent profile across separate script runs, so multi-step interactions (e.g. click → screenshot → click again) need to happen within one script/one browser session, not chained separate `node script.mjs` invocations.
- **Swedish terminology traps**: this app's data and UI use Swedish terms throughout (`erbjudanden`/fynd = offers, `vecka` = week, `butik` = store, `recept` = recipe). Voice-to-text requests about the app can mangle these into unrelated-sounding English words (see the Fynd/"fines" case above) — when a request doesn't map cleanly to a known tab/feature, grep `public/data/` and `src/components/views/` for near-matches before concluding it's a new feature.
- **Store-offer PDF imports are cheap if you avoid reading them as images**: the uploaded flyer PDFs (Willys/ICA/Hemköp, often 30–200 pages) have a real text layer — `pdftotext -layout` (poppler-utils; `apt-get install -y poppler-utils` if missing) extracts it almost for free, vs. paying vision-token costs to read each page as an image. Willys and Hemköp's structured list render as a 2-column grid that `-layout` squashes onto shared lines with a ragged (non-fixed) column boundary — `scripts/erbjudanden-split-columns.mjs` splits each line at its widest whitespace run to recover two clean single-column text streams. From there `scripts/erbjudanden-parse-{ica,willys,hemkop}.mjs` turn the text into draft offer JSON (see `public/data/erbjudanden/README.md` for the full workflow and known gaps). Treat parser output as a draft: ICA's export mixes in non-food items that need manual filtering, Hemköp's origin/country data only exists in the separate graphic reklamblad (not the structured list), and page-break artifacts occasionally scramble one or two items that need hand-fixing.
- **Some uploaded "flyer" PDFs are graphic-only screenshots of a store's web page (no usable text layer at all)** — `pdftotext` returns empty output (check `pdfinfo`/page count first; the upload UI's page count can differ from `pdfinfo`'s, e.g. it reported 39/224 pages for PDFs that were actually 10/12 real pages — trust `pdfinfo`). For these, skip straight to the `Read` tool's multimodal PDF paging (`pages: "N-M"`, ≤20 pages/call) and transcribe the visible price tags/labels by eye. This also **sidesteps Hemköp's known font-substitution trick** (README's "det grafiska bladet är oläsligt" warning is about the *text layer*, where digits are remapped to wrong Unicode codepoints for scraping-resistance) — the glyphs still *render* correctly as pixels, so a vision read gets the real numbers even when `pdftotext` on the same PDF would return garbage digits. Watch for numbers genuinely obscured by decorative page elements (e.g. a black cutout shape or a UI overlay bar in the screenshot) — those are actually unreadable and should become `null` rather than a guess; re-`Read` just that one page at a smaller range if a price looks cut off before giving up on it.
- **CSS flex-shrink trap: `overflow: hidden` on a flex item makes its automatic minimum size 0.** A scrollable list built as `display: flex; flex-direction: column` (for the `gap` shorthand) nested inside a height-constrained ancestor (`max-height` + `overflow-y: auto`) will, once its content's natural height exceeds that max-height, shrink every flex item down toward its minimum size to try to fit — and because each item (`.recipe-card-wrap`, in this case) had `overflow: hidden` for rounded corners, the spec's "automatic minimum size is 0 for non-visible overflow" kicked in and every card collapsed to ~2px instead of the list just overflowing into the scrollbar as intended. Symptom: Playwright reports a click "intercepted" by the parent wrapper div even though the button inside looks normal-sized in a screenshot at a *narrower* viewport where the collapse doesn't trigger (it only shows up once real content overflows the constrained container, e.g. `ReceptView`'s recipe list at the `min-width: 860px` two-column layout with 100+ recipes). Fix: don't use `display: flex` on a list purely for the `gap` property if any ancestor constrains its height with `overflow: auto` — use `display: block` and `margin-bottom` on items instead, or add `flex-shrink: 0` / `min-height` explicitly to every item.
- **Willys can also arrive as a Safari `.webarchive` of `willys.se/erbjudanden/ehandel`** (a "Save Page As → Web Archive" export), not just a print-to-PDF. `scripts/erbjudanden-webarchive-extract.py` pulls the raw HTML out (it's a binary plist; `WebMainResource.WebResourceData` is the page bytes — stdlib `plistlib`, no extra deps). That HTML is schema.org-tagged (`itemtype="https://schema.org/Product"`, `itemprop="name"/"brand"`, `data-testid="product-price-LOYALTY"` vs `"...-GENERAL"` for Willys Plus member-only prices) and gives **exact** price digits — a strictly better source than the PDF export, which needs the glued-digit/column-split dance. `scripts/erbjudanden-parse-willys-html.mjs` parses it via regex on those stable itemprop/data-testid markers (not the volatile styled-components `sc-xxxx` hash classes, which can change on any Willys redeploy). Two things this source does *not* expose anywhere in the markup (confirmed absent, not just missed): a "Jmf-pris" field and an "Ordinarie pris" field — so `jamforpris` is only filled when an item is already priced per kg/l directly (loose-weight goods), and `ord_pris` is derived as `pris + besparing` from the "Spara X kr" note (verified this matches the page's own `itemprop=price` meta value for single-buy items — but that meta field is *not* usable directly as a general-purpose price source: for "N för"-multibuy items it instead silently mirrors the 30-day-low price, not the regular price, with no markup difference to tell the two cases apart). Label icons (`img[title]`, e.g. "Nyckelhålsmärkt", "Från Sverige", "KRAV-märkt") map straight to `markeringar`. A brand+size field like `"OMEGA 4x125g"` needs the size-splitting regex to tolerate `x`/`-`/`/` *inside* the numeric part (`"4x125g"`, `"350-500g"`) before requiring the trailing unit letters — a naive "first digit+unit" regex truncates the brand at the first embedded separator instead of the real boundary.
- **Presence/custody model: a real Fri–Fri custody block spans two ISO calendar weeks, so one BIWEEKLY anchor can't cover it.** `src/presence/seed.ts`'s `RULES` originally modeled custody as "classify each Mon–Sun ISO week as Daniel's-or-mother's, using one anchor per weekday-group" — which quietly assumed the Fri–Sun part and the following Mon–Thu part of one real custody handover both live in the same ISO week. They don't: Fri–Sun sits in one Mon-Sun week, the Mon–Thu that continues the same real-world block sits in the *next* one. `resolver.ts`'s `weeksBetween` computes parity via `isoWeekMonday`, so a rule's Fri-Sun half and Mon-Thu half need anchors exactly one ISO week apart to represent one continuous custody block, even though they're "the same block" in reality — using a single shared anchor across all 7 weekdays silently classifies the block's Mon–Thu tail as the *opposite* custody type. Fixed by giving each of the 4 half-blocks (Daniel-weekend, Daniel-midweek, mother-weekend, mother-midweek) its own anchor 7 days offset from its weekend counterpart; see the comment above `RULES` for the worked ISO-week table. If custody rules ever look "off by one week" again, check for this exact trap before assuming the anchor date itself is wrong.
- **Schema gotcha when hand-authoring `erbjudanden[]` entries** (as opposed to running them through the `erbjudanden-parse-*.mjs` scripts, which already get this right): `ord_pris`, `pris_30dgr`, and `besparing` are `string | null` in `src/types.ts`, not numbers — a plain float there passes JSON validity but breaks `FyndView`/`BevakaView` at runtime (`c.ord_pris.includes is not a function`) since the UI calls `.includes()`/string methods on them expecting a string like `"49.85-52.95"`. Only `pris` is numeric. If writing a one-off Python/JS builder script for a manually-transcribed week, wrap those three fields in `str(...)` (or template-literal) unconditionally rather than passing the raw number, and smoke-test with the `run`/screenshot workflow before considering the data done — `npm run build`/`tsc` won't catch this since the JSON has no compile-time type checking.
- **iOS "Add to Home Screen" uses a separate storage container from Safari itself**, even for the identical URL — it's Apple's sandboxing for standalone web apps, not a bug in this app. Since there's no backend, all user edits (`useWeekPlan`'s `matracet:weekplan:v2`, `useShoppingList`'s `matracet:shopping:v1`) live only in `localStorage`, so edits made in the browser tab never show up in the home-screen icon's instance and vice versa — the two are, in effect, two independent app installs that happen to share a URL. There's also no service worker/manifest in this repo, so a home-screen icon can serve a stale cached JS/CSS bundle for a long time after a deploy. `Hub.tsx`'s `hardRefresh()` (⟳ button top-right of the hub) works around the caching half of this by navigating to the same URL with a `?_r=<timestamp>` cache-busting query param — since Vite content-hashes JS/CSS filenames, a fresh `index.html` fetch pulls in whatever's actually latest — while deliberately *not* touching `localStorage`, so it can't be used to "fix" the separate-storage-container issue (there is no fix for that from app code; it's OS-level isolation).
- **Don't trust an old miscategorized field as a migration fallback — it just launders the bug forward.** The 2026-07 `erbjudanden[].kategori` retaxonomy (`scripts/erbjudanden-recategorize.mjs`) first tried "reclassify by keyword on `namn`, else fall back to the *old* `kategori`" for items the new keyword lists didn't match. That silently propagated the old parser's own mistakes — e.g. "Salta jordnötter" (peanuts) and "Naturella pinjenötter" had originally been keyword-guessed as `kott_fagel` (meat) by the PDF-import parser, so the fallback re-emitted them as `protein_farsk`, reproducing the exact "vegetables/nuts filed under meat" complaint the retaxonomy was meant to fix. Fix was to make the *old* category untrusted for anything except the one bucket spot-checked as clean (`snacks_godis`, real candy brand names) and let everything else genuinely unmatched fall to `ovrigt`. Lesson: when re-deriving a field that was itself heuristically guessed, verify new-vs-old mismatches by re-deriving from the *original source signal* (here: product name) — don't use the old derived value as a safety net, since a wrong guess and "no guess" look identical from that fallback's point of view.
- **Same trap, different shape: short Swedish keywords substring-match inside unrelated compound words.** Bare `'nöt'` (meant for `nötkött`/beef) matches inside `jordnötsringar` (peanut rings); `'sill'` (herring) matches inside `fusilli` (pasta); `'böna'`/`'bönor'` (beans) matches inside `kaffebönor` (coffee beans); `'ägg'` (egg) matches inside `pålägg` (generic "sandwich topping", any kind) and `äggnudlar`/`äggpasta` (egg noodles, a starch not a protein dish). None of these are word-boundary-fixable in general because Swedish compounding *requires* substring-anywhere matching for the intended cases (`nötfärs`, `fläskfilé`, `kycklingfärs` all rely on the keyword appearing mid-compound) — so the fix is a small explicit strip-list of the *specific* colliding words (see `sanitize()`/`FRUIT_NON_PRODUCE_RE` in `scripts/erbjudanden-recategorize.mjs` and `scripts/erbjudanden-lib.mjs`), not a blanket boundary regex. When adding a new keyword to either script's classifier, grep the existing offer `namn` fields for the keyword as a substring first to catch this before it ships.
- **A CSS-anchored popover inside any ancestor with `overflow: hidden` gets hard-clipped, not pushed into scroll.** `.recipe-detail`'s `overflow: hidden` (there for the header image's rounded corners) silently clipped `PersonSentimentPopover` (the "Vad tycker familjen?" sentiment picker in `ReceptView`'s detail pane) whenever it opened from an avatar far enough right (Annabelle/Erika) that the fixed-width 220px box ran past the card's edge — this looked in a screenshot like a hard-cut box edge, not an off-screen overflow, because the clip boundary was the ancestor card, not the viewport. Fixed by anchoring the popover with `position: fixed` computed from the trigger button's `getBoundingClientRect()` (captured on click, passed down as an `anchorRect` prop) and clamping `left` to `[12px, innerWidth - 220 - 12]` — this escapes *any* ancestor's overflow clipping and viewport edges in one fix, vs. the CSS-only `left`/`right` flip class I tried first, which only fixed the viewport-edge case and left the ancestor-clip bug untouched. **Trap while building this**: don't add a `window.addEventListener('scroll', onClose, { capture: true })` to auto-close a fixed-position popover on scroll — in this sandbox, some scroll-adjacent event fired immediately after the click that opened it (plausibly Playwright's own scroll-into-view as part of `.click()`, but unconfirmed), closing the popover the instant it opened with zero visible error. Diagnosed by dumping `outerHTML` of the popover's parent right after the click — it was simply absent — and bisecting by removing the scroll/resize listeners, which fixed it immediately. Landed without scroll-to-close: outside-click and Escape are enough, and a `position: fixed` popover just stays put on-screen if the page scrolls under it (acceptable tradeoff, not attempted to fix further).

## Deploy

Pushing to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`) which runs `npm ci && npm run build` and deploys `dist/` to GitHub Pages. No manual steps needed.
