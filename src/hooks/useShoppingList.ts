import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'

export interface ManualShoppingItem {
  id: string
  vara: string
  addedAt: string
}

export interface ShoppingListState {
  /** Ids of items (recipe ingredient, bevaka hit, or manual) the user has checked off — "already have, don't need". Kept (not deleted) so they can be restored. */
  removedIds: string[]
  manualItems: ManualShoppingItem[]
}

const EMPTY: ShoppingListState = { removedIds: [], manualItems: [] }

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

function addManualItem(vara: string): void {
  const trimmed = vara.trim()
  if (!trimmed) return
  const state = shoppingListStore.get()
  const item: ManualShoppingItem = {
    id: `manual:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
    vara: trimmed,
    addedAt: new Date().toISOString(),
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
function addOrRestoreByName(vara: string): void {
  const existing = findByName(vara)
  if (existing) {
    restore(existing.id)
    return
  }
  addManualItem(vara)
}

/** Mirrors addOrRestoreByName: checks a matching manual item off (moves it to
 * "Bortmarkerat") instead of deleting it, consistent with this store's
 * restore-don't-delete convention. No-op if nothing matches. */
function removeOrMarkByName(vara: string): void {
  const existing = findByName(vara)
  if (existing) markRemoved(existing.id)
}

export interface UseShoppingList {
  removedIds: Set<string>
  manualItems: ManualShoppingItem[]
  markRemoved: (id: string) => void
  restore: (id: string) => void
  addManualItem: (vara: string) => void
  addOrRestoreByName: (vara: string) => void
  removeOrMarkByName: (vara: string) => void
  isActiveByName: (vara: string) => boolean
}

export function useShoppingList(): UseShoppingList {
  const data = useSyncExternalStore(shoppingListStore.subscribe, shoppingListStore.getSnapshot, () => EMPTY)
  const removedIds = new Set(data.removedIds)
  return {
    removedIds,
    manualItems: data.manualItems,
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
  }
}
