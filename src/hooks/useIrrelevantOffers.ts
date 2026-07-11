import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'

export interface IrrelevantOffersState {
  /** Lowercased, trimmed offer names swiped away by the user — hidden everywhere (Fynd, Skafferi), not just for the current week, since the point is "I never want to see this again". */
  names: string[]
}

const EMPTY: IrrelevantOffersState = { names: [] }

export const irrelevantOffersStore = createLocalStore<IrrelevantOffersState>('matracet:irrelevant-offers:v1', EMPTY)

function normalize(namn: string): string {
  return namn.trim().toLowerCase()
}

function markIrrelevant(namn: string): void {
  const key = normalize(namn)
  const state = irrelevantOffersStore.get()
  if (state.names.includes(key)) return
  irrelevantOffersStore.set({ names: [...state.names, key] })
}

function restore(namn: string): void {
  const key = normalize(namn)
  const state = irrelevantOffersStore.get()
  if (!state.names.includes(key)) return
  irrelevantOffersStore.set({ names: state.names.filter(n => n !== key) })
}

export interface UseIrrelevantOffers {
  isIrrelevant: (namn: string) => boolean
  markIrrelevant: (namn: string) => void
  restore: (namn: string) => void
}

export function useIrrelevantOffers(): UseIrrelevantOffers {
  const data = useSyncExternalStore(irrelevantOffersStore.subscribe, irrelevantOffersStore.getSnapshot, () => EMPTY)
  const set = new Set(data.names)
  return {
    isIrrelevant: (namn: string) => set.has(normalize(namn)),
    markIrrelevant,
    restore,
  }
}
