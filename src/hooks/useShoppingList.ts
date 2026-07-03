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

export interface UseShoppingList {
  removedIds: Set<string>
  manualItems: ManualShoppingItem[]
  markRemoved: (id: string) => void
  restore: (id: string) => void
  addManualItem: (vara: string) => void
}

export function useShoppingList(): UseShoppingList {
  const data = useSyncExternalStore(shoppingListStore.subscribe, shoppingListStore.getSnapshot, () => EMPTY)
  return {
    removedIds: new Set(data.removedIds),
    manualItems: data.manualItems,
    markRemoved,
    restore,
    addManualItem,
  }
}
