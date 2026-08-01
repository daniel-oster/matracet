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
      addedAt: '',
      slot: { date: s.date, kind: s.kind },
      derived: true,
    })
  }
  return rows
}

const KIND_ORDER: Record<MealKind, number> = { lunch: 0, dinner: 1 }

/** Slotted rows first (chronological, lunch before dinner), then unslotted rows oldest-added
 *  first — matches the mockup's reading order (this week's plan top-to-bottom, open ideas at
 *  the bottom waiting for a place). */
export function sortPoolRows(rows: PoolRow[]): PoolRow[] {
  return [...rows].sort((a, b) => {
    if (!!a.slot !== !!b.slot) return a.slot ? -1 : 1
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
