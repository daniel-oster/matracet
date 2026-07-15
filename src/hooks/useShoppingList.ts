import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'

export interface ManualShoppingItem {
  id: string
  vara: string
  addedAt: string
  /** Set when added via the recipe ingredient picker (RecipeOverlay's "Lägg till i
   * inköpslistan" checklist) — an amount string (e.g. "500 g") and the recipe it came
   * from. Plain "Eget tillägg" adds and Fynd/Bevaka pulls leave both unset. */
  amount?: string
  source?: string
}

export interface AddManualItemExtra {
  amount?: string
  source?: string
}

export interface ShoppingListState {
  /** Ids of items (recipe ingredient, bevaka hit, or manual) the user has checked off — "already have, don't need". Kept (not deleted) so they can be restored. */
  removedIds: string[]
  manualItems: ManualShoppingItem[]
  /** Manual item id -> store key ('willys'/'ica'/'hemkop'), for the few manual adds that are
   * tied to one specific store (e.g. "toilet paper, the big Willys pack"). Unset = shown in
   * every store's filtered view — see HandlaView's "show one store at a time" mode. */
  storeAssignments: Record<string, string>
}

const EMPTY: ShoppingListState = { removedIds: [], manualItems: [], storeAssignments: {} }

export const shoppingListStore = createLocalStore<ShoppingListState>('matracet:shopping:v1', EMPTY)

function markRemoved(id: string): void {
  const state = shoppingListStore.get()
  if (state.removedIds.includes(id)) return
  shoppingListStore.set({ ...state, removedIds: [...state.removedIds, id] })
}

function restore(id: string): void {
  const state = shoppingListStore.get()
  if (!state.removedIds.includes(id)) return
  shoppingListStore.set({ ...state, removedIds: state.removedIds.filter(x => x !== id) })
}

function addManualItem(vara: string, extra?: AddManualItemExtra): void {
  const trimmed = vara.trim()
  if (!trimmed) return
  const state = shoppingListStore.get()
  const item: ManualShoppingItem = {
    id: `manual:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
    vara: trimmed,
    addedAt: new Date().toISOString(),
    ...(extra?.amount ? { amount: extra.amount } : {}),
    ...(extra?.source ? { source: extra.source } : {}),
  }
  shoppingListStore.set({ ...state, manualItems: [...state.manualItems, item] })
}

function findByName(vara: string): ManualShoppingItem | undefined {
  const needle = vara.trim().toLowerCase()
  return shoppingListStore.get().manualItems.find(m => m.vara.toLowerCase() === needle)
}

/** Add a manual item by name, deduped case-insensitively — used when pulling an
 * offer into the shopping list (Fynd double-click, Skafferi stash pool). If a
 * matching item was previously checked off, this restores it instead of creating
 * a duplicate. */
function addOrRestoreByName(vara: string, extra?: AddManualItemExtra): void {
  const existing = findByName(vara)
  if (existing) {
    restore(existing.id)
    return
  }
  addManualItem(vara, extra)
}

/** Mirrors addOrRestoreByName: checks a matching manual item off (moves it to
 * "Bortmarkerat") instead of deleting it, consistent with this store's
 * restore-don't-delete convention. No-op if nothing matches. */
function removeOrMarkByName(vara: string): void {
  const existing = findByName(vara)
  if (existing) markRemoved(existing.id)
}

/** Cycles a manual item's store tag through willys -> ica -> hemkop -> (unset). */
function cycleStore(id: string, order: string[]): void {
  const state = shoppingListStore.get()
  const assignments = { ...(state.storeAssignments ?? {}) }
  const idx = assignments[id] ? order.indexOf(assignments[id]) : -1
  const next = idx + 1 < order.length ? order[idx + 1] : null
  if (next) assignments[id] = next
  else delete assignments[id]
  shoppingListStore.set({ ...state, storeAssignments: assignments })
}

export interface UseShoppingList {
  removedIds: Set<string>
  manualItems: ManualShoppingItem[]
  storeAssignments: Record<string, string>
  markRemoved: (id: string) => void
  restore: (id: string) => void
  addManualItem: (vara: string, extra?: AddManualItemExtra) => void
  addOrRestoreByName: (vara: string, extra?: AddManualItemExtra) => void
  removeOrMarkByName: (vara: string) => void
  isActiveByName: (vara: string) => boolean
  cycleStore: (id: string, order: string[]) => void
}

export function useShoppingList(): UseShoppingList {
  const data = useSyncExternalStore(shoppingListStore.subscribe, shoppingListStore.getSnapshot, () => EMPTY)
  const removedIds = new Set(data.removedIds)
  return {
    removedIds,
    manualItems: data.manualItems,
    storeAssignments: data.storeAssignments ?? {},
    markRemoved,
    restore,
    addManualItem,
    addOrRestoreByName,
    removeOrMarkByName,
    isActiveByName: (vara: string) => {
      const needle = vara.trim().toLowerCase()
      const item = data.manualItems.find(m => m.vara.toLowerCase() === needle)
      return !!item && !removedIds.has(item.id)
    },
    cycleStore,
  }
}
