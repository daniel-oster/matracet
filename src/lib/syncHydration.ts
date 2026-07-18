// Boot-time hydration from GitHub sync (Phase 2 of the auto-sync plan — see CLAUDE.md's
// "GitHub-backed auto-sync" section). Deliberately isolated from the app's existing static
// data fetch in App.tsx: this must never block or delay the `Laddar…` loading gate, which
// depends only on the static Promise.all — a hung or failing device-sync fetch must not
// become a second way for that gate to spin forever. Every path here resolves; nothing throws
// out of `hydrateFromSync`.

import { fetchState } from './githubSync'
import { applyRemoteSnapshot, type HydrationDecision } from './syncSnapshot'
import { recordHydration, reportSyncFailure } from './syncStatus'

export interface HydrationOutcome {
  status: 'skipped-no-token' | 'skipped-not-found' | 'applied' | 'error'
  decisions?: HydrationDecision[]
  reason?: string
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
      return { status: 'skipped-not-found' }
    }
    if (result.status !== 'ok' || !result.state) {
      reportSyncFailure(`hydration: ${result.status}`, toast)
      return { status: 'error', reason: result.status }
    }
    const decisions = applyRemoteSnapshot(result.state)
    recordHydration()
    return { status: 'applied', decisions }
  } catch (err) {
    // Should be unreachable — fetchState/applyRemoteSnapshot don't throw — but hydration
    // must never be the thing that breaks app boot, so belt-and-braces it anyway.
    const reason = err instanceof Error ? err.message : 'unknown'
    reportSyncFailure(`hydration: ${reason}`, toast)
    return { status: 'error', reason }
  }
}
