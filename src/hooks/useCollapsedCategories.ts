import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'

export interface CollapsedCategoriesState {
  /** groupIds (FyndView's CATS[].groupId) currently collapsed — persists across visits so a
   * category you always skip (e.g. Hygien & Hushåll) stays collapsed next time too. */
  groupIds: string[]
}

const EMPTY: CollapsedCategoriesState = { groupIds: [] }

export const collapsedCategoriesStore = createLocalStore<CollapsedCategoriesState>('matracet:fynd-collapsed:v1', EMPTY)

function toggle(groupId: string): void {
  const state = collapsedCategoriesStore.get()
  const next = state.groupIds.includes(groupId)
    ? state.groupIds.filter(g => g !== groupId)
    : [...state.groupIds, groupId]
  collapsedCategoriesStore.set({ groupIds: next })
}

export interface UseCollapsedCategories {
  isCollapsed: (groupId: string) => boolean
  toggle: (groupId: string) => void
}

export function useCollapsedCategories(): UseCollapsedCategories {
  const data = useSyncExternalStore(collapsedCategoriesStore.subscribe, collapsedCategoriesStore.getSnapshot, () => EMPTY)
  const set = new Set(data.groupIds)
  return {
    isCollapsed: (groupId: string) => set.has(groupId),
    toggle,
  }
}
