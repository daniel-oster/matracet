# Planera, pass 2: make the meal list the main character (2026-08)

Follow-up to the #93 redesign (merged as #94). That pass built the right *model* — a meal pool
with optional slotting — but shipped it with the calendar still reading as the main subject and
with a real list↔week misalignment. This pass fixes both. Status: **proposal, not implemented.**

## The feedback

> "It's very unclear what constitutes the meal list for the week and what's just user interface
> on the plan part. The most important thing is actually the list. What slot the thing goes into
> is actually less important, because I need to have all the stuff to cook things. So the
> priority should be: make it easy to make the list. Now it feels like the calendar or the
> schedule is the main thing, but the list should be the main thing — it should be the top thing
> and it should be obvious that this is the list we're working with."

> "There is a discrepancy [in] what shows on different slots and what actually shows in the list.
> So we have stuff in the week which are not in the list, which shouldn't be able to happen."

Two separate problems: a **hierarchy** problem (the calendar out-ranks the list visually and
structurally) and a **correctness** problem (the list is not a faithful view of the week). The
second one is why the first one hurts — you can't trust the list, so you fall back to reading the
calendar.

## Problem 1: the list is not a faithful view of the week (confirmed bug)

**Root cause, `src/App.tsx:127-137` (`withMealSlug`).** A static `public/data/weeks/*.json` day
gets a `mealSlug` only if its free-text `recept` name matches a `meals.json` `namn`/alias, *or*
it carries a `receptSlug`. Otherwise the day is returned unchanged, with **no `mealSlug`**.

Downstream in `VeckanPlanner`, `filledSlots` is `flatSlots.filter(s => s.mealSlug)`. So such a day:
- **does** render on the slot board and in `SlotDetail` (those key off `label`, which is set), but
- **is filtered out** of `filledSlots`, so `buildPoolRows` synthesizes no derived row for it → it
  never appears in "Veckans måltider".

Measured against the real data (last 6 week files): **4 of 29 dish-days (~14%) resolve to no
`mealSlug`** — e.g. "Ugnsbakad lax & rotsaker", "Stekt fläsk & rödbetssallad", "Coq au vin",
"Fylld pasta (tortellini/ravioli) med smörsås och parmesan". Every one of those is a real dinner
that shows in the week and is missing from the list.

**Fix (root, not patch):** `withMealSlug` must always produce a `mealSlug` for a day that has a
dish name — fall back to `resolveMealForName(day.recept, mealsList).slug`, the same virtual-meal
mechanism used everywhere else in the app (`resolveMealForRecipe` for recipe-linked, and
`resolveMealForName` already exists for exactly the "freeform name, no recipe" case). A dish-day
without a meal identity should be impossible by construction.

Note what must *not* change: a `recept: null` + `anteckning` day ("ute och äter") legitimately has
no meal and must stay out of the list, and a slot with `attendance.skip` likewise. The invariant is
about *dishes*, not about slots.

**Make the invariant enforced, not aspirational.** Add a pure predicate in `mealPool.ts` and a test:

```
every non-skipped slot with a dish label ⇒ exactly one row in buildPoolRows(entries, filledSlots)
```

covering: a git-planned day with no meals.json match, a recipe-linked day, a locally-assigned day,
a note-only day (must produce *no* row), and a skipped slot (no row). "Shouldn't be able to happen"
becomes a test that fails when it does.

## Problem 2: derived rows are second-class, which is why "what's in the list" feels unclear

`buildPoolRows` synthesizes `derived: true` rows for filled slots with no pool entry. They render
in the list but can't be removed, marked done, or used as a leftover source (the `↩ rester` guard
added in #94's review fixes). So the list visibly contains two kinds of thing with different
powers — precisely the "unclear what constitutes the list" complaint.

**Fix: lazy materialization.** Keep derived rows as the *display* mechanism (no eager writes, no
orphan risk if a week file changes), but the moment the user acts on one — remove, mark done,
add leftovers, slot it elsewhere — promote it to a real pool entry first, then perform the action.
`materializeRow(row)` returns an entry id, creating the entry if `row.derived`. Every row then
offers every action, and the two-tier distinction disappears from the user's view entirely.

