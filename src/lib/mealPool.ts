import type { MealKind } from '../types'
import type { WeekPlanStore } from '../hooks/useWeekPlan'
import type { MealPoolEntry } from '../hooks/useMealPool'

/**
 * `useWeekPlan` stays the single source of truth for what's actually in a slot — a pool
 * entry's `slot` field is a *pointer*, not a second copy (see CLAUDE.md / issue #93's data
 * model). A pointer can go stale (a device-sync merge that touched weekplan but not the
 * pool, or a slot cleared/swapped through a path that forgot to update the pointer) — this
 * drops any pointer whose slot no longer actually holds that entry's mealSlug.
 * Reconciliation, not trust: applied fresh on every read (see useMealPool.ts), never
 * persisted as an implicit side effect of merely reading.
 */
export function reconcilePoolEntries(entries: MealPoolEntry[], weekPlan: WeekPlanStore): MealPoolEntry[] {
  return entries.map(e => {
    if (!e.slot) return e
    const override = weekPlan[e.slot.date]?.[e.slot.kind]
    if (override?.mealSlug === e.mealSlug) return e
    return { ...e, slot: null }
  })
}

/**
 * Planera has no week switcher — "this week" is always the rolling 7-day window computed
 * fresh from today (see App.tsx). A pool entry has no such reset built in, so a *slotted*
 * entry whose date has scrolled out of that window (a meal planned days/weeks ago, now in
 * the past) would otherwise keep rendering in "Veckans måltider" forever — the reported bug
 * ("what I planned a couple weeks ago still lingers in the plan"). Filters those out of the
 * *display* list only (never mutates storage — see reconcilePoolEntries for the actual
 * stale-pointer cleanup, a different concern). An **unslotted** entry (no day assigned yet)
 * is deliberately kept regardless of age — it's a backlog meal idea, not tied to any one
 * week, and clearing it out from under the user was never reported or asked for.
 */
export function filterEntriesToWindow(entries: MealPoolEntry[], windowDates: string[]): MealPoolEntry[] {
  const inWindow = new Set(windowDates)
  return entries.filter(e => !e.slot || inWindow.has(e.slot.date))
}

export type DisplacedOccupantAction =
  | { type: 'unslot-pool-entry'; entryId: string }
  | { type: 'create-pool-entry'; mealSlug: string; receptSlug: string | null }
  | { type: 'none' }

/**
 * What to do with whatever currently occupies a slot before a new assignment overwrites it
 * — the slot picker's swap semantics (design's "picking an occupied slot swaps" rule: the
 * old occupant returns to the pool, never deleted). Keyed off the slot's *resolved* current
 * content (`currentSlot`, from `flatSlots`/`SlotInfo` — reflects both a local
 * `WeekPlanOverride` and a git-planned `public/data/weeks/*.json` day identically), not off
 * whether a `WeekPlanOverride` happens to exist — a static-week day has no override at all,
 * so keying off the override alone silently dropped exactly that (very common) case. A real
 * pool entry already pointing at the slot just needs unslotting; anything else the slot is
 * currently showing needs a fresh pool entry created for it so it isn't lost; a genuinely
 * empty slot needs nothing.
 */
export function resolveDisplacedOccupant(
  poolEntryAtSlot: MealPoolEntry | undefined,
  currentSlot: { mealSlug: string | undefined; receptSlug: string | null; filled: boolean },
): DisplacedOccupantAction {
  if (poolEntryAtSlot) return { type: 'unslot-pool-entry', entryId: poolEntryAtSlot.id }
  if (currentSlot.filled && currentSlot.mealSlug) {
    return { type: 'create-pool-entry', mealSlug: currentSlot.mealSlug, receptSlug: currentSlot.receptSlug }
  }
  return { type: 'none' }
}

export interface PoolRow extends MealPoolEntry {
  /** True for a slot-derived row synthesized purely for display (a git-planned week day, or
   *  an assignment made without going through the pool) — never persisted, and pool-only
   *  actions (remove, ↩ rester) don't apply to it. See buildPoolRows. */
  derived: boolean
}

/** A slot currently on the week's board — enough to synthesize a derived pool row for it
 *  and to decide whether it counts toward the budget (see computeBudget's BudgetSlotFlags,
 *  a separate, richer shape callers build once they've resolved meals/recipes/eaters). */
export interface FilledSlot {
  date: string
  kind: MealKind
  mealSlug: string
  receptSlug: string | null
  /** The slot's already-resolved display name (SlotInfo.label) — carried onto a derived
   *  row's `mealNamn` (see MealPoolEntry) so it can render correctly even when `mealSlug` is
   *  a *freeform* virtual meal (resolveMealForName's slugify() fallback, no meals.json entry
   *  and no receptSlug — e.g. a git-planned day like "Ugnsbakad lax & rotsaker" with neither).
   *  Without this, a derived row for such a day has nothing but its own slug to render — see
   *  docs/planera-list-first-2026-08.md's faithfulness fix, which is what makes this case
   *  reachable in the first place (before it, such a day had no mealSlug at all and never
   *  reached the pool). A recipe-linked or meals.json-matched slot's `label` is redundant
   *  with what MealPoolList already resolves from `meals`/`recipeIndex`, but carrying it
   *  unconditionally is simpler than a second code path that only sometimes needs it. */
  label: string
}

