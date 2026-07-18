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
//
// PR #83 review fix (multi-device wholesale-overwrite): whenever this device doesn't already
// hold a known-fresh sha, it must fetch-and-merge the branch's current state onto local
// stores *before* computing what to push — otherwise a device that's behind (e.g. it hasn't
// hydrated since another device's last push) would blindly overwrite that newer remote data
// with its own stale copy. See ensureFreshBeforePush() below.
//
// PR #83 review fix (junk commits on every app open): `setFromSync` notifies subscribers the
// same as a real edit (it has to, for the UI to update) — so every boot's hydration arms this
// pusher's debounce timer, and ~20s later it would PUT a snapshot byte-identical to what the
// branch already holds. `lastKnownStoresKey` tracks the store content we last confirmed
// matches the branch (from either a successful push or a successful discovery fetch); a push
// whose content matches it is skipped entirely — see stableStoresKey in syncSnapshot.ts for
// why this compares only `stores`, not the whole snapshot envelope.

import { fetchState, pushState, type PushStateResult } from './githubSync'
import { applyRemoteSnapshot, collectSnapshot, stableStoresKey } from './syncSnapshot'
import { SYNCED_STORES } from './syncStores'
import { reportSyncFailure, recordPushSuccess } from './syncStatus'

const DEBOUNCE_MS = 20_000

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let pushInFlight = false
let dirtyDuringFlight = false
let knownSha: string | null | undefined // undefined = unknown, (re)discover-and-merge on next push
let lastKnownStoresKey: string | null = null // null = unknown — never skip until established
let started = false

function scheduleDebounced(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void pushNow()
  }, DEBOUNCE_MS)
}

/** Called only when knownSha is undefined (fresh start, or after a prior push failed/
 * conflicted). Fetches the branch's current state and merges it onto local stores
 * (newer-wins, same as boot hydration) before this device computes what to push — so a
 * device that's behind can never wholesale-overwrite data it hasn't seen yet. Returns
 * false when the caller should skip this push attempt entirely (couldn't safely determine
 * the current remote state), true once knownSha is set and it's safe to proceed. */
async function ensureFreshBeforePush(): Promise<boolean> {
  const current = await fetchState()
  if (current.status === 'ok' && current.state) {
    applyRemoteSnapshot(current.state)
    knownSha = current.sha
    lastKnownStoresKey = stableStoresKey(current.state.stores)
    return true
  }
  if (current.status === 'not-found') {
    knownSha = null // nothing on the branch yet — fine to create it fresh
    return true
  }
  if (current.status === 'no-token') return false // pushState will no-op the same way
  reportSyncFailure(`push: ${current.status}`, true)
  return false
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
    let result: PushStateResult | undefined
    do {
      dirtyDuringFlight = false

      if (knownSha === undefined && !(await ensureFreshBeforePush())) {
        continue // couldn't safely discover+merge — try again only if something new landed
      }

      const snapshot = collectSnapshot()
      const storesKey = stableStoresKey(snapshot.stores)
      if (storesKey === lastKnownStoresKey) {
        // Nothing actually changed since our last known-good state — most commonly right
        // after a hydration that only reconfirmed data we already had. Skip the network PUT
        // entirely rather than commit a byte-identical snapshot.
        recordPushSuccess()
        continue
      }

      result = await pushState(snapshot, knownSha)

      if (result.status === 'ok') {
        knownSha = result.sha
        lastKnownStoresKey = storesKey
        recordPushSuccess()
      } else if (result.status === 'no-token') {
        // Nothing to do — not a failure, just nothing to push to.
      } else {
        // Our cached sha may now be stale (conflict) or simply unconfirmed (network/auth
        // failure) — force re-discovery (and re-merge) on the next attempt.
        knownSha = undefined
        reportSyncFailure(`push: ${result.status}`, true)
      }
    } while (dirtyDuringFlight)
  } finally {
    pushInFlight = false
  }
}

/** Lets boot-time hydration (App.tsx, via syncHydration.ts's returned `sha`/`storesKey`) hand
 * its already-fetched state straight to the pusher, so the first push of a session doesn't
 * pay for a second, redundant discovery-and-merge fetch — the hydration one already did the
 * same job, and without this the "skip a no-op push" guard above wouldn't kick in until the
 * pusher did its *own* discovery fetch, letting exactly the junk-commit-after-hydration bug
 * back in for a session's first push. Only takes effect if the pusher hasn't already
 * discovered/pushed since boot — a push failure or a genuinely newer local edit both still
 * force a fresh re-discovery regardless, via knownSha being reset to undefined (see pushNow
 * above), which naturally re-establishes lastKnownStoresKey too. `storesKey` is omitted for a
 * "confirmed nothing on the branch yet" hydration outcome, since seeding it as "unknown" (not
 * a stale stale value) is what correctly forces the next push to actually happen. */
export function seedKnownSha(sha: string | null, storesKey?: string): void {
  if (knownSha === undefined) knownSha = sha
  if (storesKey !== undefined && lastKnownStoresKey === null) lastKnownStoresKey = storesKey
}

/** Test-only: resets the pusher's in-memory discovery/dedup state to match a fresh page
 * load. Never called by app code — module state otherwise persists across a whole test
 * file's run, which would let one test's push leak into another's assertions. */
export function __resetForTests(): void {
  knownSha = undefined
  lastKnownStoresKey = null
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
