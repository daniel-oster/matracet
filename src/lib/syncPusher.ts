// Debounced auto-push to device-sync (Phase 3 of the auto-sync plan — see CLAUDE.md's
// "GitHub-backed auto-sync" section). Subscribes to every synced store; ~20s after the last
// change, pushes one snapshot. Flushes immediately when the tab is backgrounded. Guards
// against three classic bugs (see the commit message that introduced this file for the
// worked-through reasoning):
//   1. Push storm on every store notification — a change never triggers an immediate push,
//      only (re)arms a single debounce timer, so N rapid edits still produce one push.
//   2. Lost final state when a change lands during an in-flight push — collectSnapshot() is
//      always called fresh at push time (never a snapshot captured earlier and reused), and a
//      second flush() call arriving while one is already in flight sets `dirty` and the
//      in-flight push's own loop re-runs once it finishes, instead of the second call
//      launching a second concurrent PUT.
//   3. Duplicate subscriptions on hot-reload / repeated start calls — `startSyncPusher` is a
//      no-op if already started; its own stop() is the only thing that resets that guard, so
//      calling start twice without an intervening stop can't double-subscribe.

import { pushState, type PushStateResult } from './githubSync'
import { collectSnapshot } from './syncSnapshot'
import { SYNCED_STORES } from './syncStores'
import { reportSyncFailure, recordPushSuccess } from './syncStatus'

const DEBOUNCE_MS = 20_000

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let pushInFlight = false
let dirtyDuringFlight = false
let knownSha: string | null | undefined // undefined = unknown, discover on next push
let started = false

function scheduleDebounced(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void pushNow()
  }, DEBOUNCE_MS)
}

/** Push the current snapshot now, bypassing the debounce wait. Safe to call concurrently —
 * a call that lands while another is already in flight coalesces into that one instead of
 * starting a second PUT (see guard #2 above). Also the entry point for the Synka screen's
 * manual "Synka nu" button and the visibilitychange-hidden flush. */
export async function pushNow(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (pushInFlight) {
    dirtyDuringFlight = true
    return
  }

  pushInFlight = true
  try {
    let result: PushStateResult
    do {
      dirtyDuringFlight = false
      const snapshot = collectSnapshot()
      result = await pushState(snapshot, knownSha)

      if (result.status === 'ok') {
        knownSha = result.sha
        recordPushSuccess()
      } else if (result.status === 'no-token') {
        // Nothing to do — not a failure, just nothing to push to.
      } else {
        // Our cached sha may now be stale (conflict) or simply unconfirmed (network/auth
        // failure) — force re-discovery on the next attempt rather than keep reusing it.
        knownSha = undefined
        reportSyncFailure(`push: ${result.status}`, true)
      }
    } while (dirtyDuringFlight)
  } finally {
    pushInFlight = false
  }
}

/** Subscribe to every synced store and start the debounce/visibilitychange machinery.
 * Returns a teardown function. Calling this again while already started is a no-op that
 * returns a no-op teardown — only the original caller's teardown actually stops it. */
export function startSyncPusher(): () => void {
  if (started) return () => {}
  started = true

  const unsubscribers = SYNCED_STORES.map(store => store.subscribe(() => scheduleDebounced()))

  const onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      void pushNow()
    }
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  return () => {
    started = false
    unsubscribers.forEach(u => u())
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }
}
