import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'
import { reconcilePoolEntries } from '../lib/mealPool'
import { weekPlanStore, type WeekPlanStore } from './useWeekPlan'
import type { MealKind } from '../types'
import { stashStore } from './useStash'

/**
 * The 2026-08 Planera redesign's "meal pool" (issue #93): the plannable unit for a week is a
 * pool of meal needs, not a grid of days. A pool entry may or may not be slotted to a
 * specific day+meal — `slot` is a *pointer* into `useWeekPlan`, which stays the single
 * source of truth for what a slot actually contains (see reconcilePoolEntries). Slotting a
 * pool entry still requires calling `useWeekPlan.setMeal` alongside `setSlot` here — this
 * store only tracks the pool side of that pair; see VeckanPlanner's `assignToSlot` for the
 * combined operation.
 */
export interface MealPoolSlotPointer {
  date: string
  kind: MealKind
}

export interface MealPoolEntry {
  id: string
  mealSlug: string
  receptSlug: string | null
  addedAt: string
  slot: MealPoolSlotPointer | null
  /** "We ate this" for an unslotted entry — chaos-mode-style done marking, kept (not
   *  deleted) same as every other restore-don't-delete store in this app. */
  done?: boolean
  /** Id of the pool entry this is leftovers of, when this entry was created via "↩ rester"
   *  — see the design's leftover-linking section. Orphaned (source removed/moved) rester
   *  entries are flagged, never silently deleted. */
  resterAv?: string
}

export interface MealPoolState {
  entries: MealPoolEntry[]
}

const EMPTY: MealPoolState = { entries: [] }

export const mealPoolStore = createLocalStore<MealPoolState>('matracet:mealpool:v1', EMPTY)

function genId(): string {
  return `pool:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`
}

/** Canonical base for any mutation: reconciled against the current weekplan so a stale
 *  pointer never gets built on top of by accident. */
function currentEntries(): MealPoolEntry[] {
  return reconcilePoolEntries(mealPoolStore.get().entries, weekPlanStore.get())
}

function addEntry(mealSlug: string, receptSlug: string | null, opts?: { resterAv?: string }): string {
  const id = genId()
  const entry: MealPoolEntry = {
    id,
    mealSlug,
    receptSlug,
    addedAt: new Date().toISOString(),
    slot: null,
    ...(opts?.resterAv ? { resterAv: opts.resterAv } : {}),
  }
  mealPoolStore.set({ entries: [...currentEntries(), entry] })
  return id
}

function removeEntry(id: string): void {
  mealPoolStore.set({ entries: currentEntries().filter(e => e.id !== id) })
}

function toggleDone(id: string): void {
  mealPoolStore.set({ entries: currentEntries().map(e => (e.id === id ? { ...e, done: !e.done } : e)) })
}

/** Update only the pool's own pointer — never touches useWeekPlan. Pass `null` to return an
 *  entry to the unslotted pool without removing it. See VeckanPlanner's assignToSlot for the
 *  combined operation that also writes the slot's actual contents. */
function setSlot(id: string, slot: MealPoolSlotPointer | null): void {
  mealPoolStore.set({ entries: currentEntries().map(e => (e.id === id ? { ...e, slot } : e)) })
}

function findBySlot(date: string, kind: MealKind): MealPoolEntry | undefined {
  return currentEntries().find(e => e.slot?.date === date && e.slot?.kind === kind)
}

const STASH_MIGRATION_KEY = 'matracet:mealpool:stashmigrated:v1'

/** One-time migration: stash `kind: 'dish'` entries are exactly unslotted pool entries (same
 *  mealSlug/receptSlug/done shape) — see the design's data-model section. `kind: 'stock'`
 *  items are untouched, they stay pantry state in useStash. Guarded by a small marker key
 *  (rather than "pool non-empty", since a device might legitimately have an empty pool after
 *  migrating) so it only ever runs once per device. Safe to call on every boot. */
export function migrateStashDishesToPool(): void {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(STASH_MIGRATION_KEY)) return
  } catch {
    return
  }
  const stashState = stashStore.get()
  const dishItems = stashState.items.filter(i => i.kind === 'dish')
  if (dishItems.length > 0) {
    const existing = mealPoolStore.get().entries
    const migrated: MealPoolEntry[] = dishItems.map(i => ({
      id: `pool:migrated:${i.id}`,
      mealSlug: i.mealSlug ?? i.receptSlug ?? i.namn,
      receptSlug: i.receptSlug,
      addedAt: i.addedAt,
      slot: null,
      ...(i.done ? { done: true } : {}),
    }))
    mealPoolStore.setSilently({ entries: [...existing, ...migrated] })
  }
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STASH_MIGRATION_KEY, '1')
  } catch {
    // storage unavailable — best effort, next boot will just try again
  }
}

export interface UseMealPool {
  entries: MealPoolEntry[]
  addEntry: (mealSlug: string, receptSlug: string | null, opts?: { resterAv?: string }) => string
  removeEntry: (id: string) => void
  toggleDone: (id: string) => void
  setSlot: (id: string, slot: MealPoolSlotPointer | null) => void
  findBySlot: (date: string, kind: MealKind) => MealPoolEntry | undefined
}

export function useMealPool(): UseMealPool {
  const poolData = useSyncExternalStore(mealPoolStore.subscribe, mealPoolStore.getSnapshot, () => EMPTY)
  const weekPlanData = useSyncExternalStore(weekPlanStore.subscribe, weekPlanStore.getSnapshot, () => ({} as WeekPlanStore))
  const entries = reconcilePoolEntries(poolData.entries, weekPlanData)
  return { entries, addEntry, removeEntry, toggleDone, setSlot, findBySlot }
}
