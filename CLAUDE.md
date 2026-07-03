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

```
App           – fetches initial data (week, eaters, recipe index)
└── Binder    – manages active tab and portrait-mode side flip
    ├── Page (left)  – renders the left half of the spread
    ├── rings        – decorative binder rings
    ├── Page (right) – renders the right half of the spread
    └── Tabs         – navigation tabs along the right edge
```

Each `Page` renders one view based on `activeTab`. Every view component receives `side: PageSide` (`'left' | 'right'`) and is responsible for splitting its own content between the two sides. For example, `VeckanView` shows Mon–Wed on the left and Thu–Sun on the right.

### Tabs and views

| Tab (`TabName`) | Left page | Right page |
|---|---|---|
| `veckan` | Mon–Wed meals | Thu–Sun meals |
| `handla` | Shopping groups A | Shopping groups B |
| `recept` | Recipe list (scrollable) | Recipe detail (loaded on demand) |
| `familj` | First 2 eater profiles | Remaining eaters + weekly routine |
| `anteckningar` | Current notes | Long-term ideas |
| `bevaka` | Standing watch-list | Current bargain matches |

### Data loading

`App.tsx` fetches three resources on mount using `Promise.all`:
- `/matracet/data/weeks/<CURRENT_WEEK>.json`
- `/matracet/data/eaters.json`
- `/matracet/data/recipes/_index.json`

The active week is hardcoded at the top of `App.tsx` as `const CURRENT_WEEK = '2026-W21'`. **Update this string when adding a new week.**

`ReceptView` fetches individual recipes lazily: `/matracet/data/recipes/<slug>/recept.json` when the user selects a recipe.

### URL base path

All fetch URLs and internal links must use the `/matracet/` prefix (Vite `base` is `/matracet/`). This is already set in `vite.config.ts`.

### Styling

A single vanilla CSS file `src/styles/filofax.css` covers the entire app. There is no Tailwind. Design tokens live in `:root` CSS variables at the top of the file:
- `--leather-*`: binder cover colours
- `--paper`, `--paper-edge`, `--line`, `--line-margin`: page colours and ruled lines
- `--t-veckan`, `--t-handla`, etc.: tab accent colours
- `--ink`, `--ink-soft`, `--ink-blue`, `--ink-red`: text colours

Typography is Google Fonts loaded in `index.html`:
- **Fraunces** (serif) — page titles, day numbers
- **Caveat** (cursive) — meal names, prominent handwritten text
- **Patrick Hand** (cursive) — ingredients, notes, body copy
- **Inter Tight** (sans-serif) — labels, UI chrome
- **JetBrains Mono** (monospace) — dates, codes, metadata

Portrait/mobile layout is handled entirely via `@media (orientation: portrait), (max-width: 700px)` — one page at a time with flip buttons.

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

`HandlaView` is fully derived, not hardcoded. The left page aggregates ingredients from this week's `rollingDays` **and** `rollingLunches` (both, not dinners only — a meal doesn't cook itself just because it's lunch; only `rollingDays` goes through `weekPlanStore` overrides since only dinners have a swap/"Ersätt" flow) by fetching each planned recipe (`useRecipes`) and summing `vara`+`enhet` across dishes (`aggregateIngredients` in `src/lib/shoppingList.ts`); items listed in `public/data/pantry.json` (`always_have` / `current_stock`) are skipped since the household already has them. The right page shows current watch-list bargains (`findBevakaHits`, shared with `BevakaView` via `src/lib/bevaka.ts`) plus manually added items.

All user edits are local-only (no backend, per this app's design), via `useShoppingList` (`src/hooks/useShoppingList.ts`, a `matracet:shopping:v1` local store): checking a row's checkbox means "I already have this / don't need it" — it moves the row into a "Bortmarkerat" section below the list (not deleted), where unchecking it moves it straight back to the active list above. This applies uniformly to computed ingredients, bevaka hits, and manually added items. There's no in-app way to permanently edit the underlying recipe/pantry/watch-list data from this view — the **"⧉ Kopiera lista"** button copies a plain-text snapshot of the current (active) list, grouped by section, plus a "Bortmarkerat" footer of currently-removed items, to the clipboard via a hidden `<textarea>` fallback, meant to be pasted into a Claude Code prompt so a future session can act on it (e.g. update `pantry.json`, tweak a recipe's ingredients, or refine `bevakningslista.json`).

Note the aggregate week data can be sparse — `rollingDays`/`rollingLunches` fall back to `recept: null` for any date without a JSON entry (see `App.tsx`), so a mostly-empty upcoming `weeks/*.json` file means a thin shopping list, not a bug in the aggregation. Check the actual week JSON before assuming the list is dropping something.

### Store offers ("Fynd" tab)