/**
 * The pool rows to actually render: every real (reconciled) stored entry, plus a synthetic
 * "derived" row for every currently-filled slot that has no real pool entry pointing at it
 * — so the pool list always reflects the whole week's meals (including days planned in the
 * static public/data/weeks/*.json files, or assignments made before this system existed),
 * not just locally pool-tracked ones. Derived rows are computed fresh each call, never
 * written to storage.
 */
export function buildPoolRows(entries: MealPoolEntry[], filledSlots: FilledSlot[]): PoolRow[] {
  const bySlotKey = new Set(entries.filter(e => e.slot).map(e => `${e.slot!.date}:${e.slot!.kind}`))
  const rows: PoolRow[] = entries.map(e => ({ ...e, derived: false }))
  for (const s of filledSlots) {
    const key = `${s.date}:${s.kind}`
    if (bySlotKey.has(key)) continue
    rows.push({
      id: `derived:${key}`,
      mealSlug: s.mealSlug,
      receptSlug: s.receptSlug,
      mealNamn: s.label,
      addedAt: '',
      slot: { date: s.date, kind: s.kind },
      derived: true,
    })
  }
  return rows
}

export interface CompletenessViolation {
  date: string
  kind: MealKind
  /** How many rows buildPoolRows produced for this slot — should always be 1. 0 means the
   *  slot's dish is missing from the list entirely (the confirmed bug this predicate guards
   *  against); >1 means a duplicate (e.g. two pool entries both pointing at the same slot). */
  count: number
}

/**
 * The design's own enforced invariant (see docs/planera-list-first-2026-08.md, "make the
 * invariant enforced, not aspirational"): every non-skipped slot with a dish — every
 * `FilledSlot` the caller passes in — must produce exactly one row in
 * `buildPoolRows(entries, filledSlots)`. Returns the violating slots (empty when the
 * invariant holds) rather than throwing, so a test can assert on it directly. Note-only days
 * and skipped slots are never in `filledSlots` to begin with (see VeckanPlanner's own
 * `flatSlots.filter(s => s.mealSlug)` — a skipped slot's mealSlug is undefined), so this
 * predicate never needs to special-case them.
 */
export function checkPoolCompleteness(entries: MealPoolEntry[], filledSlots: FilledSlot[]): CompletenessViolation[] {
  const rows = buildPoolRows(entries, filledSlots)
  const violations: CompletenessViolation[] = []
  for (const s of filledSlots) {
    const count = rows.filter(r => r.slot?.date === s.date && r.slot?.kind === s.kind).length
    if (count !== 1) violations.push({ date: s.date, kind: s.kind, count })
  }
  return violations
}

const KIND_ORDER: Record<MealKind, number> = { lunch: 0, dinner: 1 }

/** Unslotted rows first (oldest-added first), then slotted rows (chronological, lunch before
 *  dinner) — the "list-first" redesign's deliberate reversal of the #93 slotted-first order
 *  (docs/planera-list-first-2026-08.md, Problem 3): slotted-first made the list read as a
 *  calendar transcript, whereas unslotted-first reads as what it actually is — the remaining
 *  work ("Behöver plats"), with the already-decided plan ("Inplanerade") below it. Only the
 *  presentation order of the two groups flips; chronological order is kept *within* the
 *  slotted group. */
export function sortPoolRows(rows: PoolRow[]): PoolRow[] {
  return [...rows].sort((a, b) => {
    if (!!a.slot !== !!b.slot) return a.slot ? 1 : -1
    if (a.slot && b.slot) {
      if (a.slot.date !== b.slot.date) return a.slot.date < b.slot.date ? -1 : 1
      return KIND_ORDER[a.slot.kind] - KIND_ORDER[b.slot.kind]
    }
    return a.addedAt < b.addedAt ? -1 : a.addedAt > b.addedAt ? 1 : 0
  })
}

/** Per-slot facts the budget/constraint-chip math needs — built by the caller (VeckanPlanner)
 *  from resolved meals/recipes/eaters/evaluateFit, kept here as plain booleans so this module
 *  stays pure and independently testable. */
export interface BudgetSlotFlags {
  /** Not skipped, and at least one eater is actually present — see the design's own budget
   *  definition ("non-skipped slots ... with ≥1 eater present"). */
  needsMeal: boolean
  filled: boolean
  veganRequired: boolean
  veganSatisfied: boolean
  fastFlag: boolean
  fastSatisfied: boolean
  isLeftover: boolean
}

export interface BudgetSummary {
  total: number
  filled: number
  veganMissing: number
  fastMissing: number
  leftoverPlanned: number
}

export function computeBudget(slots: BudgetSlotFlags[]): BudgetSummary {
  const needed = slots.filter(s => s.needsMeal)
  return {
    total: needed.length,
    filled: needed.filter(s => s.filled).length,
    veganMissing: needed.filter(s => s.veganRequired && !s.veganSatisfied).length,
    fastMissing: needed.filter(s => s.fastFlag && !s.fastSatisfied).length,
    leftoverPlanned: slots.filter(s => s.isLeftover).length,
  }
}
