# Planera-redesign: pool → slots, one mode, landscape-first (2026-08)

Design proposal from the household's 2026-08-01 feedback session. Status: **proposal, not
implemented** — read this before touching `VeckanPlanner`. The staged plan at the bottom is the
intended build order.

## The feedback, distilled

1. Planning got cramped and confusing — rework the interface completely, designed for
   **landscape** (flip the phone, get two columns).
2. The real mental model: *"this week we need ~10 meals, and we need to fulfill those 10 meals
   somehow."* Meals are **a flat list first**; slotting them onto days is optional and secondary.
3. Slots carry **constraints** that tell you what kind of meals the list needs: who's present
   (→ vegan requirement), a short evening (→ need at least one fast meal).
4. **One search** across meals and recipes — two boxes was weird.
5. Offers shown while planning should be **food only** ("I don't need to see that tampons are on
   sale when I'm planning dinner"), **ranked by value**, high-value highlighted, with a
   collapsed-by-default expandable section suggesting meals/recipes from what's cheap.
6. Tapping an offer should add it to the shopping list — *"I don't think that happens either"* —
   there's a bug to fix here.
7. **One mode, not two** — chaos mode and week mode are actually the same activity: "we need this
   many meals; they may or may not be slotted to days."
8. Day-slotting view collapsed by default, expandable, with drag & drop of meals onto slots.
9. Adding a meal directly on a slot should also put it in the meal list.

## The bug (item 6) — confirmed in code, fix first

`FyndView` adds an offer to the shopping list on **`onDoubleClick`** (`fynd-row` in AllView,
`match-row` in JamforView). Double-tap on a touch device does not reliably fire `dblclick`
(iOS Safari treats it as a zoom/selection gesture, and the rows are wrapped in `SwipeRow`'s
pointer handling) — so on the phone, "click an offer → shopping list" effectively never works.
Note `BevakaView`'s match rows and `StashPantryPanel`'s offer chips already use plain `onClick`
and work fine — Fynd is the outlier.

**Fix**: make it a single tap. The Fynd rows have no competing single-click action (single tap is
currently unused; long-press = category flag, swipe = irrelevant), so plain `onClick` toggle is
free. Keep the `✓`/`.in-list` state rendering as-is. This is a small standalone PR, shippable
before any redesign work.

## Core reframe: the meal pool

**The plannable unit for a week is a pool of meal needs, not a grid of days.** This is not a new
idea being bolted on — it's the recognition that chaos mode (a flat pool of dishes, no days) and
normal mode (days first) were always two ends of the same activity. The redesign merges them:

- **Pool entry**: something the household has decided to eat this week. May be slotted to a
  specific day+meal, or not yet.
- **Budget**: how many meals the week needs, computed from the presence schedule + attendance
  overrides (non-skipped slots in the rolling 7-day window with ≥1 eater present). "Ingen måltid
  behövs" (already exists per-slot) is how the user shrinks it.
- **Coverage**: pool entries count toward the budget *whether or not they're slotted*. A fully
  unslotted week of 10 pool entries = old chaos mode. A fully slotted one = old week mode. Most
  real weeks are in between.
- **Constraints roll up from slots to the pool level**: "3 of your remaining 4 slots include
  Annabelle → you need ≥3 vegan-compatible meals" (via the existing `evaluateFit`), "Monday
  dinner is flagged ⚡ kort om tid → you need a fast meal" (new per-slot manual flag — there's no
  activity data source, so 'short evening' is a one-tap flag the user sets on a slot, same tier
  as the attendance override).

`useChaosMode` and the mode toggle are deleted. `StashPantryPanel` is decomposed (see below),
not kept as an alternate planner body.

### Data model

New local store `matracet:mealpool:v1` (registered in `SYNCED_STORES`):

