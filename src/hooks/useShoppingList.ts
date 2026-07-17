import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'

/** Points at the exact offer a shopping-list item was pulled from — which store's flyer and
 * which week — so "Kaffe" on the list can be resolved back to "Nescafé Snabbkaffe Refill
 * 200g, 2 för 165:-" instead of just the generic product name. Deliberately not a snapshot of
 * the offer's fields: weekly offer files are kept forever (see _index.json's `veckor`), so a
 * {store, week} ref plus the item's own name is enough to always re-look-up the live record —
 * no duplicated data that could drift from the source, and HandlaView's lookup naturally
 * reflects the source file if it's ever corrected. */
export interface ShoppingOfferRef {
  store: string
  week: string
}

export interface ManualShoppingItem {
  id: string
  vara: string
  addedAt: string
  /** Set when added via the recipe ingredient picker (RecipeOverlay's "Lägg till i
   * inköpslistan" checklist) — an amount string (e.g. "500 g") and the recipe it came
   * from. Plain "Eget tillägg" adds and Fynd/Bevaka pulls leave both unset. */
  amount?: string
  source?: string
  /** Set when added from a Fynd/Bevaka/Skafferi offer — see ShoppingOfferRef. Absent for plain
   * "Eget tillägg" adds and recipe ingredients, which HandlaView highlights as manual. */
  offerRef?: ShoppingOfferRef
}

export interface AddManualItemExtra {
  amount?: string
  source?: string
  /** Store key ('willys'/'ica'/'hemkop') the item actually came from — set when adding from a
   * Fynd/Bevaka/Skafferi offer, so the store pill is correct immediately instead of starting
   * unset and waiting for a manual tap. Never overrides an existing assignment (e.g. a manual
   * cycleStore tag the user already made). Defaults to `offerRef.store` below when omitted. */
  storeKey?: string
  offerRef?: ShoppingOfferRef
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
    ...(extra?.offerRef ? { offerRef: extra.offerRef } : {}),
  }
  const storeKey = extra?.storeKey ?? extra?.offerRef?.store
  const storeAssignments = storeKey
    ? { ...(state.storeAssignments ?? {}), [item.id]: storeKey }
    : (state.storeAssignments ?? {})
  shoppingListStore.set({ ...state, manualItems: [...state.manualItems, item], storeAssignments })
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
    const state = shoppingListStore.get()
    const currentAssignments = state.storeAssignments ?? {}
    const storeKey = extra?.storeKey ?? extra?.offerRef?.store
    const storeAssignments = storeKey && !currentAssignments[existing.id]
      ? { ...currentAssignments, [existing.id]: storeKey }
      : currentAssignments
    // Re-picking an existing item from a fresh offer (e.g. re-adding this week's coffee
    // deal) should point the ref at that week — the user is actively confirming this one.
    if (extra?.offerRef) {
      shoppingListStore.set({
        ...state,
        manualItems: state.manualItems.map(m => (m.id === existing.id ? { ...m, offerRef: extra.offerRef } : m)),
        storeAssignments,
      })
    } else if (storeAssignments !== currentAssignments) {
      shoppingListStore.set({ ...state, storeAssignments })
    }
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
  isActiveForOffer: (vara: string, store: string) => boolean
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
    // Like isActiveByName, but for a specific store's offer: two different offers can share
    // the same generic name (e.g. "Kaffe" at both ICA and Hemköp) while being different
    // products. Since the list only ever holds one item per name (see addOrRestoreByName),
    // that item's offerRef says which specific store's offer it actually points at right
    // now — only that offer should show as "in list", not every offer with the same name.
    // An item with no offerRef (e.g. typed in by hand) still matches any store, same as before.
    isActiveForOffer: (vara: string, store: string) => {
      const needle = vara.trim().toLowerCase()
      const item = data.manualItems.find(m => m.vara.toLowerCase() === needle && (!m.offerRef || m.offerRef.store === store))
      return !!item && !removedIds.has(item.id)
    },
    cycleStore,
  }
}
