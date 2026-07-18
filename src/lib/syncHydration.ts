// Boot-time hydration from GitHub sync (Phase 2 of the auto-sync plan — see CLAUDE.md's
// "GitHub-backed auto-sync" section). Deliberately isolated from the app's existing static
// data fetch in App.tsx: this must never block or delay the `Laddar…` loading gate, which
// depends only on the static Promise.all — a hung or failing device-sync fetch must not
// become a second way for that gate to spin forever. Every path here resolves; nothing throws
// out of `hydrateFromSync`.

import { fetchState } from './githubSync'
import { applyRemoteSnapshot, type HydrationDecision } from './syncSnapshot'

export interface HydrationOutcome {
  status: 'skipped-no-token' | 'skipped-not-found' | 'applied' | 'error'
  decisions?: HydrationDecision[]
  reason?: string
}

export async function hydrateFromSync(): Promise<HydrationOutcome> {
  try {
    const result = await fetchState()
    if (result.status === 'no-token') return { status: 'skipped-no-token' }
    if (result.status === 'not-found') return { status: 'skipped-not-found' }
    if (result.status !== 'ok' || !result.state) {
      return { status: 'error', reason: result.status }
    }
    const decisions = applyRemoteSnapshot(result.state)
    return { status: 'applied', decisions }
  } catch (err) {
    // Should be unreachable — fetchState/applyRemoteSnapshot don't throw — but hydration
    // must never be the thing that breaks app boot, so belt-and-braces it anyway.
    return { status: 'error', reason: err instanceof Error ? err.message : 'unknown' }
  }
}
