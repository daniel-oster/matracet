import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'

/** One "this offer's kategori is wrong" flag, raised by long-pressing an offer row in Fynd. */
export interface CategoryFeedbackEntry {
  /** Offer name as flagged (original casing) — matched case-insensitively, same convention as useIrrelevantOffers. */
  name: string
  wrongCategory: string
  correctCategory: string
  updatedAt: string
}

export interface CategoryFeedbackState {
  /** Keyed by normalized (trimmed, lowercased) offer name — one open correction per product name. */
  entries: Record<string, CategoryFeedbackEntry>
}

const EMPTY: CategoryFeedbackState = { entries: {} }

export const categoryFeedbackStore = createLocalStore<CategoryFeedbackState>('matracet:category-feedback:v1', EMPTY)

function normalize(namn: string): string {
  return namn.trim().toLowerCase()
}

function flagMismatch(namn: string, wrongCategory: string, correctCategory: string): void {
  const key = normalize(namn)
  const state = categoryFeedbackStore.get()
  categoryFeedbackStore.set({
    entries: {
      ...state.entries,
      [key]: { name: namn, wrongCategory, correctCategory, updatedAt: new Date().toISOString() },
    },
  })
}

function clear(namn: string): void {
  const key = normalize(namn)
  const state = categoryFeedbackStore.get()
  if (!(key in state.entries)) return
  const entries = { ...state.entries }
  delete entries[key]
  categoryFeedbackStore.set({ entries })
}

export interface UseCategoryFeedback {
  entries: CategoryFeedbackEntry[]
  getCorrection: (namn: string) => CategoryFeedbackEntry | undefined
  flagMismatch: (namn: string, wrongCategory: string, correctCategory: string) => void
  clear: (namn: string) => void
}

export function useCategoryFeedback(): UseCategoryFeedback {
  const data = useSyncExternalStore(categoryFeedbackStore.subscribe, categoryFeedbackStore.getSnapshot, () => EMPTY)
  return {
    entries: Object.values(data.entries),
    getCorrection: (namn: string) => data.entries[normalize(namn)],
    flagMismatch,
    clear,
  }
}
