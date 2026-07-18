// Boot-time hydration from GitHub sync (Phase 2 of the auto-sync plan — see CLAUDE.md's
// "GitHub-backed auto-sync" section). Deliberately isolated from the app's existing static
// data fetch in App.tsx: this must never block or delay the `Laddar…` loading gate, which
// depends only on the static Promise.all — a hung or failing device-sync fetch must not
// become a second way for that gate to spin forever. Every path here resolves; nothing throws
// out of `hydrateFromSync`.

import { fetchState } from './githubSync'
import { applyRemoteSnapshot, stableStoresKey, type HydrationDecision } from './syncSnapshot'
import { recordHydration, reportSyncFailure } from './syncStatus'

export interface HydrationOutcome {
  status: 'skipped-no-token' | 'skipped-not-found' | 'applied' | 'error'
  decisions?: HydrationDecision[]
  reason?: string
  /** The remote file's sha, when known (status 'applied' or 'skipped-not-found' — the latter
   * as `null`, meaning "confirmed the file doesn't exist yet"). syncPusher.ts's
   * seedKnownSha() uses this to avoid a redundant discovery fetch on the next push. */
  sha?: string | null
  /** A stable key for the remote's `stores` content as of this fetch (status 'applied' only —
   * omitted for 'skipped-not-found', since there's nothing to compare against and seeding a
   * value there would wrongly let the next push skip creating the file). Also passed to
   * seedKnownSha() so the pusher's "nothing changed, skip the PUT" guard is warm from boot,
   * not just after the pusher's own first discovery fetch. */
  storesKey?: string
}

/** `toast` defaults to true; the manual "Synka nu" button on the Synka screen passes false and
 * surfaces the outcome inline instead, since a toast would be redundant right next to a button
 * the user just pressed. Toasting itself is deduped per failure episode shared with the push
 * path (see syncStatus.ts's reportSyncFailure) — a failing hydration right after a failing
 * push (or vice versa) is one ongoing "sync is down" episode, not two toasts. */
export async function hydrateFromSync(toast = true): Promise<HydrationOutcome> {
  try {
    const result = await fetchState()
    if (result.status === 'no-token') return { status: 'skipped-no-token' }
    if (result.status === 'not-found') {
      recordHydration()
      return { status: 'skipped-not-found', sha: null }
    }
    if (result.status !== 'ok' || !result.state) {
      reportSyncFailure(`hydration: ${result.status}`, toast)
      return { status: 'error', reason: result.status }
    }
    // PR #83 review fix: the merge script (scripts/merge-device-sync.mjs) refuses a
    // mismatched schema version before writing anything — the client-side hydration path
    // must hold itself to the same standard, not blind-cast whatever's on the branch. Per-key
    // forward compatibility (an unknown store key is ignored, see applyRemoteSnapshot) only
    // covers *additive* change; a real v2 could redefine an existing key's meaning, which an
    // old client must not silently apply.
    if (result.state.version !== 1) {
      reportSyncFailure(`hydration: version-mismatch (got ${JSON.stringify(result.state.version)})`, toast)
      return { status: 'error', reason: 'version-mismatch' }
    }
    const decisions = applyRemoteSnapshot(result.state)
    recordHydration()
    return { status: 'applied', decisions, sha: result.sha, storesKey: stableStoresKey(result.state.stores) }
  } catch (err) {
    // Should be unreachable — fetchState/applyRemoteSnapshot don't throw — but hydration
    // must never be the thing that breaks app boot, so belt-and-braces it anyway.
    const reason = err instanceof Error ? err.message : 'unknown'
    reportSyncFailure(`hydration: ${reason}`, toast)
    return { status: 'error', reason }
  }
}
