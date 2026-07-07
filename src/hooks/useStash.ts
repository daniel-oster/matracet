import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'

/**
 * One entry in the "vacation mode" stash pool — either a link to a real recipe
 * or a freeform idea (e.g. a cheap-offer-driven meal with no recipe file yet,
 * like "grillburgare" or "korv från frysen"). Not date-keyed like weekPlanStore —
 * this is a rotation of ready-to-cook options, not a calendar.
 */
/** 'dish' = a meal/idea (recipe-linked or freeform, e.g. "Grillburgare"). 'stock' = a raw
 * ingredient/offer pickup (e.g. "Fläskfärs 500g") — the thing you build a dish out of. */
export type StashKind = 'dish' | 'stock'

export interface StashItem {
  id: string
  namn: string
  kind: StashKind
  receptSlug: string | null
  taggar: string[]
  anteckning: string | null
  done: boolean
  addedAt: string
}

export interface StashState {
  items: StashItem[]
}

const EMPTY: StashState = { items: [] }

export const stashStore = createLocalStore<StashState>('matracet:stash:v1', EMPTY)

function addItem(
  namn: string,
  kind: StashKind,
  receptSlug: string | null,
  taggar: string[],
  anteckning: string | null,
): void {
  const trimmed = namn.trim()
  if (!trimmed) return
  const state = stashStore.get()
  const item: StashItem = {
    id: `stash:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
    namn: trimmed,
    kind,
    receptSlug,
    taggar,
    anteckning,
    done: false,
    addedAt: new Date().toISOString(),
  }
  stashStore.set({ items: [...state.items, item] })
}

function toggleDone(id: string): void {
  const state = stashStore.get()
  stashStore.set({
    items: state.items.map(i => (i.id === id ? { ...i, done: !i.done } : i)),
  })
}

function remove(id: string): void {
  const state = stashStore.get()
  stashStore.set({ items: state.items.filter(i => i.id !== id) })
}

export interface UseStash {
  items: StashItem[]
  addItem: (namn: string, kind: StashKind, receptSlug: string | null, taggar: string[], anteckning: string | null) => void
  toggleDone: (id: string) => void
  remove: (id: string) => void
}

export function useStash(): UseStash {
  const state = useSyncExternalStore(stashStore.subscribe, stashStore.getSnapshot, () => EMPTY)
  return {
    items: state.items,
    addItem,
    toggleDone,
    remove,
  }
}