This also strictly improves on #94's review fix: instead of *hiding* `↩ rester` on derived rows
(correct but limiting), the button works and materializes first, so a git-planned Monday dinner
can produce a Tuesday-lunch leftover — which is exactly the workflow the leftover feature was
built for, and currently the one place it doesn't work.

## Problem 3: hierarchy — the list must lead

Current supply-column order is: budget → **board strip + expand toggle** → search → pool list →
offers → … and in landscape the board is a permanently sticky right column at `3fr 2fr`. The
calendar is the first thing you see and the only thing always on screen. That is backwards.

### New structure

1. **The list is the top of the screen and owns the header.** The budget line becomes the list's
   own header rather than a separate bar above the board — it describes the list ("Veckans
   måltider — 8 av 14 klara"), plus a one-line definition so there is no ambiguity about what
   this is: *"allt vi behöver kunna laga den här veckan"*. Constraint chips (🌱/⚡/↩) stay,
   attached to the list.
2. **Add/search sits immediately under the list header** — building the list is the primary job,
   so its controls are adjacent to the thing being built, not further down the page. "+ Ny måltid"
   stays permanently visible.
3. **Grouped within one list, unplanned first**:
   - **"Behöver plats"** — in the list, not yet slotted. This is the working set.
   - **"Inplanerade"** — slotted, each with a quiet day chip (`Mån ☾`) and its detail reachable.
   Reversing #94's slotted-first `sortPoolRows` is deliberate: slotted-first made the list read as
   a calendar transcript. Unplanned-first makes it read as what it is — the remaining work. (Note
   this only changes *presentation order*; `sortPoolRows`' chronological ordering is kept within
   the "Inplanerade" group.)
4. **The board is demoted to a secondary step.** In portrait: no strip above the list; the board
   lives *below* the list in a collapsed-by-default `📅 Placera på dagar` section. In landscape:
   it keeps the right column (there's room, and seeing the week while slotting is genuinely
   useful) but the ratio shifts to give the list clear dominance, the column is visually quieter
   (no card chrome competing with the list), and it is explicitly labelled as the secondary step.
   The board stays **read-only + tap-to-open-detail**; all assignment continues to happen from a
   list row's own "→ plats…" picker, per #93's decision.
5. **Offers and inspiration sections keep their #93 order and collapse behavior**, below the list.
   They feed the list; they don't compete with it.

### What this does not change

The data model from #93 is unchanged and correct: `useWeekPlan` remains the single source of truth
for slot contents, pool `slot` pointers stay pointers, `reconcilePoolEntries` still runs on every
read. This pass changes which surface leads and closes the faithfulness gap — it does not re-open
the pool/weekplan split, and it does not touch Hub/VeckanOverview/WeekWarnings/FamiljView/sync.

## Staged plan

1. **Faithfulness fix + enforced invariant** — `withMealSlug` fallback to `resolveMealForName`;
   the `buildPoolRows` completeness predicate + tests (including the four real week-file cases
   above as fixtures). Independently shippable and worth shipping first: it fixes wrong data with
   no UI churn.
2. **Lazy materialization** — `materializeRow`; every row gets every action; `↩ rester` works on a
   git-planned day; remove `!row.derived` action guards in `MealPoolList`.
3. **List-first layout** — budget-as-list-header with the definition line, add/search directly
   under it, unplanned-first grouping, board moved below/collapsed in portrait.
4. **Landscape rebalance** — ratio and visual weight so the list dominates; board quieter and
   labelled as the secondary step. Screenshot-verified at 844×390 per the repo's Playwright
   workflow.
5. **CLAUDE.md update** — rewrite the Planera section for the new hierarchy and the invariant.

## Open questions

- Should a **removed** derived row (a git-planned day the user deletes from the list) write an
  explicit skip/clear override so it stays gone across reloads? Proposal: yes — removing a
  materialized row that is slotted should clear that slot (`clearOverride`/skip), otherwise the
  derivation just brings it straight back and the delete looks broken. Needs confirming against
  the "never lose a git-planned meal" rule from #93 — clearing a slot is user-initiated and
  reversible, so this seems consistent, but it is the one place the two rules touch.
- Landscape: keep the board always-visible, or make it collapsible there too? Proposal: keep it
  (space exists), just visually subordinate.
