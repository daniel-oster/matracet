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
├── RecipeOverlay      – full-screen recipe reader modal, opened from every screen via `onOpenRecipe`
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
| `handla` | Shopping list — one unified, aisle-ordered list (ingredients + bevaka + manual merged, single column at every width) |
| `recept` | Recipe list; tap a card to open it in the shared full-screen `RecipeOverlay` |
| `familj` | Presence schedule + eater profiles/rules (2-col on wide) |
| `anteckningar` | Current notes + long-term ideas (2-col on wide) |
| `bevaka` | Standing watch-list + current bargain matches (2-col on wide) |
| `fynd` | Store offers, all categories in one scroll (2-col grid on wide) |
| `skafferi` | Semesterläge: pantry-match cooking ideas, the stash pool, this week's offer cloud, manual add, recipe browser |
| `historik` | Read-only log of meals actually eaten (`public/data/history.json`), newest first |
| `synka` | Export this device's local ratings/changes as a file to paste into a Claude Code chat for backend sync |

### Recipe viewing: converged on the shared full-screen overlay (2026-07)

`ReceptView` ("Receptbiblioteket") used to be the one screen in the app that didn't open recipes
through `RecipeOverlay` — it had its own inline master-detail split (`RecipeDetail`, rendered in
a `.recipe-detail-pane` next to the list) predating the "paper" redesign, left over even though
the Component hierarchy doc already (incorrectly) described it as a plain single-column screen.
On mobile that detail pane rendered *below* the full recipe list rather than popping up, so
opening a recipe from the library felt broken/inconsistent with every other entry point (Hub,
Veckan, Skafferi), which all pass `onOpenRecipe` straight to `App.tsx`'s `overlaySlug` state.
Fixed by deleting `RecipeDetail`/`RecipeEmpty` entirely and wiring `ReceptView`'s cards to the
same `onOpenRecipe` prop — tapping any recipe, from anywhere in the app, now always opens the
same full-screen `RecipeOverlay`. Also fixed while touching this: `RecipeOverlay` was a centered
dialog/bottom-sheet (`max-width: 720px`, rounded corners, dimmed backdrop) that only switched to
a 2-column ingredients|instructions layout at `min-width: 860px` — a *desktop-width* breakpoint
that most phones never reach even rotated to landscape, so "flip the phone for two columns"
silently never triggered on a real device. The overlay is now always full-bleed (`100dvh`, no
backdrop, no rounded corners — recipes are primary content here), and the two-column layout
triggers on `(min-width: 860px), (orientation: landscape) and (max-height: 600px)` — the second
clause specifically catches a phone in landscape (short viewport height) regardless of its width.
Each column (`.overlay-ingredients-col`/`.overlay-instructions-col`) scrolls independently in
that mode (`overflow-y: auto; height: 100%`, with the shared `.overlay-panel` switching to
`overflow-y: hidden` so it isn't a second competing scroll container), and the ratio is `1fr 2fr`
(ingredients ≈ a third of the width, instructions the rest) rather than the old `1fr 1.3fr`. The
hero image is hidden in two-column mode — on a landscape phone (~375–430px of height total) it
would otherwise eat the vertical space the ingredient/instruction columns need.

A follow-up pass replaced the sticky `.overlay-toolbar` (a full-width dark bar reserving ~56px)
with small floating circular controls in two-column mode specifically, since that's exactly where
vertical space is scarcest (a landscape phone) — the close button and wake-lock toggle become
`position: fixed`, `background: transparent` on the row itself (with `pointer-events: none` so the
now-invisible full-width row doesn't block clicks/scroll-drag on the ingredient/instruction text
underneath it) and `pointer-events: auto` restored on the two buttons themselves so they stay
clickable. The recipe title is hidden in this mode (no room, and the column headers "Ingredienser"
/"Tillagning" already say what you're looking at). Portrait/mobile mode keeps the original solid
sticky toolbar unchanged — plenty of headroom there, not worth touching.

### Skafferi & chaos mode: the stash pool

A deliberately *not*-calendar planning tool for chaotic stretches (summer vacation, "we don't
know where we'll be or what we'll have") where planning specific days doesn't work, but you
still want to walk into the kitchen/freezer with real options.

- **`useStash`** (`matracet:stash:v1`) — a flat (not date-keyed) pool of `StashItem`s, each either
  `kind: 'dish'` (a recipe-linked or freeform meal idea, e.g. "Grillburgare" with no recipe file
  behind it — there's no new recipe schema for this; per `komplett: false`'s existing precedent,
  a stub idea that proves to be a keeper should graduate into a real recipe file later, not grow
  its own parallel schema) or `kind: 'stock'` (a raw ingredient/offer pickup, e.g. "Fläskfärs
  500g"). `done: true` moves an item into an "Avklarat" section (kept, not deleted — same
  restore-don't-delete pattern as `useShoppingList`'s `removedIds`), consistent with this app's
  local-only-override convention (same tier as `useWeekPlan`/`useShoppingList`, not a git-tracked
  data file — this pool is meant to be disposable/reset-per-stretch, not durable).
- **`StashPantryPanel`** (`src/components/StashPantryPanel.tsx`) is the reusable "what do we have,
  what can we cook with it" panel — self-contained (owns its own `useStash`/`usePantry`/`useOffers`/
  `useShoppingList` calls), used in two places:
  1. *"Vad kan vi laga?"* (`src/lib/pantryMatch.ts::matchPantryRecipes`) — recipes whose
     ingredients loosely match (same substring-either-direction heuristic as
     `suggestions.ts::findOfferMatch`) something on hand, where "on hand" (`haveNames`) is
     `pantry.json`'s `always_have`/`current_stock` **plus** the active stash pool's `kind: 'stock'`
     items combined — deliberately a narrower/different question than `rankSuggestions`' "any
     offer matches any ingredient this week," since this answers "what can I actually cook from
     what I already have or decided to buy," not "what's cheap in general." Kept as its own pure,
     tested function (`pantryMatch.test.ts`) rather than folded into `rankSuggestions`.
  2. *"I ditt skafferi"* — the current active stash items (both kinds), each removable/markable-done.
  3. *"Veckans fynd"* — every current offer (`useOffers`/`tagOffers`) as a tappable chip cloud
     (`.offer-cloud`), colored red when it carries real savings (`parseSavings`, exported from
     `suggestions.ts`). Tapping pulls it into the pool as a `kind: 'stock'` item.
  4. *"Lägg till för hand"* — freeform add, with a `dish`/`stock` kind toggle, covering both
     "an idea to build a meal around" and "something we already have" (the latter is also where
     you'd note something bought last week that isn't from this week's offers at all).
- **`SkafferiView`** wraps `StashPantryPanel` with two more sections of its own: a compact
  "Inköpslistan" mirror of the manual shopping list, and "Fler förslag" — the same recipe-browser
  engine as `VeckanPlanner` (`rankSuggestions`, filter/sort chips) for open-ended browsing beyond
  what the pantry match found — plus the "Avklarat" done-items list. Reached via the **`skafferi`**
  hub tile.
- **`VeckanPlanner`** (Planera) embeds the *same* `StashPantryPanel` when **chaos mode** is on —
  see below — instead of duplicating the pantry-match/stash-pool logic a second time.
- Scope choice: a literal drag-and-drop "product cloud" (as originally described) was simplified
  to tap-to-toggle chips/buttons — same functional outcome ("pull this into the pantry"), far less
  fragile than drag physics on a mobile-first single-column layout, and consistent with this
  app's no-drag-in-Planera-anymore precedent (see the Planera history above).

**Chaos mode** (`useChaosMode`, `matracet:chaosmode:v1`) is a household-wide local on/off flag,
flipped by a pill button (`.planmode-toggle`) inside `VeckanPlanner` itself — a second attempt at
the "vacation mode" idea after the first one (a Hub-level toggle that swapped Hub's tonight-glance
card for a stash preview) was removed for being the wrong altitude: swapping a glance card on the
*landing screen* didn't change how you actually plan, and the pantry-match logic lived in a
separate screen (Skafferi) you had to remember to go tap. This version scopes the flag to Planera
specifically and changes what Planera *is*, not just what Hub shows:
- **Off (default)**: the original day-strip → pick a day → browse/assign-to-day-and-meal flow,
  unchanged. Below the suggestion filters, a **"🔓 Ett köp bort"** section
  (`src/lib/unlockMatch.ts::findUnlockOpportunities`) surfaces which single missing ingredient
  would unlock the most additional dishes — recipes missing *exactly one* ingredient from
  `haveNames` (same pantry+stash combination as above), grouped by that ingredient and ranked by
  how many recipes it unlocks (only surfaced when it'd unlock more than one dish — unlocking a
  single dish isn't an interesting "efficient purchase" signal). Tapping an ingredient chip
  expands the list of dishes it unlocks (tap through to open one); a "+ handla" button adds the
  ingredient straight to the shopping list via `useShoppingList.addOrRestoreByName`. This is
  deliberately the opposite question from pantry-match's "what can we cook *right now*" — during
  normal-mode planning, "what we can already cook" is table stakes (you're shopping for the week
  anyway); "what one purchase would open up the most options" is the actually-useful signal, so it
  gets the unlock framing instead.
- **On**: Planera's whole day-slotting flow (day-strip, active-day slot editor, suggestion list)
  is replaced by `StashPantryPanel` — day-by-day slotting isn't the point when you don't know what
  day is going to look like; the point is walking into the kitchen with real options. Switching
  chaos mode back off returns to day-by-day planning exactly as it was; nothing about `useWeekPlan`
  or day assignment changed, chaos mode only changes which UI gets shown.

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
- `/matracet/data/history.json` (see "Eating history..." below)
- `/matracet/data/feedback.json` (git baseline, merged into local feedback — see below)
- `/matracet/data/weeks/<w>.json` for every distinct ISO week (`YYYY-Www`) the 7-day window touches

It also resolves the custody/presence schedule for the same window via
`resolvePresenceRange` (`src/presence/resolver.ts`). `RecipeOverlay` fetches individual recipes
lazily: `/matracet/data/recipes/<slug>/recept.json`.

### Eating history, feedback sync, and the planning brief (2026-07)

Three pieces work together to get real household data — which is otherwise local-only, since
there's no backend — into git where it's durable, shared across devices, and usable for planning:

1. **`scripts/build-brief.ts`** (`npm run brief`) is a pre-existing, deterministic (no LLM, no
   network) script that resolves the *upcoming* ISO week and writes `planning-brief.json`: per-day
   presence/portions/vegan-requirement, the recipe index with derived protein + sentiment, pantry
   staples, and `recentHistory` (what was eaten in each of the last two ISO weeks). It's meant to be
   hand-fed to an LLM planning session as one deterministic snapshot — see the file's own header
   comment. This already existed before the eating-history feature below; it just wasn't documented
   here yet.
2. **`src/lib/exportData.ts`**'s `downloadLocalData()` (wired to the **Synka** screen, reached via
   the Hub's 🔄 tile — previously a small button buried in `ReceptView`, moved out for
   discoverability) downloads **every** `matracet:*` localStorage key on this device as one JSON
   file (`ExportPayload.stores`, a generic `Record<string, unknown>` built by iterating
   `localStorage` directly — see "Local storage export" below). The user pastes that into a Claude
   Code chat; the **`sync-local-storage`** skill (`.claude/skills/sync-local-storage/SKILL.md`)
   merges only the `matracet:feedback:v1` entry into `public/data/feedback.json` **per (recipe,
   person)** — never a wholesale overwrite, since the git file already holds ratings merged in from
   other devices/sessions. Every other store (weekplan, shopping list, stash, chaos-mode,
   irrelevant-offers, ...) stays local-only; syncing them is explicitly out of scope for that skill.
   `build-brief.ts` already reads `feedback.json` for sentiment + exclusions
   (`excludeFromWeekPlan`) — this is the git file's only consumer besides the app itself.
3. **`public/data/history.json`** (`HistoryEntry`/`HistoryFile` in `src/types/history.ts`) fills a
   gap neither of the above covers: meals that were **never planned at all**, most often during
   Skafferi/chaos-mode stretches where there's no day-slot to swap in the first place. There's no
   in-app way to add an entry — it's written entirely by the **`log-meal`** skill
   (`.claude/skills/log-meal/SKILL.md`), which the user talks to conversationally ("we grilled
   burgers Tuesday"); the skill can also offer to save a good spontaneous dish as a real recipe stub
   (`komplett: false`, same precedent as the Skafferi stash pool's dish stubs) and record per-person
   ratings using the exact same `likes`/`dislikes`/`refuses` values the app's UI uses — deliberately
   not a new rating scale. `HistorikView` (Hub → 📜 Historik) is a read-only viewer, newest first.
   `build-brief.ts` folds `history.json` entries from the last two weeks into the same
   `recentHistory` list the weeks-derived entries go into (tagged `source: 'planerat' | 'spontant'`)
   — so a spontaneous meal actually feeds the next week's planning, not just the log. Bumped the
   brief's `schemaVersion` to `1.2` for this additive field.

`useFeedback.ts`'s `mergeFeedbackBaseline(baseline)` is the app-side half of point 2: called once
from `App.tsx` after `feedback.json` loads, it seeds any `(recipe, person)` rating present in the
git file but missing from this device's local storage — local edits always win on conflict, this
only fills gaps. Kept as a plain exported function (not a new hook API) specifically so none of
`useFeedback()`'s existing call sites (`RecipeFeedbackBar`, `WeekWarnings`, `VeckanOverview`,
`FamiljView`, `suggestions.ts`) needed to change.

#### Local storage export — new stores need no export code, but check whether they need a sync rule

`src/lib/exportData.ts`'s `buildExportPayload()` iterates `localStorage` directly for every key
prefixed `matracet:` and dumps it into `ExportPayload.stores` — it does **not** hand-pick stores by
name. This means adding a new `createLocalStore('matracet:whatever:v1', ...)` anywhere in the app
(see `src/lib/localStore.ts`) is automatically included in every future export with **zero**
changes needed here — this was previously a hand-maintained list (`feedback`/`weekplan`/
`shoppingList` only) that had already drifted out of date by the time `stash`, `chaos-mode`, and
`irrelevant-offers` stores were added, so don't reintroduce that pattern by switching back to named
fields.

Being *in the export* is not the same as being *synced to git*, though — that's a second, deliberate
step. The `sync-local-storage` skill only merges the `matracet:feedback:v1` entry into
`public/data/feedback.json`; every other key is intentionally left local-only (see the skill file
for the exact reasoning per store). If a new store's data should also become durable/shared across
devices the way feedback ratings are, that requires **both**:
1. Nothing — the export already includes it.
2. An explicit update to `.claude/skills/sync-local-storage/SKILL.md` describing the merge rule for
   that specific key (and probably a new `public/data/<whatever>.json` backend file, following the
   `feedback.json` precedent: a stable named shape, read tolerantly, never wholesale-overwritten by
   a sync).

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

**Phone-landscape gets the same wide layout as desktop, everywhere (2026-07 sweep)**: `RecipeOverlay`
was originally the only screen that also triggered its wide 2-column CSS for a phone physically
rotated to landscape (narrow but short viewport) via `(orientation: landscape) and (max-height: 600px)`
alongside `(min-width: 860px)` — every other `@media (min-width: 860px)` block in `paper.css` fired
only on desktop-width viewports, so a landscape phone (e.g. 844×390) got stuck in single-column
mobile layout despite having the same "extra horizontal room, scarce vertical room" shape the overlay
was built for. Audited every view and appended the same `, (orientation: landscape) and
(max-height: 600px)` clause to every wide-layout breakpoint: `.app-shell` max-width, `.hub-grid`
(3 cols), `.vecka-list` (was single-column at *any* width before this — now 2 cols in landscape/wide,
closing the one screen that had no wide treatment at all), `.sugg-list` (Planera + Skafferi),
`.handla-grid`, `.fynd-scroll--wide`, `.bevaka-grid`, `.familj-grid`, `.note-grid`,
`.recipe-scroll-list`. Also shrank the sticky `.topbar-row`/`.hub-topbar` padding and title size
under `(orientation: landscape) and (max-height: 600px)` alone (not combined with desktop-width,
which isn't short on vertical space) — same "reclaim scarce height" move the overlay toolbar made,
since a phone in landscape is only ~375–430px tall total and the original full-size sticky header
alone ate a disproportionate chunk of that. Verified via `scripts/screenshot.mjs`-style Playwright
checks at an 844×390 viewport (Hub, Veckan/Vecka, Handla, Familj, Fynd) — all switched to their
multi-column layouts as expected.

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

### Shopping list ("Handla" tab) — manual-only (2026-07 rework)

**The shopping list only ever grows from an explicit user action. Nothing is ever placed on
it automatically.** This replaced the original design, where `HandlaView` silently aggregated
ingredients from the whole week's planned meals *and* every current watch-list ("Bevaka")
match every time you opened the tab — in practice this produced a list dozens of rows long
that the user never asked for and didn't want, especially once a few `bevakningslista.json`
entries turned out to have empty `sok` (category-wide watches — see the Watch-list section
below) that matched every offer in a whole category. The fix wasn't a smarter filter on top of
the automatic aggregation; it was to remove the aggregation entirely. Every other screen
(Veckan, Recept, Fynd, Bevaka, Skafferi) still exists to help you *decide* what to buy — it
just never writes to the list without you tapping something first.

`useShoppingList` (`src/hooks/useShoppingList.ts`, a `matracet:shopping:v1` local store) is now
the *only* source `HandlaView` reads from — `manualItems: ManualShoppingItem[]`. There is no
week-plan or bevaka read in `HandlaView.tsx` at all (the old `aggregateIngredients` in
`shoppingList.ts` and its `AggregatedIngredient` type were deleted as dead code once nothing
called them; `findBevakaHits`/`tagOffers` in `bevaka.ts` are still used, just no longer by
`HandlaView` — see below). `ManualShoppingItem` carries an optional `amount`/`source` (e.g.
`"500 g"` / `"Ugnsbakad lax"`) set when an item arrives via the recipe picker (next
paragraph), rendered as the row's amount-prefix and `.shop-meal-tag` "why", same visual shape
the old auto-aggregated ingredient rows had — the *display* didn't need to change, only how a
row gets onto the list in the first place.

**Adding a recipe's ingredients: a review checklist, never a bulk dump.** `RecipeOverlay` (the
shared full-screen recipe view opened from every screen in the app) has a
**"🛒 Lägg till i inköpslistan"** button above the ingredient list. It opens
`IngredientPickerModal` (`src/components/IngredientPickerModal.tsx`) — every ingredient listed
with its own checkbox, all checked by default *except* ones already covered by
`pantry.json`'s `always_have`/`current_stock` (labeled "redan hemma" so the reason is visible,
not just a silent omission) — matching the "usually I want most of it, just uncheck a few"
framing this feature was built for. Confirming calls `useShoppingList.addOrRestoreByName` once
per checked ingredient with `{ amount, source }`. **Gotcha hit building this**: `usePantry()`
fetches `pantry.json` asynchronously, so a naive `useState(() => ...filter by pantrySkip...)`
computed on mount always saw an *empty* pantrySkip (nothing had loaded yet) and every
ingredient stayed checked regardless of pantry contents — caught by screenshotting the modal
and comparing against the "redan hemma" labels, which *did* show correctly since those are
computed fresh on every render from the (eventually loaded) `pantry` value, while the initial
`checked` state had already been committed and never revisited. Fixed with a one-time
`useRef` + `useEffect` that un-checks the pantry-covered rows exactly once, the first time
`pantry` actually loads, rather than trying to compute the right initial value on mount. Watch
for this same shape of bug anywhere else a `useState` initializer wants a value from a hook
that itself loads asynchronously — the initializer only runs once, before that data can
possibly have arrived.

**Bevaka matches**: clicking a `BevakaView` "Fynd nu" match row (the whole `.match-row`, same
"click the row" convention as `FyndView`'s double-click, `.in-list` + a 🛒 badge shown once
added) calls `useShoppingList`'s `addOrRestoreByName`/`removeOrMarkByName`/`isActiveByName` —
this is now the *only* way a bevaka match reaches the shopping list; being on the watch-list and
matching an offer no longer implies it's wanted this week. (This landed as its own small PR in
parallel with the rest of this manual-only rework and merged slightly ahead of it — noting the
convention here so the two don't quietly re-diverge if either gets touched again.)

**One unified list (2026-07, still true post-rework)**: all shopping-list rows — however they
got added — share one `ShopRow` shape (`{ main, why?, storeKey, taggable }`) and render as a
single flowing list, no source-based section headers (`.handla-list`, single-column at every
width, capped `max-width: 640px` — an aisle-walk order shouldn't be split into two visual
columns). Checking a row's checkbox means "I already have this / don't need it" — it moves into
a "Bortmarkerat" section below (not deleted; tapping it there restores it) via
`useShoppingList`'s restore-don't-delete `removedIds`. The **"⧉ Kopiera lista"** button copies a
plain-text snapshot (`buildShoppingListText` in `shoppingList.ts`) of the current
(active, store-filtered) list plus a "Bortmarkerat" footer, meant to be pasted into a Claude
Code prompt.

Three flows feed the list besides typing into "Eget tillägg": the recipe ingredient picker
above, **double-clicking any offer row in `FyndView`** (both Alla and Jämför modes), and
**pulling an offer into the Skafferi stash pool** (`SkafferiView`'s "Veckans fynd" chips,
`kind: 'stock'`). All three go through `addOrRestoreByName`/`removeOrMarkByName`/
`isActiveByName`, which dedupe by name (case-insensitive) instead of creating a fresh
`ManualShoppingItem` every time. `SkafferiView` also renders its own compact render of the
active manual items (`.stash-shoplist`, `.shop-row--compact`).

**Aisle ("store walk") ordering (2026-07)**: the list is meant to end up ordered by which store
an item should be bought in, then by that store's actual shelf layout — but neither
shopping-list items nor recipes carry a store assignment yet, so `src/lib/storeOrder.ts` ships
an interim "normal order" placeholder until real per-store aisle layouts are configured.
`AISLE_CATEGORIES` defines the category set + labels (Frukt & Grönt → Bröd → Kött & Fisk →
Mejeri & Ägg → Skafferi → Fryst → Dryck → Snacks & Godis → Hushåll & Hygien → Övrigt);
`AISLE_SEQUENCES` is a `Record<storeKey, string[]>` giving each store (willys/ica/hemkop) its
*own* walk order — today every store's sequence is literally the same array
(`DEFAULT_SEQUENCE`), but the structure means dropping in a real, distinct order for one store
later is a one-line edit to that store's array, not a redesign. `guessAisleCategory(name)`
keyword-matches an item's `vara` string into a category (unmatched falls to `ovrigt`, same
catch-all convention as the `erbjudanden` category taxonomy); `aisleRank(name, store?)`/
`sortByAisle`/`groupByAisle` all take an optional `store` key and look up that store's sequence
(falling back to the default one). `HandlaView` groups its row list into aisle sections
(`.shop-aisle-header`) using whichever store is currently selected in the store filter — so
switching stores re-sorts the *whole* list, not just which rows are visible. **Watch for the
substring-collision trap already documented below** when extending the keyword lists — this
categorizer hit it three times in one pass: `färs` (mince) inside `färskt` (fresh), `mjöl`
(flour) inside `mjölk` (milk), and `fil` (cultured milk) inside `filé` (fillet, e.g. "Laxfilé")
— all fixed with a stripped/negative-lookahead guard rather than trusting the raw substring
match.

**"Show one store at a time" (2026-07)**: a `.handla-storebar` pill row ("Alla"/Willys/ICA/Hemköp,
reusing `FyndView`'s `.fynd-chip` styling and `STORES` from `bevaka.ts`) lets the shopper filter
`HandlaView` down to one store while actually standing in it. Rows have no store concept in the
data model, so instead of hiding them (which would make the filter useless) they're
**taggable**: every row gets a small pill button (`.shop-store-tag`, "+ Butik" when unset) that
cycles willys → ica → hemkop → unset (`useShoppingList`'s `cycleStore`, backed by a
`storeAssignments: Record<id, storeKey>` field — additive on the existing `matracet:shopping:v1`
key rather than a version bump, since wiping `removedIds`/`manualItems` to add one field would
lose real usage data). Untagged rows stay visible in every store's view; tagging one to a store
hides it everywhere else. **CSS trap hit while building the store bar**: originally nested
`.handla-storebar` inside a two-column CSS-grid layout as a `grid-column: 1 / -1` item —
Chrome's grid auto-row-sizing inflated that row to ~127px (vs. the row's actual ~45px
content+margin) for reasons not fully root-caused; moved the store bar to its own
`.handla-storebar-wrap` sibling *outside* the list container and the phantom gap disappeared
immediately. If a future full-width "spans both grid columns" element in some view shows
unexplained extra vertical space, try pulling it out of the grid before spending more time on
the CSS.

**Store pill is auto-derived, not just manually tagged (2026-07)**: the `.shop-store-tag`
pill described above used to *only* get filled in by the user tapping "+ Butik" to cycle it —
an item pulled straight from a Fynd/Bevaka/Skafferi offer (which obviously came from one
specific store) still started untagged. `AddManualItemExtra.storeKey` (now also derivable from
`offerRef.store`, see below) is passed at the three offer-pull call sites
(`FyndView.toggleShoppingList`, `BevakaView`'s match-row click, `StashPantryPanel.toggleOfferInPool`)
so the pill is correct immediately. It only fills a gap — `cycleStore`'s manual override, if the
user already set one, always wins (checked via `!currentAssignments[id]` before writing).

**Shopping-list items link back to their exact offer via a `{store, week}` ref, not a
snapshot (2026-07)**: a plain item name isn't specific enough to shop from — "Kaffe"/"Snabbkaffe"
doesn't say *which* brand/size/deal was on offer when you added it. The first pass at fixing this
stored a full copy of the offer's fields (brand, size, price, savings) on the shopping-list item
itself, but that duplicates data that can drift from the source and needs its own refresh logic.
Since weekly offer files are never deleted (`_index.json`'s `veckor` list only grows), a
`ShoppingOfferRef { store, week }` (`useShoppingList.ts`) plus the item's own `vara` (already the
offer's `namn`) is enough to always re-look-up the *live* record — no duplicated data, and it
naturally reflects a later correction to the source file instead of going stale. `bevaka.ts`'s
`TaggedOffer` gained a `week` field (`s.vecka`, populated by `tagOffers`) and a `toOfferRef(o)`
helper; the same three call sites above pass `{ offerRef: toOfferRef(o) }` instead of a bare
`storeKey`. **Bug hit shipping this**: `BevakaView.tsx` builds its own `TaggedOffer[]` inline
(`stores.flatMap(s => s.erbjudanden.map(o => ({ ...o, store: s.kalla })))`) instead of calling
`tagOffers()` — this call site got missed when `week` was added, so Bevaka-added items got an
`offerRef` with `week: undefined`, silently failed to resolve, and fell back to showing just the
bare offer name with no brand/size/price. Worse, this real type error (`TaggedOffer` requires
`week: string`) didn't show up in `npx tsc --noEmit` or `npm run build` at all — see the bare-`tsc`
no-op gotcha in "Lessons learned"; only `npx tsc --noEmit -p tsconfig.app.json` actually caught it.
Fixed by adding `week: s.vecka` to this call site too. If a future field gets added to
`TaggedOffer`, grep for `store: s.kalla` to find every inline reconstruction site, not just
`tagOffers()`'s one real definition. `useOffers.ts`'s `useOfferRefLookup(items)` resolves a whole
list of `{id, vara,
offerRef}` at once (batches by distinct week, reuses the same module-level `loadIndex`/`loadWeek`
caches `useOffers` itself uses — deliberately *not* a second parallel per-store cache, since
calling `loadWeek` with anything other than the full `idx.butiker` list would poison that shared
cache for every other caller keyed only by week) into `Record<id, Offer | null>`. `HandlaView`
renders the resolved brand/size on a `.shop-offer-meta` sub-line under the item name, plus price
(`.shop-offer-price`) and savings (`.shop-offer-save`) — falls back to just the plain name if the
ref hasn't resolved yet or the offer's gone from that week's file. Recipe-ingredient adds
(`source` set, no `offerRef`) still show their `.shop-meal-tag` "why" as before. A row with
neither `source` nor `offerRef` — a plain "Eget tillägg" type-in — gets a `.shop-manual-tag`
("✎ Eget tillägg") badge so it's visually obvious which rows aren't tied to a specific recipe or
product, per the household's ask that a hand-typed item read differently from a picked one.

### Store offers ("Fynd" tab)

`public/data/erbjudanden/<butik-id>/<vecka>.json` holds weekly store-offer flyers, one file per store per week (see `public/data/erbjudanden/README.md` for the full schema). `_index.json` lists all stores and all saved weeks (`veckor`); `_latest.json` points at the default week shown in the UI. **When adding a new week's offers, add the week to `_index.json.veckor` and repoint `_latest.json`, per store.**

The UI tab is called **Fynd** (`FyndView.tsx`, "finds/bargains" in Swedish) — a voice-transcribed request for "weekly fines" turned out to mean this feature ("fynd" → mis-heard as "fines"). If a request mentions store deals, discounts, offers, or savings and doesn't obviously match an existing tab, check `public/data/erbjudanden/` and `FyndView.tsx` before assuming the feature doesn't exist yet.

**Category taxonomy (2026-07 redesign, superseded later the same month — see "Category taxonomy rework" further down)**: offers were grouped by "what do I cook with" rather than store-shelf placement — `protein_farsk`/`protein_fryst`, `gront_farsk`/`gront_fryst`, `frukt`, `mejeri`, `brod`, `fardigmat`, `dryck`, `skafferi`, `snacks_godis`, `hygien_hushall`, `ovrigt`. `FyndView`'s `AllView` grouped by this taxonomy with Färskt/Fryst sub-headings inside Protein/Grönt, and each category header was a collapse/expand toggle (see "Collapsible Fynd categories" below, still accurate). **This flat 13-category scheme, and the `_farsk`/`_fryst` category-forking pattern, were both replaced** by the 12-group/~74-leaf taxonomy + `form` field described in "Category taxonomy rework" below (`src/lib/kategoriTaxonomy.mjs` is now the single source of truth) — the rest of this paragraph's specifics are historical, kept for context on *why* the later rework happened, not a description of the current schema.

**Bröd/Dryck/Skafferi/Färdigmat/Hygien split (2026-07)**: after the dairy split (above), `ovrigt` was still ~1100 of ~1820 offers — a genuinely unbrowsable dumping ground, not a real "everything else" bucket. Rather than guessing keyword lists cold, the actual leftover `ovrigt` items (all 645 unique names, across all 15 `public/data/erbjudanden/*/2026-W*.json` files) were dumped and read by eye to find real clusters, the same "read the data before writing the classifier" discipline the dairy work and every `erbjudanden-recategorize.mjs`-adjacent script already follows. Five clear clusters emerged, matching (not coincidentally) five of the buckets from the *old* pre-"what do I cook with" 11-category scheme that `erbjudanden-recategorize.mjs`'s header still documents: `brod` (🍞 bread + bakverk/cakes/cookies — "kaka" excludes a preceding "choklad"/"kola", since "Chokladkaka"/"Kolakaka" are candy bars, not cake, and a following "o", since that's kakao/cocoa), `fardigmat` (🍕 frozen/chilled ready-to-heat meals — pizza, glass, gratäng, paj, pommes, soppa; this absorbs what the *old*, now-deleted `READY_MEAL_RE` used to blanket-bail to `ovrigt`), `dryck` (🥤 drinks incl. coffee/tea-adjacent and alcohol-free beer/cider), `skafferi` (🥫 pantry: sauces, condiments, oils, pasta, rice, spices, dry goods — this is also where `kokosmjölk`/`kokosgrädde` land, matching `storeOrder.ts`'s pre-existing exclusion of those two from *its own* separate `mejeri` aisle-bucket), and `hygien_hushall` (🧴 hygiene, cleaning, paper goods, pet food/supplies — `NON_FOOD_RE`, which already existed purely to bail food-word-collision hygiene products like "Allrengöringssvamp" away from produce, now resolves straight to this category instead of `ovrigt`). `BROD_RE`/`FARDIGMAT_RE` are checked in `guessKategori` *before* protein/fruit/veg/snacks (same protective role the deleted `READY_MEAL_RE` played) so e.g. "Korvbröd"/"Vitlöksbröd"/"Hamburgerbröd" don't match the meat/veg keyword baked into their own name, and "Fiskgratäng"/"Potatisgratäng"/"Chokladglass" don't match fisk/potatis/choklad instead of being recognized as bread or a ready meal. `DRYCK_RE`/`SKAFFERI_RE`/`HYGIEN_RE` are checked *last* (after mejeri), same "narrower/more specific signal wins" ordering principle used throughout this classifier. **New collision found and fixed in the same pass**: `bull` (bread bun) is a substring of `köttbullar`/`kycklingköttbullar`/`vegobullar` — a genuine Swedish homonym, not a typo (`bulle`="bun", but the unrelated "-bulle" in `köttbulle`="meatball" is spelled identically) — first draft of `BROD_RE` reclassified meatballs as bread; fixed with `(?<!kött)(?<!fläsk)(?<!fisk)(?<!vego)bull`. **New JS-regex-specific trap found while writing `DRYCK_RE`**: `\böl\b` (beer) looks like the right way to match a short whole word, but JS's `\b` only treats ASCII `[A-Za-z0-9_]` as "word" characters — å/ä/ö don't count — so `\böl\b` finds a (wrong) boundary right before the `ö` in `Vetemjöl`/`Mjölk`/`Sköljmedel` too, since JS doesn't see those as word-continuation. Fixed by anchoring to literal whitespace/edges instead: `(?:^| )öl(?: |,|$)`. Same underlying gotcha as the fixed-width lookbehind/lookahead guards used elsewhere in this classifier, just surfacing through a different mechanism — worth checking for before reaching for `\b` around any short Swedish word again. `scripts/erbjudanden-recategorize.mjs` — previously a second, hand-maintained keyword classifier that had *already* drifted from `guessKategori` more than once (see the git history / prior entries in this list) — was rewritten from scratch as a thin CLI wrapper that just calls `guessKategori` per offer (keeping only the one bit of logic that can't live in `guessKategori` itself: trusting a pre-existing `snacks_godis` value for brand-name candy the keyword lists can't catch). This doesn't just fix the immediate drift, it makes the *next* drift structurally impossible — there is now exactly one place keyword lists live. Existing data was migrated the same "safe by construction" way as the dairy migration: for every offer currently `kategori: 'ovrigt'`, recompute via `guessKategori` and overwrite only when the new verdict isn't `'ovrigt'` — 907 of 1065 `ovrigt` offers were reclassified this way (final counts: `hygien_hushall` 256, `skafferi` 253, `dryck` 165, `brod` 92, `fardigmat` 57, `protein_farsk` 50 — mostly meat/fish terms `guessKategori` already knew that the *data* predated, like `burg(?:are|er)` — `mejeri` 19, `gront_farsk` 8, `snacks_godis` 6, `protein_fryst` 1), leaving `ovrigt` at a genuinely small 158. Before running the migration, every "already-non-`ovrigt` item's classification would also change under the new rules" transition was diffed and eyeballed too (not just the `ovrigt→X` ones actually being written) specifically to catch classifier bugs like the meatball one above before they could touch real data, even though those non-`ovrigt` transitions were deliberately *not* applied (this migration only ever moves items *out of* `ovrigt`, never touches an already-differently-categorized item, so any pre-existing classification some other process set is left alone even if the current classifier would now disagree with it).

**Collapsible Fynd categories (2026-07)**: with 11 categories now (up from 6), `FyndView`'s `AllView` category headers (`.fynd-cat-title`) became `<button>` toggles (`.fynd-cat-toggle`) that collapse/expand their section — a chevron (▾/▸) replaces the plain header, and `useCollapsedCategories` (`src/hooks/useCollapsedCategories.ts`, `matracet:fynd-collapsed:v1`) persists which `groupId`s are collapsed the same way `useIrrelevantOffers` persists swiped-away offers, so a category you always skip (e.g. Hygien & Hushåll while grocery-shopping for dinner) stays collapsed on your next visit too. Collapsing is per top-level `groupId`, not per `CatMeta.id` — Protein's Färskt/Fryst sub-split collapses as one unit, matching how the section already reads as a single visual block.

**Dairy category + free-text search added to Fynd (2026-07)**: dairy (milk, cheese, yoghurt/kvarg/fil, butter/margarine, cream) originally fell into the `ovrigt` catch-all, which made it hard to find — split out into its own `mejeri` category (🥛), inserted into `GROUP_ORDER` right after `frukt`. `scripts/erbjudanden-lib.mjs`'s `guessKategori` gained a `MEJERI_RE` keyword pass, checked **last** (after protein/fruit/veg/snacks) so a compound word that also carries one of those signals resolves there first — e.g. "Jordnötssmör" (peanut butter) hits `SNACKS_RE`'s `nöt` before `MEJERI_RE`'s `smör` ever runs, and "Mjölkchoklad" (milk chocolate) resolves via `choklad`, not `mjölk`. The fruit branch also gained a three-way split it didn't need before: a fruit-named item that's actually yoghurt/kvarg/fil/grädde now returns `mejeri` (previously silently `ovrigt`), a fruit-drink returns `ovrigt`, a fruit-snack-bar returns `snacks_godis`. `scripts/erbjudanden-recategorize.mjs` (the historical one-off migration script) was updated in parallel with matching logic, per the standing "keep the two classifiers in sync" warning elsewhere in this file — its own `classify()` gained a mirrored `isMejeri` check. `bevaka.ts`'s `CATEGORY_EMOJI` got the matching `mejeri: '🥛'` entry so `BevakaView`/`SkafferiView` render it too. **Two substring-collision traps hit while building `MEJERI_RE`**, both fixed with the same guarded-regex technique as prior collisions documented in "Lessons learned": (1) bare `ost` (cheese) is a substring of `rostbiff`/`rostad`/`mellanrost`/`mörkrost` (roast/roasted) and `ostron` (oysters) — fixed with `(?<!r)ost(?!ron)`; a real, pre-existing data bug this caught in the process: `"Salladsost"` (a cheese) had been silently misclassified as `gront_farsk` this whole time because `VEG_RE`'s `sallad` keyword is checked before dairy ever gets a look — fixed by stripping `salladsost` → `ost` in the haystack before matching, same "strip the specific colliding compound" pattern as the existing `pålägg`/`automat` strips. (2) `mjölk`/`grädd` are substrings of `kokosmjölk`/`kokosgrädde` (coconut milk/cream — a pantry item, not dairy; `storeOrder.ts`'s *separate* aisle-order taxonomy already excluded these for the same reason) — fixed with `(?<!kokos)mjölk`/`(?<!kokos)grädd`. Existing data (15 `public/data/erbjudanden/*/2026-W*.json` files) was migrated with a small one-off pass (not committed as a script — run directly via `node -e` importing `guessKategori`): for every offer, recompute the category and only overwrite when the new verdict is specifically `mejeri` — safe by construction, since `mejeri` didn't exist as a category before this change, so a positive `mejeri` verdict can never regress an already-correct prior classification in another category. 138 offers were reclassified this way (down from an initial 146 before the `kokosmjölk`/`kokosgrädde` fix was added and a corrective pass reverted those 8 back to `ovrigt`). Also added: a `.fynd-search` text input at the top of `FyndView` (same `type="search"` + `Sök …` placeholder convention as `ReceptView`/`VeckanPlanner`/`SkafferiView`), wired into the existing `visible(o)` predicate so it composes with the store/Swedish-only filters and applies in both Alla and Jämför mode for free — a plain case-insensitive substring match against `namn` and `marke`, deliberately not fuzzy/tokenized, since the ask was literally "search for cheese, find anything cheese."

**Swipe-to-mark-irrelevant (2026-07)**: any offer row (`FyndView`'s `AllView`) or offer chip (`SkafferiView`'s "Veckans fynd" cloud) can be swiped left to hide it — e.g. a recurring offer for a product the household never buys. `useIrrelevantOffers` (`matracet:irrelevant-offers:v1`) is a flat `names: string[]` local store, keyed by lowercased/trimmed offer **name only** (not store or week, same convention as `useShoppingList`'s `addOrRestoreByName`), so marking something irrelevant hides it everywhere and for future weeks too, not just the current instance — the point is "I never want to see this again," not "not this week." `FyndView` moves matched offers out of their category into a demoted "🙈 Irrelevant" section at the bottom of the list (tap a row there to restore it, mirroring the `.shop-row.done`/"Bortmarkerat" restore-don't-delete pattern) rather than deleting them outright. `SkafferiView` just filters them out of `offers` entirely (before both the pantry-match and offer-cloud computations) since there's no "irrelevant" section there — the ask was specifically that irrelevant stuff shouldn't clutter the pantry view. The gesture itself is `src/components/SwipeRow.tsx`, a generic wrapper using pointer events (not touch events) so one implementation covers touch and mouse — it axis-locks on the first move past a small tolerance (`Math.abs(deltaX) > Math.abs(deltaY)`) so vertical list-scrolling isn't hijacked, and relies on CSS `touch-action: pan-y` (not `preventDefault`) to leave native vertical scrolling alone. A drag past tolerance also suppresses the wrapped child's own click via `onClickCapture` + `preventDefault`/`stopPropagation`, so swiping a `SkafferiView` offer-chip doesn't also fire its `onClick` (which toggles it into the stash pool) — verified via Playwright mouse-drag simulation (`page.mouse.down/move/up`, not a real touch event) that this suppression actually works, not just swipe-to-hide itself.

**Long-press to flag a wrong category (2026-07)**: `guessKategori`'s keyword classifier is good but not perfect (see the many substring-collision fixes throughout this file) — rather than the household having to describe a misfiled offer in a chat from memory, any `FyndView` `AllView` offer row can now be **long-pressed** (hold ~550ms without dragging) to open `CategoryFeedbackModal`, pick the correct category from the full taxonomy, and save that as a correction. This only ever records the correction locally — it never edits the actual `kategori` field live in the browser, since there's no write path from the phone back into the repo; it's meant to be exported and handed to Claude Code, same shape as the existing betyg/Synka flow. `useCategoryFeedback` (`matracet:category-feedback:v1`) is a `Record<normalizedName, entry>` local store (one open correction per product name, same dedupe-by-name convention as `useIrrelevantOffers`), storing `{ name, wrongCategory, correctCategory, updatedAt }`. A small ✏️ badge on the offer row (title = the corrected category) shows a flag is pending; long-pressing again reopens the picker, which also offers "Ångra flaggning" to clear it. `SwipeRow` (already used to wrap every `AllView` row for swipe-to-irrelevant) gained the long-press detection itself — an optional `onLongPress` prop, a `setTimeout` armed on pointerdown and cancelled the moment the drag axis locks past tap tolerance, plus `onContextMenu` preventDefault (only when `onLongPress` is passed) so a real long-press on a touch device doesn't also pop the browser's native text-selection/callout menu — chosen over a second gesture wrapper specifically so swipe-left and long-press-and-hold can coexist on the same row without two competing pointer-event listeners.

The category list shown in the picker (`src/lib/categories.ts`'s `KATEGORI_OPTIONS`) is built from `bevaka.ts`'s existing `CATEGORY_EMOJI` map (the id/emoji source of truth) plus a small hardcoded label dictionary — deliberately not importing `FyndView`'s own internal `CATS`/`GROUP_ORDER` (which already has richer sub-labels like "Färskt"/"Fryst"), matching this codebase's existing precedent of each screen/lib owning its own small copy of the category list (`bevaka.ts`'s `CATEGORY_EMOJI` and `FyndView`'s `CATS` already didn't share one either) rather than a forced shared refactor.

Two export paths, both from `src/lib/exportData.ts`: the correction entries are **automatically** included in the existing full "⬇ Exportera data" download (`downloadLocalData`/`buildExportPayload` iterate every `matracet:*` key generically, so nothing had to change there — see "Local storage export" below), and a **new**, separate "⬇ Exportera kategori-flaggningar" button on the **Synka** screen (`downloadCategoryFeedback`/`buildCategoryFeedbackPayload`) downloads just the category corrections as their own small `matracet-category-feedback-<date>.json` file, for when the household wants to hand over *only* the category fixes without a full data export. Both are meant to be pasted into a Claude Code chat; the **`sync-category-feedback`** skill (`.claude/skills/sync-category-feedback/SKILL.md`) reads either shape, patches the real `kategori` field in every matching saved `public/data/erbjudanden/*/*.json` offer (only where it still equals the flagged `wrongCategory`, across every week the product recurs in — not just the most recent), and — the actual "learn from the feedback" half — updates `scripts/erbjudanden-lib.mjs`'s `guessKategori` keyword regexes so future weeks classify the same product correctly the first time, applying the same narrow-lookaround-guard discipline (never a blanket strip) as every prior substring-collision fix documented in "Lessons learned". The skill explicitly does **not** blanket-rerun the categorizer across all saved offers when patching `guessKategori` (same standing warning as the dairy/bröd-dryck-skafferi migrations above) and does not attempt to clear the local `matracet:category-feedback:v1` flag remotely — a lingering ✏️ badge after a sync is just stale, not still-wrong; per-item "Ångra flaggning" in the modal is how the user clears it if they want the badge gone.

### Category taxonomy rework: retiring the regex classifier as the source of truth (2026-07)

A GitHub issue argued (with real corpus evidence — glass filed under `fardigmat`,
"Nötspett" under `snacks_godis`, "Red Bull" under `brod`, cheese brand names dumped in
`ovrigt`, a `gront_fryst` category with exactly one member in 1,820 offers) that
`guessKategori`'s regex cascade had hit a structural ceiling: Swedish compounding means
any food word is a substring of some non-food product, and brand-only names ("Präst",
"Ballerina") are permanently unreachable by keyword matching no matter how many
lookaround guards get added. Implemented in full: a new 12-group/~74-leaf taxonomy
(`src/lib/kategoriTaxonomy.mjs`, single source of truth — groups are UI/collapse units,
leaves are the actual `kategori` value), a `form` field (`farsk`/`kyld`/`fryst`/`torr`/
`konserv`, replacing the old `protein_farsk`/`protein_fryst`-style category forking —
`aisleFor(leaf, form)` looks up the shopping-list aisle without a second keyword list),
a `varutyp` field (finer-than-`kategori` grouping for Jämför-mode comparison — see the
"kidney bean problem" below), and a `_kategori-lexikon.json` (Git-tracked, product →
verdict, so the same product is never reclassified twice and a human correction
(`kategori_kalla: "manuell"`) is permanently locked against future automated passes).

**Diet is a `markeringar` flag, never a category** — the corpus itself proves this:
"Vegokorv" (ICA), "Vegan mayo" (Garant), and "Vegansk ärtdryck" (Sproud) are a sausage,
a sauce, and a drink respectively, so no single "vego" category could ever hold them all.
Each is filed by *what it is* (`korv`, `sas_dressing`, `vaxtdryck`) with
`markeringar: ["vegansk"]` added — a vegan sausage sits three rows from the meat sausage
it substitutes for, which is *better* adjacency for meal-planning than a segregated vego
section would be. `FyndView` gained a 🌱 filter chip reading `markeringar` for "what can
the vegan kid eat this week" instead. The one nuance: a vego product that **mimics** a
meat product (Oumph "meat chunks") files under the meat category (`kott`) it substitutes
for; `tofu_tempeh` is reserved for vego protein with **no** animal counterpart at all
(tofu, seitan) — conflating the two was tried in an earlier draft and immediately broke
on "Vegokorv" landing in a different bucket than "Falukorv".

**The classifier didn't go away — its role changed from "generate the answer" to
"refute a wrong one".** `src/lib/kategoriClassify.mjs` is still a hand-written regex
cascade (isomorphic ESM, `.mjs` inside `src/lib/` so both Node scripts and the Vite app
import the *same physical file* — see `tsconfig.app.json`'s `allowJs: true`, added
specifically for this), but it's now explicitly the §3.3.5 "cold-start fallback" for a
lexicon miss, not the source of truth; a real import classifies new products once (in
the Claude Code session doing the import, following
`.claude/skills/import-erbjudanden/klassificering.md`'s decision procedure), writes the
verdict into the lexicon, and every future week's occurrence of that product is a free
lookup. `scripts/erbjudanden-verify.mjs` repurposes the *same* keyword knowledge as a
deterministic verifier: "this offer's name contains a non-food keyword but is filed
under a food category" is a sound assertion even though the reverse ("this name doesn't
match any of my patterns, so it must be `X`") never was — a rule that can only refute,
never confidently generate, can't be fooled by a clean, confident, wrong match the way
the old regex-first "send only low-confidence items to a human" design was (that design
was tried and rejected during this work specifically because `"Red Bull" → brod` is a
clean, single-pattern, *maximum-confidence* match with no way for the regex to know it's
wrong).

**The "kidney bean problem"**: `FyndView`'s Jämför mode used to group by
`normalizeKey(namn)` (the full product name, ascii-folded) — so "Kidneybönor", "Bönor,
kikärter", and "Blandade Mörka Bönor Ekologiska" (three different stores' phrasing for
comparable products) never shared a group, since no two stores spell a product name
identically. `varutyp` fixes this at the *product-identity* level instead of the
name-string level: `detectVarutyp()` in `kategoriClassify.mjs` assigns all three
`varutyp: "bonor"` regardless of `namn`, and `FyndView`'s `buildMatchGroups` groups by
`varutyp` instead of `normalizeKey(namn)` **only when `varutyp` has been deliberately
split finer than the leaf itself** (today, only within `baljvaxter`) — grouping by the
bare `varutyp` for every leaf was considered and rejected, since most leaves still
default `varutyp === kategori` (a much coarser grouping than the old per-name one), and
that would dump e.g. every cut of beef into one "Jämför" group just because they share
the `kott` leaf. Finer per-product `varutyp` assignment is meant to accrue over time via
the same lexicon process as `kategori` itself, not be hand-assigned to all ~1,350
lexicon entries up front.

**Gotchas hit migrating the real corpus (1,820 offers) with the new rules**, beyond the
ones already itemized in the design issue's own evidence table: a `\b` boundary right
after an accented letter silently never matches (same shape as the pre-existing `\böl\b`
lesson, this time on "Grevé" — fixed by dropping the trailing `\b`, not by trying to
special-case Unicode word chars); "Costa Rica" (an origin string, from
`erbjudanden-lib.mjs`'s `COUNTRIES` list) contains the substring "ost" and was landing a
plain pineapple in `ost_hard` — stripped from the haystack before matching, same pattern
as the pre-existing `salladsost`/`automat` strips; "Dessertost" (a real cheese) and
"Chips, ostbågar"/"ostsnacks" (cheese-puff crisps) both embed `ost` but aren't cheese in
the sense the dairy pattern means — fixed with a haystack rewrite (`dessertost`→`ost` so
the dairy pass *does* catch it; `ostbågar`/`ostsnacks`→`snacks` so it doesn't); "Kaffe
hela bönor" defeated a `(?<!kaffe)böna` lookbehind because "kaffe" wasn't *immediately*
adjacent to "böna" (intervening word "hela") — fixed with a separate whole-haystack
"contains kaffe AND böna anywhere" check rather than trying to make the lookbehind
handle arbitrary intervening words; and a blanket `BRAND_OVERRIDES` entry for
"Billys"/"Dafgårds" (both genuinely ready-meal-focused brands) was silently preempting
*more specific, correct* signal already in the product's own name — "Grekiskt lantbröd"
and "Lyxbulle, Solbulle" (bread) and "Pizza supersize" (pizza) all got forced to
`enportionsratt` before `BROD_RE`/`FARDIGMAT_RE`'s own, better keyword match ever got a
turn, simply because brand-override checks run first in the decision order. Lesson,
generalized: a blanket brand-name override is only safe when the brand makes
*exactly one kind of thing* — the moment a brand spans product types, hardcode the
specific compound *product words* (`ostschnitzel`, a real dish name) instead of the bare
brand name, so real per-product signal in the name isn't preempted. All of these were
caught by literally reading the classifier's own output on the real corpus and building
a 200-row hand-verified golden set (`scripts/__fixtures__/kategori-golden.json`,
`src/lib/kategoriGolden.test.ts`) from it — sampled per the design issue's own
prescription (every remaining `ovrigt` item, every known collision-family match, a
random tail) — rather than trusting the classifier's self-reported confidence.

### Post-mortem: the rework's first PR inverted its own design (2026-07)

A code review of the rework's first PR found that what shipped was **"rules generate,
lexicon caches, model never runs"** — the exact inversion of the design's own
"lexicon-first, model generates, rules verify" pipeline. Concretely, at merge time:
`_kategori-lexikon.json` was 100% `kalla: "regel"` (zero `"model"` entries — the
classifier seeded its own lexicon rather than a model classifying each product), and
98.7% of entries self-reported `confidence: "hog"` even though §3.3.2's whole argument
was that a regex cascade *cannot know when it's wrong* ("Red Bull → brod" was a clean,
single-pattern, maximum-confidence match with no competing category, and it was
completely wrong — self-reported confidence was never a signal that could be trusted).
The golden test set had the same shape of problem one level up: it was originally
enriched for known-hard collision families *and then regenerated from the classifier's
own (bug-fixed) output*, which is why it scored a suspicious 100/100 (later 200/200) —
a fixture built that way has no remaining power to catch a new bug, only to notice a
values *change*. The review found 8 concrete, live misclassifications this way (all
self-reporting `confidence: "hog"`, none caught by the enriched golden set):
`Sejfilé → kott` (not `fisk` — the fish-species pattern was defensively space-anchored
without checking whether that was needed, so it never matched inside the compound),
`Hallonsoda Zero Läsk → bar` (not `lask_vatten` — BAR_RE had none of FRUIT_RE's drink/
dairy/snack exclusions), `Vegetariska delikatessbullar → fikabrod` (not
`fars_kottbullar` — BROD_RE's bare "bull" pattern ran before the more specific
meatball-compound check, even though that check already listed this exact product),
`Burgare/Grillburgare → kott` (not `fars_kottbullar`, contradicting the taxonomy's own
worked example), `Oxpytt → kott` (a Findus product, so almost certainly `enportionsratt`,
not raw butcher-counter meat), and `Räkost → ost_hard` (not `ost_fars_mjuk`, a tube
cheese).

**Fixed, not just re-argued:**

1. **`confidence` is now honest.** `finish()` defaults to `'lag'`; only a
   `BRAND_OVERRIDES` hit (a fact, not a guess) reports `'hog'`. Re-seeding the lexicon
   with this change alone moved 1,330 of 1,348 entries from `hog` to the honest `lag`
   — they were never verified, and now they say so.
2. **All 8 confirmed bugs fixed**, plus a systematic follow-up audit (grepping the real
   corpus for the same collision *shapes*, not just the 8 reported instances) found and
   fixed several more of the same kind: fish-species patterns unnecessarily space-
   anchored (`sej`/`gös`), a berry/fruit-flavour-word collision affecting 7 real
   products (sodas, baby smoothies, cereal — not just the one reported), `olivolja`
   landing in `inlagt_delikatess` instead of `olja_vinager`, `Salsicciakorv` landing in
   `charkuterier` instead of `korv` despite its own literal "-korv" suffix, "Dessertglass
   | Daim, Oreo" landing in `kex` because a brand override ran before the more specific
   "dessertglass" product-type signal (same shape as the Dafgårds/Billys lesson below),
   and — the largest single gap — **`NON_FOOD_LEAF_RULES` had no dedicated `hygien` rule
   at all**: every hygiene keyword was in the *gate* (so the item correctly bailed out of
   food categories) but had no matching *leaf* rule, so shampoo, toothpaste, deodorant,
   sanitary products, sun/skin care and razors were all silently defaulting to
   `stad_disk_tvatt` (the first leaf rule with no more specific match). None of this
   showed up in the original golden set because it never sampled these products blind.
3. **The golden set was rebuilt from scratch as a genuinely blind random sample** — 200
   products sampled uniformly (not enriched for known-hard families), each hand-labelled
   by reasoning about the product *before* ever running `classify()` on it, compared only
   afterward. Real, honest accuracy on that first blind pass: **88.0%** (176/200) — every
   one of the systemic bugs above surfaced on this pass, several for the first time (the
   `hygien` gap alone accounted for 7 of the 24 misses). After the fixes: **97.5%**
   (195/200), which is the number now enforced as the regression floor in
   `kategoriGolden.test.ts` (with a couple points of headroom, not a knife-edge). See
   that test file's header for the full accounting. **Lesson, stated plainly because it
   nearly repeated the "don't trust a derived value as its own validator" trap already in
   this file's Lessons Learned**: a test fixture built *from* the thing it's meant to
   test can only ever measure drift from that thing's own past output, never correctness
   against reality — the sampling and labelling has to happen independently, before the
   code under test is ever consulted.
4. **The model pass itself, done as a follow-up in the same session**: every one of the
   1,223 `lag`-confidence lexicon entries was read individually (not sampled) — the full
   lexicon, dumped and read category by category, ~74 categories — and either confirmed
   or corrected. This found **12 more real bugs** the 200-row blind sample hadn't
   surfaced (a smaller sample, even an honest one, only ever sees a slice): a chicken
   burger landing in `fagel` instead of `fars_kottbullar` (contradicting the taxonomy's
   own "färska burgare" example) because the burger check ran after, not before, the
   species check; "Lammgrytbitar" (diced stew meat, not ground/formed) had been swept
   into `fars_kottbullar` by a keyword that never belonged there; "Tofukorv" and
   "Vegansk korv, tofu" landing in `tofu_tempeh` instead of `korv`, directly
   contradicting this file's own vego-is-a-marking rule (a vego product mimicking a
   specific meat product files under that product); a `dessertsas` leaf rule that
   required "odense dessertsås" as one exact brand-then-name phrase, so it silently
   never matched a real product whose fields concatenate name-then-brand; `BROD_RE`'s
   gate had no bare "kex" trigger even though the leaf rule beneath it did, so
   "Mariakex"/"Kex Maria" fell through to `SNACKS_RE`'s `?? 'godis'` default; flavoured
   sparkling water ("Citron kolsyrat vatten") landing in `frukt`; a flavoured cereal
   ("Havregott Jordgubb") landing in `bar`; "Tortillachips Ost" and "Mikropopcorn ...
   Smör" both landing in a dairy leaf via their flavour word, ahead of ever reaching
   `SNACKS_RE`; and "Ekologiska vita bönor i tomatsås" landing in `sas_dressing` instead
   of `baljvaxter` because bare "sås" is checked well before the protein branch. Every
   reviewed entry now carries `kalla: "model"` (1,224 of 1,348) with confidence set
   honestly per-item — `hog` for the ~99.5% now individually confirmed, `lag` kept on
   the handful still genuinely ambiguous after real review (e.g. "Choko crunch, smash |
   SMASH! • OLW" — Smash is both a candy brand and part of this OLW snack line's name,
   and the product name alone can't disambiguate which). The 124 `kalla: "regel"`
   entries remaining are `BRAND_OVERRIDES` hits (Präst, Ballerina, …) — deterministic
   facts vetted when the pattern was written, not guesses that need individual review.
   **Lesson**: this is the second time in this same rework that a smaller, curated
   sample (first the enriched-then-self-referential golden set, now the 200-row blind
   sample) missed real bugs a full pass caught — a sample tells you the *rate* of a
   problem, not its *membership*; when the corpus is small enough to read in full
   (~1,350 products, a few hours of focused review), reading all of it finds bugs no
   sample size can guarantee catching.
5. **What's still genuinely unfinished, stated plainly rather than as a vague
   "follow-up"**:
   - `varutyp` is populated beyond a plain copy of `kategori` for exactly one leaf
     (`baljvaxter`'s bönor/kikärtor/linser split — 12 of 1,348 lexicon entries, 0.9%).
     `FyndView`'s Jämför mode therefore only groups by `varutyp` for that one leaf;
     everywhere else it still falls back to `normalizeKey(namn)`, the exact mechanism
     §3.5 diagnosed as the cause of the kidney-bean problem in the first place. The bean
     case itself is genuinely fixed; nothing broader is.
   - **The acceptance criterion "no classifier runs in the browser" is not met.**
     `src/lib/storeOrder.ts`'s `guessAisleId()` calls `classify()` live, in the browser,
     on a bare ingredient/item name with no brand or context — the weakest input the
     classifier ever sees — for any shopping-list item that didn't arrive with a
     pre-computed `kategori` (i.e. every hand-typed "Eget tillägg" entry, and every
     recipe-ingredient add, since no recipe file has been backfilled with a stored
     `kategori` — see `Ingredient.kategori` in `types.ts`, added but unpopulated). This
     was disclosed as a deferred follow-up in the original PR description but should have
     been stated as a failed acceptance criterion, not a soft "deferred" — those aren't
     the same thing and shouldn't be blurred together.

### Post-mortem, round 3: the "model pass" provenance overclaimed what actually happened

A third review of the same PR found the model-classification pass above had shipped
**"rules generate, lexicon caches, model never runs" — again**, just one layer deeper
than round 2 caught: `motivering` was byte-identical boilerplate
("Granskad individuellt i en fullständig lexikon-genomgång (2026-07).") across 1,223 of
1,224 `kalla:'model'` entries — the literal opposite of evidence that each product was
individually reasoned about, contradicting `klassificering.md`'s own per-product
requirement — `varutyp`/`markeringar` were still populated for only 13 of 1,348 entries
despite `kalla:'model'` claiming a full review, and `confidence` had swung back to
1,342/1,348 `hog` (from the round-2 fix's honest ~125), self-reporting certainty the
review process hadn't actually re-earned. Worse: **the one experiment that would have
tested whether the mechanism works at all — reviewing the true `BRAND_OVERRIDES`-derived
`confidence:'hog'` entries, the ones a human/model should be most likely to catch a
wrong "fact" in — had never been run.** The review's explicit ask was narrow and
concrete: run that one experiment, and stop the lexicon from claiming
individually-reasoned review it hadn't done.

**Fixed:**
1. **Ran the actual experiment**: read all 125 `confidence:'hog'` lexicon entries (the
   `BRAND_OVERRIDES` hits) by eye, one by one. Found and fixed 3 real bugs (2.4% error
   rate on the set specifically curated to be "facts, not guesses" — evidence the
   mechanism itself is sound, since a targeted review of the highest-confidence subset
   still surfaces real mistakes): **Burrata** was grouped with the `ost_hard`
   (hard-cheese) `BRAND_OVERRIDES` pattern — it's a fresh/soft cheese in the same family
   as mozzarella (already correctly `ost_fars_mjuk`), not a hard one; moved into the
   mozzarella pattern. **Pucko/Cocio** (chocolate milk drinks) were filed as
   `juice_saft` — they're a dairy product (`mjolk_gradde`), not a juice/must; a plain
   category-constant swap. **"Smash"** turned out to be the one `BRAND_OVERRIDES` entry
   self-reporting certainty it didn't have: it's genuinely ambiguous between an
   Ahlgrens/Fazer-adjacent candy name and the OLW "Smash!" savory snack line (documented
   as an open ambiguity back in round 2's own writeup, but the entry still inherited
   `BRAND_OVERRIDES`' blanket `'hog'`) — pulled out of `BRAND_OVERRIDES` into its own
   explicit check ahead of it, reporting the honest default `'lag'` instead.
2. **Reapplied a genuinely lost fix**: the lexicon reset done while chasing an unrelated
   bug (a flavoured-sparkling-water misclassification — "Citron kolsyrat vatten" was
   landing in `juice_saft` instead of `lask_vatten` because the drink-exclusion branches
   in `BAR_RE`/`FRUIT_RE` always hardcoded `juice_saft` rather than checking which drink
   category the exclusion actually matched; fixed by routing through
   `DRYCK_LEAF_RULES` first) wiped a manual correction for "Produkter från gräddhyllan |
   Flora • Flora by Milda" (a Flora/Milda margarine product with no product name beyond
   a generic aisle description, so the bare "grädd" substring was winning
   `mjolk_gradde` over the correct `smor_margarin`). Rather than re-adding it as a
   one-off lexicon lock (fragile — lost again on the next reset), added `flora`/`milda`
   to `BRAND_OVERRIDES` as a real, checked-for-collisions brand fact, so it's now
   structural and survives any future lexicon regeneration.
3. **Fixed the provenance overclaim by not making the claim**: rather than fabricating
   1,223 more distinct `motivering` strings under time pressure (round 3's own stated
   concern about cost), the lexicon reset above already put every entry back to the
   honest baseline — `kalla:'regel'`, no `motivering` field, `confidence` split
   124 `hog` (true `BRAND_OVERRIDES` facts) / 1,224 `lag` (plain regex verdicts) — and
   that baseline was *kept* rather than re-decorated with `kalla:'model'` claims this
   round can't back up with real distinct reasoning. The genuine review *work* from
   round 2 (reading all 1,223 `lag` entries by category, finding and fixing 12 real
   bugs) wasn't lost — its findings are encoded the correct way, structurally in
   `kategoriClassify.mjs`'s regex/haystack rules (so every future product benefits, not
   just the 1,223 reviewed at the time), which is a stronger artifact than a per-item
   lexicon annotation would have been anyway. What's honestly true and now honestly
   stated: two full-corpus reading passes have happened (round 2's 1,223 `lag` entries,
   round 3's 125 `hog` entries) and both found real bugs, now fixed in the rule engine
   itself — but the lexicon no longer claims a per-product `kalla:'model'` review that
   didn't produce per-product evidence.
4. **`kategoriGolden.test.ts` now tests the lexicon-first production path**, not
   `classify()` in isolation — it looks up each golden-set product in
   `_kategori-lexikon.json` first (the file `erbjudanden-recategorize.mjs` actually
   replays into every saved offer) and only falls back to `classify()` on a lexicon
   miss, per the review's "cheapest fix" framing: a regex change could pass the old
   version of this test while a stale or wrong lexicon entry for that exact product
   still shipped, since the lexicon — not a bare classifier call — is what the app
   reads. Still 97.5% (195/200) on the same blind sample; unchanged because every
   golden-set product is already a lexicon hit, which is itself a fine sanity check.
5. **Still open, unchanged from item 5 above**: `varutyp` broad population and the
   browser-side `classify()` call in `storeOrder.ts` — both explicitly out of scope
   again this round, not silently dropped.

**Lesson, the general shape repeating across all three rounds of this PR**: a metadata
field that *claims* a process happened (`kalla:'model'`, `confidence:'hog'`,
`motivering`) is only trustworthy if it's cheaper to tell the truth than to fake it —
the moment producing honest per-item evidence is more expensive than the reviewer has
budget for, the metadata should downgrade to match what was actually done, not quietly
keep claiming the expensive version. Every round of review here caught exactly that gap
between claimed and actual rigor; the fix each time was the same shape — either do the
real work, or shrink the claim to fit it.

### Watch-list ("Bevaka" tab)

`public/data/erbjudanden/bevakningslista.json` holds a standing list of products to bulk-buy whenever they're a genuine bargain (e.g. a coffee brand, toilet paper in the usual big pack, a specific toothpaste). Each entry (`BevakningItem` in `types.ts`) has `sok` (lowercase keyword substrings matched against an offer's `namn`/`marke`), `undvik_marken` (brand substrings that disqualify a match — e.g. "not Gevalia"), and optional `onskat_marke`/`storlek_hint`/`troskel_kr`/`anteckning` for extra context. `BevakaView.tsx` cross-references this list against the current week's offers (via `useOffers`, same hook as Fynd): the left page shows the full watch-list with a 🔔 badge on any item currently matched, the right page shows the matched offers grouped by item — clicking a matched offer row (`.match-row`, same "whole row is the control" convention as `FyndView`'s double-click, `.in-list`/`🛒` shown once added) explicitly adds it to the shopping list via `useShoppingList`'s `addOrRestoreByName`/`removeOrMarkByName`/`isActiveByName`; clicking an already-added one removes it again (see the Shopping list section above — a bevaka match no longer lands on the list just by existing). **When adding a watch-list item, add an entry to `bevakningslista.json`** — there's no in-app "add" UI (consistent with this app's no-backend/JSON-in-git model), so new items or refinements (e.g. filling in a specific brand once decided) go straight into the file. Note four entries (`frukt`, `gront_farskt`, `gront_fryst`, `snacks_godis`) have an empty `sok`, meaning "watch the whole category" rather than a specific keyword (see `matchesBevakning` in `bevaka.ts`) — these can surface dozens of matches in one week, which is fine now that surfacing a match and adding it to the shopping list are two separate, explicit steps.

## Lessons learned

Durable gotchas discovered while working in this repo. Add to this list rather than rediscovering the same thing in a future session.

- **`npm run build` now really type-checks (fixed 2026-07) — but a bare, unparameterized `tsc`/`npx tsc --noEmit` (no `-b`, no `-p`) is still a silent false-positive "clean" no-op in this repo, so never trust that specific invocation.** The root `tsconfig.json` is a project-references shell (`"files": []`, `"references": [tsconfig.app.json, tsconfig.node.json]`). Running plain `tsc`/`tsc --noEmit` against it compiles the `files`/`include` of *that* config only — which is empty — so it exits 0 instantly having checked zero files. This once let a real type error (`BevakaView.tsx` building its own `TaggedOffer[]` literal missing the `week` field added elsewhere) ship silently through several rounds of "typecheck clean" verification in one session, surfacing only as a runtime bug once a user exercised the feature. `npm run build`'s `tsc` step was `tsc && vite build && ...` (same bare, no-op invocation) until it was changed to **`tsc -b && vite build && ...`** — build mode actually traverses the references and fails the build on real errors now; verified by deliberately introducing a type error and confirming `npm run build` exits non-zero, then confirming it exits 0 once reverted. Fixing this also surfaced two categories of previously-invisible pre-existing errors that had to be fixed for real (not suppressed): a handful of `noUnusedLocals`/bad-cast errors in `src/meals/checks.ts`/`checks.test.ts`/`src/presence/activities.test.ts` (dead `allSlots` parameter on `checkSpacing` removed end-to-end including its now-unused local args at every call site; unused type imports dropped; `as Record<string, unknown>` casts on `CookingEvent` — which doesn't have an index signature — changed to `as unknown as Record<string, unknown>`), and `vite.config.ts`'s `tsconfig.node.json` project genuinely never had Node types available (no `@types/node` installed at all) despite using `path`/`__dirname` — fixed by adding `@types/node` as a devDependency and `"types": ["node"]` to `tsconfig.node.json`'s `compilerOptions`. **For ad-hoc mid-session type-checking (not `npm run build`), still use `npx tsc --noEmit -p tsconfig.app.json`** (or `npx tsc -b`) — a bare invocation remains a no-op regardless of what `npm run build` itself now does, since that fix lives in the `package.json` script, not in the root `tsconfig.json` shell.
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

- **Non-food products can borrow a food word as scent/shape/brand and false-positive into produce/protein categories** — a third variant of the substring-collision trap above, but the collision is with an entire non-food *product*, not another food word. `"Allrengöringssvamp"` (all-purpose cleaning sponge) hit the `VEG_RE` keyword `svamp` (mushroom) and landed in `gront_farsk`; an apple-scented `"Allrengöring Städservett"` (cleaning wipe) hit `FRUIT_RE`'s `äpple` and landed in `frukt`. Unlike the compound-word trap, this isn't fixable by stripping a specific colliding *word* (any food word could in principle appear in a cleaning/hygiene product's name/scent) — the fix is a `NON_FOOD_RE` keyword list (`rengör`, `städ`, `disk(medel|borste|svamp|trasa)`, `tvättmedel`, `toalettpapper`, `hushållspapper`, …) checked and bailed to `ovrigt` *before* any produce/protein keyword, same "bail first" shape as `READY_MEAL_RE` (see `guessKategori` in `scripts/erbjudanden-lib.mjs`, mirrored in `erbjudanden-recategorize.mjs`). Also found in the same pass: `erbjudanden-lib.mjs`'s `VEG_RE` was missing `champinjon` entirely (present in `erbjudanden-recategorize.mjs`'s equivalent list but not the live parser's), so plain "Champinjoner" fell through to `ovrigt` with zero non-food indication — a reminder that the two classifiers' keyword lists can silently drift apart since nothing enforces they stay in sync.
- **The full PDF-import → classify → save workflow is now a Skill**, not just README prose: `.claude/skills/import-erbjudanden/SKILL.md` walks pdftotext → column-split → parse-* → `guessKategori` → `_index.json`/`_latest.json` wiring, and calls out the non-food classification trap above explicitly so it gets checked on every import, not just when someone happens to remember this file. Update that Skill (not just this section) when the import pipeline itself changes; update this section when a *new* classification gotcha is discovered, since the Skill should stay a procedure, not grow into a running list of every historical bug.
- **All three erbjudanden stores can now arrive as a Safari `.webarchive`, not just Willys** (2026-W29 import): ICA's page (`erbjudanden-parse-ica-html.mjs`, new) turned out to render each offer as a clean `<article class="offer-card" data-promotion-id="...">` block with a `sr-only` price-splash span holding the actual offer text ("2 för 25 kr", "79 kr/kg", "10% rabatt", "Köp 3 betala för 2") — a strictly better source than the old PDF parser, but it pulls in *far* more non-food (125 raw offers, 57 of them clothing/electronics/garden/toys/appliances) than the PDF export ever did, so the manual-filter step matters more than before. Hemköp's page (`erbjudanden-parse-hemkop-html.mjs`, new) renders as a homepage-embedded `data-testid="offline-promotion-products"` grid rather than a separate flyer page — that's normal, not a bad capture (item count lines up with prior PDF-derived weeks), and a couple of personal "Bara för dig" coupons show up in a *differently shaped* card (`data-testid="product-main-link"`, no `product-container`, no absolute price) that needs its own small parse path. **Don't trust a webarchive's `WebResourceURL` metadata (or a Next.js `__NEXT_DATA__.page` field) to identify which page was saved** — these are all client-routed SPAs, so that metadata reflects the *original* document load (often just `/`), not the route the user actually navigated to before saving. The first pass on the Hemköp file wrongly concluded from `WebResourceURL`/`__NEXT_DATA__.page` both saying `/` that the wrong (homepage) page had been captured — the rendered `<title>` ("Erbjudanden | Hemköp") and `<link rel="canonical">` (`hemkop.se/erbjudanden/4638`, the same base path as a prior week's known-good source) said otherwise the whole time. Trust the rendered title/canonical, not load metadata. Also: Willys' own canonical can silently switch between `/erbjudanden/butik` (in-store) and `/erbjudanden/ehandel` (e-handel/delivery) week to week — check it and record which one in that week's `urval`, since the two channels can carry different prices.
- **A fourth substring-collision shape, found while re-running the classifier against the new ICA/Hemköp webarchive sources**: a common Swedish *adjective*, not just a compound noun, can hide a shorter food keyword — `färs` (mince) inside `färsk`/`färskt`/`färska` ("fresh", e.g. "Färsk pasta", "Färska kryddor") mis-filed pasta and fresh herbs as meat. The obvious fix (blanket-strip `färsk\w*` before matching, which is what `src/lib/storeOrder.ts`'s `guessAisleCategory` had *already* been doing for this exact collision) turns out to be wrong: it also eats compounds like `färskpotatis` (new potatoes) whole, silently dropping the `potatis` keyword the classifier needs and turning a wrong-category bug into a no-category bug instead of actually fixing it. The precise fix is a negative lookahead on just the ambiguous substring, `färs(?!k)` — real mince compounds (nötfärs, fläskfärs, köttfärs) always end in "färs", never continue into "färsk...", so this is exact with no observed false negatives. Ported this exact fix into both `scripts/erbjudanden-lib.mjs`'s `guessKategori` (`PROTEIN_RE`) and `src/lib/storeOrder.ts`'s `guessAisleCategory` (`KOTT_FISK_PATTERNS`) — the aisle categorizer's version had silently shipped with the less-precise strip-based fix, worth checking for elsewhere if a similar "strip the containing word" fix shows up. Two more collisions found in the same pass, same `(?!x)` shape: `tomat` (tomato) inside `automat`/`automatic` (appliance names — "Kaffebryggare Automatic" isn't a vegetable) and `fisk` inside `fiske`/`Magnetfiske` (a magnet-fishing hobby kit, not food) → `fisk(?!e)`.
- **A fifth substring-collision shape: a *processed/pantry* product's name embeds the raw produce it's made from, or a flavor word matching a different category entirely** — flagged by the household spotting "Krossade, passerade tomater" (canned crushed tomatoes) and "Potatissallad" (deli potato salad) both filed under `gront_farsk` ("fresh") in the Fynd UI. `VEG_RE`'s bare `tomat`/`potatis` matched inside these processed names same as any fresh tomato/potato, and — unlike the compound-word traps above — there's no fixed-width lookaround that disambiguates "Tomater Krossade" from "Tomater" alone; the distinguishing word (`krossad`/`passerad`/`puré`) can appear on *either side* of "tomat" depending on source phrasing. Fixed with a same-string AND via two lookaheads instead of alternation: `CANNED_TOMAT_RE = /(?=.*tomat)(?=.*(?:kross|passerad|puré))/i`, checked (→ `skafferi`) before `PROTEIN_RE`/`VEG_RE` run, same "bail first" position as `BROD_RE`/`FARDIGMAT_RE`. Starch-based deli salads (`potatissallad`, `krämiga sallader`, `salladsbaren`) got the same "ready-to-eat, not raw produce" fix by extending `FARDIGMAT_RE` (already checked first) — note *protein*-based deli salads ("Räksallad, skagenröra") already resolved correctly beforehand since `PROTEIN_RE` is checked ahead of `VEG_RE` too; only the starch-only case had no earlier category to catch it. Separately, any `sås`/`dressing`/`marinad`/... condiment name routinely carries an unrelated flavor word ("Kebabsås Vitlök" ⊃ `kebab` **and** `vitlök`, "Gräddsås Pulver" ⊃ `grädd`, "Hamburgerdressing" ⊃ no produce word but still a condiment) that would otherwise be claimed by `PROTEIN_RE`/`VEG_RE`/`MEJERI_RE` first (all checked before `SKAFFERI_RE`'s own `sås` keyword ever gets a look) — pulled those condiment keywords out into a new `SAUCE_RE`, also checked before `PROTEIN_RE`. **When applying a classifier fix retroactively to already-saved data, never blanket-rerun `erbjudanden-recategorize.mjs` across all files** — it recomputes *every* offer's category from `guessKategori` and only trusts the old category as a fallback for `snacks_godis`, so any offer whose correct category depends on a keyword `guessKategori` simply doesn't have yet (this pass found `hallon`, `clementin`, `lime`, `jordgubb` missing from `FRUIT_RE`, and plural `morötter` not matching `VEG_RE`'s singular `morot` — Swedish plurals often shift the vowel, e.g. o→ö, so a substring match on the singular silently fails) gets silently demoted to `ovrigt`, even though nothing about *that* offer was wrong. Re-ran the migration as a narrow one-off instead: only recompute `kategori` for offers whose name/brand actually matches one of the *new* patterns (`CANNED_TOMAT_RE`/`SAUCE_RE`/the deli-salad addition to `FARDIGMAT_RE`), leaving every other offer's existing category untouched regardless of what the full classifier would now say about it.

## GitHub-backed auto-sync (in progress, 2026-07)

A plan exists to replace the manual Synka export/import flow with device→GitHub auto-sync: a
fine-grained PAT on-device pushes `matracet:*` localStorage state to a `sync/state.json` file on
a dedicated `device-sync` branch via the Contents API; a scheduled Action merges it into canonical
`public/data/` files on `main`. The plan is phased with a validation + critique gate per phase —
see the originating task/issue for the full spec (branch keys the file, one snapshot object, no
diffing/CRDTs, single-writer assumption throughout).

**Status: Phase 1 + Phase 2.** `src/lib/githubSync.ts` is the pure client — `getToken`/`setToken`/
`clearToken` (token lives at `matracet:sync:token`, deliberately outside the synced-store set: it
must never itself be synced), `fetchState()`/`pushState(state, knownSha?)` against
`repos/daniel-oster/matracet/contents/sync/state.json?ref=device-sync`, typed `SyncStatus` results
(`'ok' | 'no-token' | 'unauthorized' | 'network' | 'conflict-exhausted' | 'not-found'`) rather than
thrown exceptions, UTF-8-safe base64 (via `TextEncoder`, not bare `btoa` — this data has Swedish
characters), and `serializeState()` sorting store keys so an unchanged snapshot re-serializes
byte-identical. `pushState`'s 409 handling: refetch the sha once and retry once; a second 409
returns `conflict-exhausted` rather than looping — under single-writer, a repeat conflict means
something's genuinely wrong, not a transient race. Covered by `src/lib/githubSync.test.ts` (mocked
`fetch`).

**Phase 2 — snapshot assembly + boot hydration, now wired into `App.tsx`.** `src/lib/localStore.ts`
gained a **shared** touched-ledger (`matracet:sync:touched:v1`, one small map keyed by store key —
not a companion localStorage key per store) rather than wrapping each store's own value, so every
existing `get()`/`getSnapshot()` caller is untouched. Three write paths, each with different sync
semantics: `set()` (a genuine local edit — stamps the ledger to "now"), `setFromSync(next,
touchedAt)` (sync hydration adopting a remote value — stamps the ledger to the *remote's* timestamp,
not now, so a freshly-hydrated value isn't mistaken for an edit and immediately re-pushed), and
`setSilently()` (persists without touching the ledger at all — for writes that are neither, see
below). `src/lib/syncStores.ts` is the **hand-picked** registry of which stores actually sync
(`SYNCED_STORES`, a `SyncableStore[]` erasing each store's own `T` via an adapter, since `T` is
contravariant in `set`/`setFromSync` and a plain array of `LocalStore<unknown>` doesn't typecheck)
— IN: feedback, irrelevant-offers, weekplan, category-feedback, stash, shopping list, chaos mode;
OUT: `matracet:fynd-collapsed:v1` (purely cosmetic per-device UI state, no cross-device value).
`src/lib/syncSnapshot.ts`'s `collectSnapshot()`/`applyRemoteSnapshot()` do the actual newer-wins
comparison (per-store, not per-snapshot-as-a-whole) and forward-compatibly ignore an unknown remote
store key instead of crashing. `src/lib/syncHydration.ts`'s `hydrateFromSync()` ties fetchState +
applyRemoteSnapshot together for `App.tsx`'s boot effect.

**Critique-gate finding worth keeping**: the boot `Promise.all` already writes to a synced store —
`mergeFeedbackBaseline` (gap-filling ratings from the git-tracked `feedback.json` baseline) calls
`feedbackStore.set(...)`. If that stayed a genuine `.set()`, it would stamp the ledger to "now" on
every boot that has any gap to fill, so a *later* sync hydration in the same boot would then always
see local as "just touched" and skip adopting a genuinely newer remote snapshot — silently breaking
sync, and the bug would depend on operation *ordering* between two independent async effects (fragile,
hard to test for). Fixed at the root instead of by sequencing: `mergeFeedbackBaseline` now calls
`feedbackStore.setSilently(...)` — a git-baseline gap-fill is conceptually the same non-edit category
as a sync hydration, not a fresh local edit, so it shouldn't move the ledger either. This makes the
two effects' relative order irrelevant to correctness, which is why hydration in `App.tsx` is a
*second, fully independent* `useEffect` — it never blocks or is blocked by the static data fetch, so
a slow/failing device-sync request can't become a second way for the `Laddar…` gate to spin forever.
Verified end-to-end with a throwaway Playwright script (not committed — one-off verification, see
Phase 2's own validation step) against `npm run preview`: zero `api.github.com` calls with no token
stored, and with a token + a mocked device-sync response, a remote-only store value (chaos mode)
lands in localStorage and `console.info('[matracet sync] hydrated from device-sync', …)` logs the
per-store decision (including `ignored-unknown-key` for a synthetic future-store test key).

Documented, not handled: newer-wins is a lexicographic compare of `toISOString()` timestamps, so a
wrong device clock can flip a comparison either way — cosmetic under the single-writer assumption
(worst case, a device's own earlier remote copy clobbers its own more-recent edit), not a
cross-writer data-loss risk.

**Phase 3 — auto-push + toast + Synka rework.** `src/lib/syncPusher.ts`'s `startSyncPusher()`
subscribes to every `SYNCED_STORES` entry; any change (re)arms a single 20s debounce timer
(`scheduleDebounced`), so rapid consecutive edits still produce one push, not one per edit. Its
exported `pushNow()` bypasses the debounce (used by the visibilitychange-hidden flush and the
Synka screen's manual "Synka nu" button) and is safe to call while a push is already in flight —
it sets a `dirtyDuringFlight` flag instead of starting a second concurrent PUT, and the in-flight
push's own `do/while` loop re-runs once with a fresh `collectSnapshot()` before returning, so an
edit that lands mid-push is never silently dropped, only delayed until that loop (or the next
debounce cycle) catches it. `startSyncPusher()` is idempotent — a second call while already
started returns a no-op teardown, so only the original caller's `stop()` can actually unsubscribe;
covered by `src/lib/syncPusher.test.ts` using `vi.useFakeTimers()` for all three critique-gate
scenarios (debounce coalescing, in-flight coalescing, double-start-then-stop leaves no dangling
subscription).

`src/lib/toastStore.ts` is a minimal in-memory (unlike every other store in this app, deliberately
**not** persisted — a toast is a this-load-only notification) pub-sub, rendered by
`src/components/ToastHost.tsx` and mounted once in `main.tsx` alongside `<App />` so it's never
gated by `App`'s own loading state. `src/lib/syncStatus.ts` tracks last-push/last-hydration time
and the last error for the Synka screen, plus the **shared failure-episode flag**
(`reportSyncFailure`/`recordPushSuccess`/`recordHydration`) — both the push and hydration paths
call into this one flag, not two independent ones, specifically because a real Playwright pass
caught the bug of having two: with a mocked-failing GitHub API, boot-time hydration failed and
toasted, then clicking "Synka nu" (which pushes, then hydrates-without-its-own-toast) failed again
and toasted a *second* time — technically "once per call site," not "once per episode." Centralizing
the flag so either path's success clears it, and either path's failure only toasts if the flag
wasn't already set, fixed it: re-ran the same script and got exactly one toast for the same
scenario. Kept as a concrete example here because it's exactly the class of bug "add tests, run
build" doesn't catch — only actually driving the failure path end-to-end surfaced it.

`SynkaView.tsx` is now the status/settings screen described in the plan: a token field
(`getToken`/`setToken`/`clearToken` from `githubSync.ts`), last-push/last-hydration/last-error
display (`useSyncStatus`), a "↻ Synka nu" button (disabled without a token) that calls
`pushNow()` then `hydrateFromSync(false)`, and the **original** download-based export flow moved
behind a native `<details>` "Manuell export" disclosure — not deleted, per the plan's explicit
"this is the degraded mode" instruction; it works identically to before, just no longer the
screen's primary content.

Verified via a throwaway Playwright script (not committed) against `npm run preview`: screenshot
of the token-entry Synka screen with no token; a second pass with a token stored and every
`api.github.com` request mocked to fail, confirming exactly one toast renders and "Senaste fel"
shows on screen. The debounce/coalescing timing itself is proven by the fake-timer unit tests
above, not by eyeballing a browser network tab — a deliberately stronger and cheaper check for
that specific behavior than the plan's own "manually verify in devtools" validation step.

**Phase 4 — merge script + workflow, built but deliberately not dispatched.**
`scripts/merge-device-sync.mjs` ports `.claude/skills/sync-local-storage/SKILL.md`'s
feedback-merge rule into deterministic code — `loadSnapshot()` refuses (throws, no write) on
any schema-version mismatch or unparseable snapshot; `mergeFeedback()` does the same
per-(recipe,person) merge the skill describes, but compares each entry's own `updatedAt`
instead of "trust the paste" (sound for a one-off human paste, not for a recurring automated
merge). Deliberately narrow: **only `matracet:feedback:v1` has a canonical merge target
implemented.** Every other synced store key is skipped and logged, not silently dropped —
weekplan/shopping-list/stash/chaos-mode have no git-tracked canonical file to merge into at
all (by design, see the local-only-override tier elsewhere in this file); category-feedback's
mechanical merge (patch `public/data/erbjudanden/*/*.json` + lock the kategori lexicon, per
`sync-category-feedback` skill's step 2) is real, well-specified follow-up work intentionally
left for its own pass rather than rushed in alongside everything else in this session — stated
here as an open scope boundary, not a silent gap (see the repeated "don't overclaim
completeness" lesson elsewhere in this file). `scripts/merge-device-sync.test.mjs` (14 tests,
added to vitest's `include` glob alongside the existing `src/**/*.test.ts`) covers the refusal
cases, newer-wins in both directions, the exclude-OR rule, untouched-recipe preservation, and
idempotency — proven twice: once as a plain equality assertion in the test, and once by
literally running the CLI against the fixtures twice and `diff`ing the two output files on
disk (zero-byte diff), per the plan's explicit "assert idempotency by running it twice and
diffing" instruction.

`.github/workflows/merge-device-sync.yml` exists but has **only a `workflow_dispatch`
trigger, no `schedule:`** — the plan's Phase 4 critique gate requires the first live run to be
a manual dispatch with the resulting `main` diff reviewed by hand before a cron is ever
enabled, so shipping an active schedule now would violate that gate the moment this merges to
`main` (a `schedule:` trigger is otherwise inert on an unmerged feature branch, but there's no
reason to rely on that). It checks out `main`, fetches `device-sync` (tolerating either not
existing yet — logs and no-ops, doesn't fail the run), extracts `sync/state.json` via `git
show`, runs the merge script, and commits only if `feedback.json` actually changed. **Real gap
this surfaced, not just theorized**: `deploy.yml` only triggers on `push: branches: [main]`,
but GitHub does not fire a workflow's `push` trigger from a commit authenticated with the
default `GITHUB_TOKEN` (loop prevention, not configurable) — so this workflow's own commit to
`main` would silently never deploy. Fixed by adding a `workflow_dispatch` trigger to
`deploy.yml` too (purely additive, existing push-triggered behavior unchanged) and having the
merge workflow's last step call `gh workflow run deploy.yml --ref main` explicitly after a
successful push, per the plan's own "verify, and if not, call the deploy via
workflow_call/dispatch explicitly" instruction — this needed `actions: write` added to the
merge workflow's permissions block.

**Not yet done, on purpose**: the workflow has never been dispatched — no real commit has
landed on `main` from it, no diff has been hand-reviewed, and the cron trigger stays absent
until that happens. This was an explicit scope decision for this session, not an oversight.

**Phase 5 — intelligence queue + `run-sync-tasks` skill.** `src/hooks/useSyncTasks.ts` is the
`matracet:synctasks:v1` queue (`SyncTask { id, type, createdAt, payload }` — structured
intent, never prompt text) — `addSyncTask`/`pruneSyncTasks`, and it's in `SYNCED_STORES` so a
task queued on one device is visible to an interactive session working from `device-sync`
regardless of which device queued it. Wired into exactly **one** real feature, per the plan's
"proving case" instruction: `HandlaView.tsx`'s `submitAdd()` (the "Eget tillägg" manual add)
also queues a `resolve-manual-item` task, since a hand-typed item (unlike a Fynd/Bevaka/recipe
pick) has no offer attached yet. `.claude/skills/run-sync-tasks/` (`SKILL.md` + `tasks/
resolve-manual-item.md`) is the catalog — run interactively (explicitly *not* GitHub Actions,
same cost-model reasoning as every other Claude Code skill in this repo: token billing vs. the
existing subscription), it reads `sync/state.json` from `device-sync`, resolves each pending
task per its catalog file, and appends outcomes to `public/data/task-log.json` (new, seeded
empty). The device applies outcomes on its next boot: `src/lib/syncTaskOutcomes.ts`'s
`applyTaskOutcome` (one function per recognized `type`, currently just `resolve-manual-item` —
attaches the resolved `offerRef` to the still-unresolved matching item) and `pruneSyncTasks`
both run from a new step in `App.tsx`'s existing static-fetch `.then()`, right after the
feedback-baseline merge. Like that merge, `applyTaskOutcome` uses `shoppingListStore.
setSilently(...)`, not `.set()` — `task-log.json` is a static git-tracked file every device
fetches directly (not routed through `device-sync`), so applying it doesn't need to advance
the sync ledger, and doing so would risk the identical same-boot ordering hazard already fixed
for `mergeFeedbackBaseline` (see Phase 2's critique-gate note above).

**Standing rule** (also written into the skill itself): whenever implementation work creates a
new situation that needs cloud/LLM judgment rather than a deterministic script, add a task
type + its `tasks/<type>.md` procedure to the `run-sync-tasks` catalog in the same session —
grow the catalog while building, the same discipline as this file's own "Always be learning"
rule at the top.

**Critique gate** (three questions the plan requires answering):
- *What happens to a task the skill doesn't recognize?* Survives untouched, structurally: the
  skill only appends a `task-log.json` entry for a task it actually processed (SKILL.md §2 is
  explicit — no entry for an unrecognized type, no guessing, no partial processing); the
  device's `pruneSyncTasks` only removes a task once its id appears in that log, so an
  unprocessed task simply stays in the queue indefinitely until a future catalog update
  recognizes it.
- *Can the deterministic Action and the skill ever both act on the same task?* No, and not
  just by convention — `merge-device-sync.mjs` has exactly one canonical merge target
  (`matracet:feedback:v1`); every other snapshot key, `matracet:synctasks:v1` included, always
  lands in that script's own `skipped` list (see its Phase 4 write-up above). The Action has
  no code path that reads or writes the task queue at all.
- *Does any catalog prompt instruct writing to device-sync?* No — `SKILL.md` §4 states this
  explicitly as a hard rule, and `tasks/resolve-manual-item.md` only reads offer files and
  writes a `result` payload for the log; nothing in either file tells Claude to push to
  `device-sync`.

Verified end-to-end (not dispatched — this needed no live GitHub calls to prove locally):
Playwright against `npm run preview`, typing "kaffe" into Handla's "Eget tillägg" input, then
reading `localStorage` directly — confirmed both `matracet:shopping:v1` (the plain item) and
`matracet:synctasks:v1` (a queued `resolve-manual-item` task with that exact payload) update
correctly. The apply+prune half is covered by `src/hooks/useSyncTasks.test.ts`'s "boot-time
hydration with tasks present" cases (mirroring `App.tsx`'s exact `applyTaskOutcome` →
`pruneSyncTasks` sequence) and `src/lib/syncTaskOutcomes.test.ts`.

**Repo visibility: decided, staying public (2026-07).** The plan's own risk section flagged
that auto-push inherits the repo's visibility — ratings, per-meal attendance overrides, and
the custody-derived weekplan flow to a public `device-sync` branch the moment a real token is
entered on a real device. Raised explicitly with the household; the decision is to accept that
tradeoff rather than make the repo private or narrow what gets synced. Not revisited unless
asked. Everything built so far (Phases 1-5) is still inert without a token and without the
merge workflow ever being dispatched, so none of it has actually moved any household data yet
— but there is no longer an open blocker standing in front of turning it on for real.

### PR #83 review fixes (2026-07)

A code review of the merged Phase 1-5 work found two real bugs (one data-loss-shaped, dormant
under single-device use) plus several hardening gaps. All fixed in the same PR before merge:

- **Multi-device wholesale-overwrite (the serious one).** `pushState` replaces
  `sync/state.json` *wholesale*, so a device whose cached `knownSha` predates another
  device's push would blindly overwrite that newer data before ever looking at it — under
  strict one-device use this can't fire, which is why nothing caught it before a second
  device was in the picture. Fixed two ways: `syncPusher.ts`'s `pushNow()` now runs
  `ensureFreshBeforePush()` — fetch-and-merge the branch's current state onto local stores,
  newer-wins per store, *before* computing what to push — whenever it doesn't already hold a
  known-fresh sha; and `SynkaView.tsx`'s manual "Synka nu" now hydrates *then* pushes (was the
  other way round), which covers the case where the pusher's cached sha is already warm from
  earlier in the session. Verified with a Playwright pass showing the real request order
  (GET before PUT) and a unit test with two fake stores — remote newer in one, local newer in
  the other — asserting the pushed snapshot contains the max of each, not a blind copy.
- **Junk commit on every app open.** `setFromSync` (hydration adopting a remote value) has to
  notify subscribers same as a real edit, so every boot armed the debounced pusher, which
  ~20s later would PUT a snapshot byte-identical to what the branch already held.
  `syncSnapshot.ts`'s new `stableStoresKey()` gives a stable (sorted-key) fingerprint of just
  a snapshot's `stores` content (deliberately excluding the envelope's `deviceId`/top-level
  `updatedAt`, which legitimately differ between two snapshots with identical store content);
  `syncPusher.ts` tracks the last confirmed-matching key and skips the PUT entirely when a
  push's content matches it. Seeded from boot-time hydration too (`seedKnownSha`'s new
  `storesKey` parameter), not just the pusher's own first discovery fetch, so this is warm
  from a session's very first push, not just its second.
- **No client-side schema-version check.** The merge script refused a mismatched
  `version` before writing anything; the client itself just blind-cast whatever the branch
  held. `hydrateFromSync` now refuses (reports failure, doesn't apply) a snapshot whose
  `version !== 1` — per-key forward compatibility only ever covered *additive* change.
- **Malformed store entries adoptable on a fresh device.** A brand-new device has
  `touchedAt() === null` for everything, so `applyRemoteSnapshot`'s newer-wins check let *any*
  entry win unconditionally — including one with a missing `updatedAt` or no `data` field at
  all. `sync/state.json` lives on a public, hand-editable branch, so this wasn't purely
  theoretical. Added a shape guard (`isWellFormedEntry`) and a new `'skipped-malformed'`
  decision.
- **403 conflated "bad token" with "rate-limited."** GitHub returns 403 for both; mapping
  both to `'unauthorized'` would tell a merely-rate-limited user their token is broken — the
  one diagnosis that sends them to regenerate a perfectly good PAT. `classifyAuthFailure`
  checks `x-ratelimit-remaining: 0` / `retry-after` and classifies those as the retryable
  `'network'` status instead.
- **Backgrounded-tab flush could be killed mid-request.** The `visibilitychange → hidden`
  flush is exactly the moment mobile browsers are most likely to freeze/kill an in-flight
  fetch. The PUT now sets `keepalive: true` (the same transport `navigator.sendBeacon` uses),
  and `putOnce` warns in the console once the base64 payload approaches the ~64KB keepalive
  cap, since weekplan + shopping list + sync tasks will only grow.
- **Two smaller notes, not code fixes**: `mergeFeedback`'s very first live run will likely
  report `changed: true` from field-shape normalization alone (an absent `excludeFromWeekPlan`
  becoming an explicit `false`) — commented in the script so the Phase 4 gate's required
  diff review isn't spent puzzling over a non-bug. `run-sync-tasks/SKILL.md` gained an
  explicit "a task id is its identity, its payload is immutable — if you ever see the same id
  with two different payloads, stop and report, don't guess" rule, plus a note on the safe
  (not-yet-needed) condition for eventually compacting `task-log.json`.

All of the above shipped with tests (141 total, up from 130) and a fresh Playwright pass
confirming the real request ordering and toast behavior end-to-end, not just mocked units.

## Deploy

Pushing to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`) which runs `npm ci && npm run build` and deploys `dist/` to GitHub Pages. No manual steps needed.
