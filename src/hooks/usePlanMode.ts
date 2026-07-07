import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'

/**
 * Household-wide switch (not per-week data — there's no backend, so this is one flag
 * per device, same as everything else local) between the normal calendar-first Hub
 * and "semester" mode, where the Hub leads with the Skafferi pool instead of tonight's
 * planned dish, since during vacation chaos there often isn't a "planned dish" yet.
 */
export type PlanMode = 'normal' | 'semester'

const planModeStore = createLocalStore<PlanMode>('matracet:planmode:v1', 'normal')

export interface UsePlanMode {
  mode: PlanMode
  toggle: () => void
}

export function usePlanMode(): UsePlanMode {
  const mode = useSyncExternalStore(planModeStore.subscribe, planModeStore.getSnapshot, () => 'normal')
  return {
    mode,
    toggle: () => planModeStore.set(planModeStore.get() === 'normal' ? 'semester' : 'normal'),
  }
}