```ts
interface MealPoolEntry {
  id: string
  mealSlug: string
  receptSlug: string | null
  addedAt: string          // ISO
  slot: { date: string; kind: MealKind } | null
  done?: boolean           // "we ate this" for unslotted entries (chaos-mode semantics)
  resterAv?: string        // id of the pool entry this is leftovers of (see below)
}
```

**Leftovers are pool entries too** (household decision 2026-08): a meal that produces
leftovers gets an "↩ rester" action; tapping it creates a *linked* pool entry
(`resterAv: <producing entry's id>`, display "Rester ← Korvstroganoff") that counts toward
the budget and can be slotted like any meal — typically the next day's lunch, which the UI
suggests as the default slot. The link means the rester entry follows its source: clearing or
moving the producing meal flags (not silently deletes) its orphaned rester entries. Suggestion
cards for dishes known to scale well can advertise it ("räcker till 2 luncher ↩"). This is a
deliberate first step toward the person-meal-pool leftover model flagged in CLAUDE.md's
"Open question for later" (dagkedja vs `CookingEvent.personMeals`) — the pool link is the
lightweight version; if it proves out, `dagkedja` retires.

**`useWeekPlan` stays the single source of truth for what's in a slot.** The pool's `slot` field
is a *pointer*, not a second copy: slotting a pool entry calls the existing `setMeal` and records
the pointer; unslotting calls `clearOverride` and nulls it. On load, a pointer whose slot no
longer holds that `mealSlug` is dropped (reconciliation, not trust). This keeps every existing
consumer — Hub's tonight glance, VeckanOverview, WeekWarnings, FamiljView, sync, migrations —
completely untouched: they all still read via `getOverride`/`applyOverride`.

Days planned in the static `public/data/weeks/*.json` files (git-planned weeks) appear in the
pool list as *derived* slotted entries (computed at render, not stored) so the list always shows
the whole week's meals, not just locally added ones.

**Stash migration**: `StashItem` `kind: 'dish'` entries migrate into the pool (they are exactly
unslotted pool entries — same `mealSlug`/`receptSlug`/`done` shape). `kind: 'stock'` items stay
in `useStash` — "things we have/bought" is pantry state, not a meal need; it keeps feeding
`haveNames` for pantry-match and component ranking. One-time migration on boot via
`setSilently`, same pattern as `migrateWeekPlanV2`/`migrateFeedbackV1`.

## Layout

### Inspiration (looked at, deliberately)

The pattern the household described is the **backlog + calendar side-by-side** pattern:

- **Sunsama**: to-do list and calendar side by side; drag unscheduled tasks from the backlog
  onto the calendar; the backlog is the only home for unscheduled work, which makes "what's not
  yet placed" always visible. This is the closest match to "10 meals as a list, slot them if
  you want."
- **Plan to Eat** (meal-planning specifically): two-panel layout, recipe list on one side,
  week calendar on the other, drag recipes onto days; scheduling a meal feeds the grocery list.
- **Motion**-style auto-scheduling was considered and rejected — the household wants to see and
  place the list themselves; constraints should *inform*, not auto-assign.

### Portrait (default, single column — top to bottom)

1. **Budget bar** (always visible, replaces nothing — new): "7 av 10 måltider" progress +
   unmet-constraint chips ("🌱 2 veganska saknas", "⚡ 1 snabb saknas"). Tapping a chip filters
   the pool/suggestions to candidates that satisfy it.
