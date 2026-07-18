// Assembling and applying GitHub-sync snapshots (Phase 2 of the auto-sync plan — see
// CLAUDE.md's "GitHub-backed auto-sync" section). Pure logic, no network — githubSync.ts
// does the actual fetching/pushing, syncHydration.ts wires this into app boot.

import type { SyncState } from './githubSync'
import { getDeviceId } from './deviceId'
import { SYNCED_STORES, type SyncableStore } from './syncStores'

const EPOCH = new Date(0).toISOString()

/** Snapshot every synced store's current value + its own last-touched time. A store that has
 * never been `set`/`setFromSync`'d locally (touchedAt() === null, e.g. a brand-new device that
 * only ever received a hydration once code goes live) reports the epoch, so it never wins a
 * newer-wins comparison against anything with a real timestamp. */
export function collectSnapshot(stores: SyncableStore[] = SYNCED_STORES): SyncState {
  const result: SyncState['stores'] = {}
  let latest = EPOCH
  for (const store of stores) {
    const touchedAt = store.touchedAt() ?? EPOCH
    result[store.key] = { updatedAt: touchedAt, data: store.getSnapshot() }
    if (touchedAt > latest) latest = touchedAt
  }
  return {
    version: 1,
    deviceId: getDeviceId(),
    updatedAt: latest,
    stores: result,
  }
}

export interface HydrationDecision {
  key: string
  action: 'adopted' | 'kept-local' | 'ignored-unknown-key'
}

/**
 * Apply a remote snapshot onto local stores, newer-wins per store (not per snapshot as a
 * whole — one store having a newer remote value never overwrites a different store that
 * happens to have an older one). A remote key with no matching local store is ignored, not
 * an error: forward compatibility for a snapshot written by a newer client version, or one
 * synced before a store was removed from SYNCED_STORES.
 *
 * NOTE — device clock skew: "newer" is a lexicographic compare of ISO 8601 timestamps
 * (`new Date().toISOString()`'s fixed-width UTC format, so this is a valid substitute for a
 * numeric compare as long as every caller uses that exact format). If this device's clock is
 * wrong, comparisons can go the wrong way in either direction. Documented, not handled —
 * under the plan's single-writer assumption this is cosmetic (worst case: this device's own
 * edit looks older than it is, and gets clobbered by its own earlier remote copy), not a
 * data-loss risk across genuinely different writers.
 */
export function applyRemoteSnapshot(
  remote: SyncState,
  stores: SyncableStore[] = SYNCED_STORES,
): HydrationDecision[] {
  const decisions: HydrationDecision[] = []
  const byKey = new Map(stores.map(s => [s.key, s]))
  for (const [key, entry] of Object.entries(remote.stores ?? {})) {
    const store = byKey.get(key)
    if (!store) {
      decisions.push({ key, action: 'ignored-unknown-key' })
      continue
    }
    const localTouchedAt = store.touchedAt()
    const remoteIsNewer = !localTouchedAt || entry.updatedAt > localTouchedAt
    if (remoteIsNewer) {
      store.setFromSync(entry.data, entry.updatedAt)
      decisions.push({ key, action: 'adopted' })
    } else {
      decisions.push({ key, action: 'kept-local' })
    }
  }
  return decisions
}
