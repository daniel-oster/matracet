// Device-local metadata about the sync process itself (last push/hydration time, last
// error) — shown on the Synka screen. Deliberately NOT in src/lib/syncStores.ts's
// SYNCED_STORES: syncing "when did this device last sync" across devices would be
// circular and meaningless. Uses setSilently throughout since this store never
// participates in the newer-wins sync ledger to begin with.
//
// Also owns the shared "failure episode" flag: both the push path (syncPusher.ts) and the
// hydration path (syncHydration.ts) can fail independently, but from the user's point of
// view a failing push right after a failing hydration is one ongoing "sync is down" episode,
// not two — reportSyncFailure/reportSyncSuccess are shared by both so only one toast fires
// per episode regardless of which path (or how many retries of either) hit the failure.

import { useSyncExternalStore } from 'react'
import { createLocalStore } from './localStore'
import { showToast } from './toastStore'

export interface SyncStatusState {
  lastPushAt: string | null
  lastHydrationAt: string | null
  lastError: string | null
}

const EMPTY: SyncStatusState = { lastPushAt: null, lastHydrationAt: null, lastError: null }

const syncStatusStore = createLocalStore<SyncStatusState>('matracet:sync:status:v1', EMPTY)

let failureEpisodeActive = false

export function recordPushSuccess(): void {
  syncStatusStore.setSilently({ ...syncStatusStore.get(), lastPushAt: new Date().toISOString(), lastError: null })
  failureEpisodeActive = false
}

export function recordHydration(): void {
  syncStatusStore.setSilently({ ...syncStatusStore.get(), lastHydrationAt: new Date().toISOString() })
  failureEpisodeActive = false
}

/** Record a push or hydration failure. Always updates lastError (shown on the Synka screen
 * every time), but only toasts once per episode — an episode ends the moment either a push
 * or a hydration next succeeds (recordPushSuccess/recordHydration above). */
export function reportSyncFailure(reason: string, toast: boolean): void {
  syncStatusStore.setSilently({ ...syncStatusStore.get(), lastError: reason })
  if (toast && !failureEpisodeActive) {
    failureEpisodeActive = true
    showToast('Synk misslyckades — sparat lokalt, försöker igen', 'error')
  }
}

export function useSyncStatus(): SyncStatusState {
  return useSyncExternalStore(syncStatusStore.subscribe, syncStatusStore.getSnapshot, () => EMPTY)
}