2. **Slot board — collapsed by default** (item 8): collapses to roughly today's `day-strip`
   (pills + fill dots, plus constraint glyphs 🌱/⚡ on pills that have unmet constraints).
   Expanding shows the full 7×2 grid. Tapping a slot makes it the **active slot** (replaces
   today's "active day" concept — one slot, not a day with two sub-slots), which arms every
   assign button below. Tapping the active slot again deselects → assign buttons revert to
   "+ Lägg i veckan" (add to pool, unslotted).
3. **The pool list** (the primary element): one row per entry — name, tags (⚡ tid, 🌱 fit via
   `evaluateFit`, 🏷 savings via offer match), slot badge ("Mån ☾") or "ej inplanerad", and
   actions: assign-to-active-slot / unslot / ✎ edit / remove. Component swaps and fit hints
   (Stage 3/4 work) render under the *active slot's* entry exactly as today — that machinery
   is kept, only its container changes.
4. **One search box** (item 4): merges today's two boxes (`Sök recept…` on the suggestion list
   and `Sök måltid eller recept…` in the meal-add section). One input that simultaneously
   filters the pool list, searches meals + recipes (the existing `mealMatches` union logic,
   which already covers both), and offers "+ Skapa ny måltid: '…'" on a miss. Results carry
   "+ Lägg i veckan" and — when a slot is active — "→ Mån ☾".
5. **🏷 Veckans fynd** (item 5): food-only offers ranked by `parseSavings` descending, top ~8
   visible, "visa fler" expands. High-value highlighted (existing `offer-chip--fynd` red).
   **Single tap = toggle on shopping list** (with `offerRef`, ✓ state) — same convention as
   Bevaka/Skafferi, and consistent with the Fynd bug fix. Below it, a collapsed-by-default
   `<details>`-style "Förslag från fynden": recipes/meals whose ingredients match the
   high-value offers (the existing `rankSuggestions` fynd scoring / `findOfferMatch`, seeded
   from the top offers), each with the same add/assign buttons.
6. **Suggestions** (the current `sugg-list`, demoted below the pool): same ranked cards, same
   filter/sort chips, but assign buttons write to the active slot or "+ Lägg i veckan".
   "🔓 Ett köp bort" stays here. "Vad kan vi laga?" (pantry match, from the decomposed
   `StashPantryPanel`) becomes a collapsible section here too, since with one mode it must
   live in the one planner.

**Food-only offer filter**: taxonomy groups make this trivial — include `frukt_gront`,
`protein`, `mejeri_ost`, `brod`, `fardigmat`, `skafferi`; exclude `hushall_hygien`, `barn`,
`djur`, `ovrigt` (the last three are already `standardDold`), and by default also
`godis_snacks`, `glass_dessert`, `dryck` — food, but not meal-building. Export a
`MEAL_PLANNING_GROUPS` constant from `kategoriTaxonomy.mjs` so this isn't a scattered list.

### Landscape / wide (the design target)

At the existing shared breakpoint — `(min-width: 860px), (orientation: landscape) and
(max-height: 600px)` — the planner becomes **two columns**:

- **Left ("supply")**: budget bar, search, pool list, offers, suggestions — the scrolling
  column.
- **Right ("demand")**: the slot board **fully expanded and sticky** — a compact 7-day × 2
  grid (day rows, lunch|middag cells showing dish name or "ledig", constraint glyphs,
  attendance badges). Always visible while the left column scrolls, so "browse options → place
  on day" never loses sight of the week. Grid ratio ~`3fr 2fr` left:right.

Landscape-height economics apply as established in the `RecipeOverlay` work: shrink the topbar
under `(orientation: landscape) and (max-height: 600px)`, no hero imagery, dense rows.

**Drag & drop** (item 8): tap-to-assign (select meal → tap slot, or select slot → tap meal) is
the **primary** mechanism — it works in portrait, on touch, and matches the app's
no-drag-precedent. Drag is a progressive enhancement on top: pointer-events-based (extend the
`SwipeRow` learnings — axis-lock, click suppression), drag a pool row onto a slot cell or
between slot cells. Build it *after* tap-assign works, and be prepared to cut it if it fights
touch scrolling — the tray-drag flow was removed once before for exactly this.