`public/data/erbjudanden/<butik-id>/<vecka>.json` holds weekly store-offer flyers, one file per store per week (see `public/data/erbjudanden/README.md` for the full schema). `_index.json` lists all stores and all saved weeks (`veckor`); `_latest.json` points at the default week shown in the UI. **When adding a new week's offers, add the week to `_index.json.veckor` and repoint `_latest.json`, per store.**

The UI tab is called **Fynd** (`FyndView.tsx`, "finds/bargains" in Swedish) — a voice-transcribed request for "weekly fines" turned out to mean this feature ("fynd" → mis-heard as "fines"). If a request mentions store deals, discounts, offers, or savings and doesn't obviously match an existing tab, check `public/data/erbjudanden/` and `FyndView.tsx` before assuming the feature doesn't exist yet.

### Watch-list ("Bevaka" tab)

`public/data/erbjudanden/bevakningslista.json` holds a standing list of products to bulk-buy whenever they're a genuine bargain (e.g. a coffee brand, toilet paper in the usual big pack, a specific toothpaste). Each entry (`BevakningItem` in `types.ts`) has `sok` (lowercase keyword substrings matched against an offer's `namn`/`marke`), `undvik_marken` (brand substrings that disqualify a match — e.g. "not Gevalia"), and optional `onskat_marke`/`storlek_hint`/`troskel_kr`/`anteckning` for extra context. `BevakaView.tsx` cross-references this list against the current week's offers (via `useOffers`, same hook as Fynd): the left page shows the full watch-list with a 🔔 badge on any item currently matched, the right page shows the matched offers grouped by item. **When adding a watch-list item, add an entry to `bevakningslista.json`** — there's no in-app "add" UI (consistent with this app's no-backend/JSON-in-git model), so new items or refinements (e.g. filling in a specific brand once decided) go straight into the file.

## Lessons learned

Durable gotchas discovered while working in this repo. Add to this list rather than rediscovering the same thing in a future session.

- **Fresh clone build failure**: `npm run build` fails with `vite: not found` until `npm install` has run — there's no lockfile-committed `node_modules`.
- **Playwright in the Claude Code remote sandbox**: the sandbox pre-installs Chromium at `/opt/pw-browsers/chromium` (a symlink to the real binary) and sets `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, but a `playwright` version installed via `npm install` in this repo may not match the pre-installed browser revision, so the default `chromium.launch()` (no `executablePath`) can fail with "Executable doesn't exist". `scripts/screenshot.mjs` handles this: try the default resolution first (works on non-sandbox machines), fall back to the sandbox path. Don't run `playwright install` — it's disabled by design and will just fail/no-op.
- **Playwright multi-step interaction scripts** (clicking through several UI steps, not just one screenshot) should mirror `scripts/screenshot.mjs`'s launch pattern exactly: `chromium.launch()` in a try/catch falling back to `executablePath: '/opt/pw-browsers/chromium'`, and `page.goto(url, { waitUntil: 'networkidle' })`. A bare `chromium.launch()` + default `waitUntil: 'load'` intermittently hung/timed out against a local `vite preview` server in this sandbox even though `curl` reached it fine — switching to that exact pattern fixed it immediately. Also: `vite preview`'s dev server has no persistent profile across separate script runs, so multi-step interactions (e.g. click → screenshot → click again) need to happen within one script/one browser session, not chained separate `node script.mjs` invocations.
- **Swedish terminology traps**: this app's data and UI use Swedish terms throughout (`erbjudanden`/fynd = offers, `vecka` = week, `butik` = store, `recept` = recipe). Voice-to-text requests about the app can mangle these into unrelated-sounding English words (see the Fynd/"fines" case above) — when a request doesn't map cleanly to a known tab/feature, grep `public/data/` and `src/components/views/` for near-matches before concluding it's a new feature.
- **Store-offer PDF imports are cheap if you avoid reading them as images**: the uploaded flyer PDFs (Willys/ICA/Hemköp, often 30–200 pages) have a real text layer — `pdftotext -layout` (poppler-utils; `apt-get install -y poppler-utils` if missing) extracts it almost for free, vs. paying vision-token costs to read each page as an image. Willys and Hemköp's structured list render as a 2-column grid that `-layout` squashes onto shared lines with a ragged (non-fixed) column boundary — `scripts/erbjudanden-split-columns.mjs` splits each line at its widest whitespace run to recover two clean single-column text streams. From there `scripts/erbjudanden-parse-{ica,willys,hemkop}.mjs` turn the text into draft offer JSON (see `public/data/erbjudanden/README.md` for the full workflow and known gaps). Treat parser output as a draft: ICA's export mixes in non-food items that need manual filtering, Hemköp's origin/country data only exists in the separate graphic reklamblad (not the structured list), and page-break artifacts occasionally scramble one or two items that need hand-fixing.

## Deploy

Pushing to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`) which runs `npm ci && npm run build` and deploys `dist/` to GitHub Pages. No manual steps needed.
