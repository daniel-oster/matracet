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

/** A stable (sorted-key) string of just a snapshot's `stores` content — deliberately
 * excludes the envelope's `deviceId`/top-level `updatedAt`, which legitimately differ
 * between two snapshots carrying identical store content (e.g. this device's own
 * `collectSnapshot()` vs. a remote snapshot last pushed by a different device). Used by
 * syncPusher.ts (PR #83 review fix) to detect "nothing actually changed" and skip a
 * would-be no-op PUT — e.g. the one that would otherwise fire ~20s after every hydration,
 * since setFromSync's listener notification arms the debounce timer same as a real edit. */
export function stableStoresKey(stores: SyncState['stores']): string {
  const sorted: SyncState['stores'] = {}
  for (const key of Object.keys(stores).sort()) sorted[key] = stores[key]
  return JSON.stringify(sorted)
}

export interface HydrationDecision {
  key: string
  action: 'adopted' | 'kept-local' | 'ignored-unknown-key' | 'skipped-malformed'
}

function isWellFormedEntry(entry: unknown): entry is { updatedAt: string; data: unknown } {
  return !!entry && typeof entry === 'object' && typeof (entry as { updatedAt?: unknown }).updatedAt === 'string' && 'data' in entry
}

/**
 * Apply a remote snapshot onto local stores, newer-wins per store (not per snapshot as a
 * whole — one store having a newer remote value never overwrites a different store that
 * happens to have an older one). A remote key with no matching local store is ignored, not
 * an error: forward compatibility for a snapshot written by a newer client version, or one
 * synced before a store was removed from SYNCED_STORES. A malformed entry (missing/non-string
 * `updatedAt`, or no `data` field at all) is skipped the same way, never adopted — the
 * single-writer app itself never produces one, but `sync/state.json` is a hand-editable file
 * on a public branch, and a fresh device (touchedAt() === null for everything) would
 * otherwise adopt *any* entry unconditionally, malformed or not (PR #83 review fix).
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
    if (!isWellFormedEntry(entry)) {
      decisions.push({ key, action: 'skipped-malformed' })
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