**Add a meal directly on a slot** (item 9): the active slot (or an empty slot cell in the
board) offers "+ Ny måltid här" → opens the existing `MealEditorModal` with
`onSaveAndAssign`-style behavior — the save creates the pool entry *and* slots it, so it's in
the list by construction. This already half-exists ("Spara → ☾ Middag"); it just needs the
entry to land in the pool too, which it now does automatically since slotting goes through the
pool.

## What happens to the other screens

- **VeckanOverview (Vecka read mode)**: unchanged — still the read view. Consider a small
  "X måltider ej inplanerade" line linking into Planera.
- **SkafferiView**: untouched in this pass (scope control). Once the planner absorbs
  pantry-match + offer cloud + the pool, most of Skafferi is duplicated; decide then whether it
  becomes a thin alias or is retired. Not silently dropped — an explicit later decision.
- **FyndView**: gets the tap-to-add fix (step 1) and, later, the same `MEAL_PLANNING_GROUPS`
  default-collapse could apply, but no other changes here.
- **HandlaView**: untouched — the manual-only contract holds; the planner only ever writes to
  the shopping list through explicit taps (offer tap, component button), as today.

## Staged plan (each stage shippable; don't start N+1 before N merges)

1. **Fynd tap-to-add bug fix** — `onDoubleClick` → `onClick` in `FyndView` (both AllView rows
   and JamforView match rows). Tiny, independent, fixes a real daily annoyance.
2. **Meal pool store + migration + budget bar + unified search** — `useMealPool`, stash-dish
   migration, chaos-mode toggle removed (`StashPantryPanel` sections fold in as collapsibles),
   the pool list renders above the suggestion list, both search boxes merge. Portrait only;
   slot assignment still via the existing active-day editor. This is the big conceptual merge.
3. **Slot board + active-slot flow** — replace day-strip/active-day with the collapsible slot
   board, per-slot ⚡ flag, constraint chips wired to `evaluateFit`, assign flow reworked to
   active-slot.
4. **Landscape two-column layout** — the CSS pass: sticky slot board right column at the shared
   wide/landscape breakpoint, topbar shrink, screenshot-verified at 844×390 per the established
   Playwright workflow.
5. **Offers panel** — food-only ranked offer strip with tap-to-shop + the collapsed
   "Förslag från fynden" section.
6. **Drag & drop enhancement** — pointer-based drag from pool to slots, after tap-assign is
   solid.
7. **Cleanup** — Skafferi decision, delete dead chaos-mode/stash-dish code paths, CLAUDE.md
   architecture section rewrite.

## Decisions from the household (2026-08 follow-up)

- **All meals count in the budget, lunches included.** No dinner-only default — the whole
  point of the view is to finally make lunch planning workable. "Ingen måltid behövs" per slot
  is the only way the budget shrinks. Leftover entries (above) are the main tool for actually
  filling lunch slots without inventing 7 new dishes.
- **The view's job is to inspire.** The failure mode being fixed is "staring at an empty week
  with no ideas" — so the supply column is ordered inspiration-first: the week's food offers
  and "Förslag från fynden" (meals/recipes derivable from what's cheap) are the primary
  creative trigger, with pantry-match, unlock, and the full recipe browser as collapsed
  sections you expand to shift mindset *without leaving the view*. Collapse state persists
  (same `useCollapsedCategories` pattern as Fynd).
- **Add-meal stays in the planning view** — the search box + "+ Ny måltid" (→
  `MealEditorModal`, with save-and-assign) is permanent top-of-column UI, not tucked behind a
  section.

**Mockup**: `docs/prototypes/planera-redesign-mockup.html` — static HTML in the paper design
language, responsive at the app's real breakpoint. Open it and rotate/resize to see both
layouts; screenshots were reviewed at 844×390 (landscape) and 390×760 (portrait).

## Open questions for the household

- **Godis/dryck in the offer strip**: excluded by default above — right call, or should
  `dryck` be included?
- **Drag & drop priority**: it's staged last on purpose; if tap-assign in landscape feels good
  enough, stage 6 can be skipped entirely.
