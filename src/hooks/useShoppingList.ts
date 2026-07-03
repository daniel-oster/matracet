import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'

export interface ManualShoppingItem {
  id: string
  vara: string
  addedAt: string
}

export interface ShoppingHistoryEntry {
  vara: string
  action: 'removed' | 'added'
  at: string
}

export interface ShoppingListState {
  /** Ids of computed (recipe/bevaka) items the user has checked off — "already have, don't need". */
  removedIds: string[]
  manualItems: ManualShoppingItem[]
  /** Recent changes, newest first — surfaced in the copy-to-clipboard text. */
  history: ShoppingHistoryEntry[]
}

const EMPTY: ShoppingListState = { removedIds: [], manualItems: [], history: [] }
const MAX_HISTORY = 40

export const shoppingListStore = createLocalStore<ShoppingListState>('matracet:shopping:v1', EMPTY)

function pushHistory(state: ShoppingListState, entry: ShoppingHistoryEntry): ShoppingHistoryEntry[] {
  return [entry, ...state.history].slice(0, MAX_HISTORY)
}

function markRemoved(id: string, vara: string): void {
  const state = shoppingListStore.get()
  if (state.removedIds.includes(id)) return
  shoppingListStore.set({
    ...state,
    removedIds: [...state.removedIds, id],
    history: pushHistory(state, { vara, action: 'removed', at: new Date().toISOString() }),
  })
}

function addManualItem(vara: string): void {
  const trimmed = vara.trim()
  if (!trimmed) return
  const state = shoppingListStore.get()
  const now = new Date().toISOString()
  const item: ManualShoppingItem = {
    id: `manual:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
    vara: trimmed,
    addedAt: now,
  }
  shoppingListStore.set({
    ...state,
    manualItems: [...state.manualItems, item],
    history: pushHistory(state, { vara: trimmed, action: 'added', at: now }),
  })
}

function removeManualItem(id: string): void {
  const state = shoppingListStore.get()
  const item = state.manualItems.find(m => m.id === id)
  if (!item) return
  shoppingListStore.set({
    ...state,
    manualItems: state.manualItems.filter(m => m.id !== id),
    history: pushHistory(state, { vara: item.vara, action: 'removed', at: new Date().toISOString() }),
  })
}

export interface UseShoppingList {
  removedIds: Set<string>
  manualItems: ManualShoppingItem[]
  history: ShoppingHistoryEntry[]
  markRemoved: (id: string, vara: string) => void
  addManualItem: (vara: string) => void
  removeManualItem: (id: string) => void
}

export function useShoppingList(): UseShoppingList {
  const data = useSyncExternalStore(shoppingListStore.subscribe, shoppingListStore.getSnapshot, () => EMPTY)
  return {
    removedIds: new Set(data.removedIds),
    manualItems: data.manualItems,
    history: data.history,
    markRemoved,
    addManualItem,
    removeManualItem,
  }
}
