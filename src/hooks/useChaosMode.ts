import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'

/**
 * Household-wide local flag for "this stretch is chaotic" (vacation, no fixed schedule,
 * "we don't know where we'll be or what we'll have") — flips Planera's default from the
 * usual day-by-day slotting flow to the pantry/stash-first view (see StashPantryPanel).
 * Scoped to Planera only; it does not touch Hub or the read-only Vecka overview.
 */
const chaosModeStore = createLocalStore<boolean>('matracet:chaosmode:v1', false)

export interface UseChaosMode {
  enabled: boolean
  toggle: () => void
}

export function useChaosMode(): UseChaosMode {
  const enabled = useSyncExternalStore(chaosModeStore.subscribe, chaosModeStore.getSnapshot, () => false)
  return {
    enabled,
    toggle: () => chaosModeStore.set(!chaosModeStore.get()),
  }
}
