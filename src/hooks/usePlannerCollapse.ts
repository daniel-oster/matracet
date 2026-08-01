import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'

/** Which of Planera's inspiration-first collapsible sections (2026-08 redesign, issue #93)
 *  the user has toggled away from their default state — "Vad kan vi laga hemma?", "🔓 Ett
 *  köp bort", and "Alla recept" default collapsed; "🏷 Veckans fynd" and "💡 Förslag från
 *  fynden" default open. A separate store from useCollapsedCategories (Fynd's own section
 *  ids live in a different namespace and shouldn't ever collide with these). */
export interface PlannerCollapseState {
  sectionIds: string[]
}

const EMPTY: PlannerCollapseState = { sectionIds: [] }

export const plannerCollapseStore = createLocalStore<PlannerCollapseState>('matracet:planner-collapsed:v1', EMPTY)

function toggle(sectionId: string): void {
  const state = plannerCollapseStore.get()
  const next = state.sectionIds.includes(sectionId)
    ? state.sectionIds.filter(s => s !== sectionId)
    : [...state.sectionIds, sectionId]
  plannerCollapseStore.set({ sectionIds: next })
}

export interface UsePlannerCollapse {
  isCollapsed: (sectionId: string, defaultCollapsed: boolean) => boolean
  toggle: (sectionId: string) => void
}

/** Presence in the stored set means "toggled away from its default" — same convention as
 *  useCollapsedCategories — so callers pass their own default per section rather than this
 *  hook hardcoding a list. */
export function usePlannerCollapse(): UsePlannerCollapse {
  const data = useSyncExternalStore(plannerCollapseStore.subscribe, plannerCollapseStore.getSnapshot, () => EMPTY)
  const set = new Set(data.sectionIds)
  return {
    isCollapsed: (sectionId: string, defaultCollapsed: boolean) => (defaultCollapsed ? !set.has(sectionId) : set.has(sectionId)),
    toggle,
  }
}
