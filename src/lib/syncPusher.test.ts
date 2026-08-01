import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FetchStateResult, PushStateResult } from './githubSync'

const pushStateMock = vi.fn<(...args: unknown[]) => Promise<PushStateResult>>()
const fetchStateMock = vi.fn<(...args: unknown[]) => Promise<FetchStateResult>>()

vi.mock('./githubSync', async importOriginal => {
  const actual = await importOriginal<typeof import('./githubSync')>()
  return {
    ...actual,
    pushState: (...args: unknown[]) => pushStateMock(...args),
    fetchState: (...args: unknown[]) => fetchStateMock(...args),
  }
})

// Imported after the mock so syncPusher picks up the mocked pushState/fetchState.
const { startSyncPusher, pushNow, __resetForTests } = await import('./syncPusher')
const { mealPoolStore } = await import('../hooks/useMealPool')
const { irrelevantOffersStore } = await import('../hooks/useIrrelevantOffers')

class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
}

beforeEach(() => {
  ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage()
  __resetForTests()
  pushStateMock.mockReset()
  pushStateMock.mockResolvedValue({ status: 'ok', sha: 'sha-default' })
  // Default: nothing on the branch yet — lets pushNow's discovery step conclude "safe to
  // create fresh" without exercising the merge-onto-local-stores behavior, which has its own
  // dedicated test below. Individual tests override this when they care about discovery.
  fetchStateMock.mockReset()
  fetchStateMock.mockResolvedValue({ status: 'not-found', state: null, sha: null })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('syncPusher', () => {
  it('coalesces rapid consecutive store changes into exactly one push, 20s after the LAST change', async () => {
    const stop = startSyncPusher()
    try {
      mealPoolStore.set({ entries: [{ id: 'a', mealSlug: 'tacos', receptSlug: null, addedAt: 't1', slot: null }] })
      await vi.advanceTimersByTimeAsync(5_000)
      mealPoolStore.set({ entries: [] })
      await vi.advanceTimersByTimeAsync(5_000)
      mealPoolStore.set({ entries: [{ id: 'a', mealSlug: 'tacos', receptSlug: null, addedAt: 't1', slot: null }] }) // resets the debounce window again

      await vi.advanceTimersByTimeAsync(19_999)
      expect(pushStateMock).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(pushStateMock).toHaveBeenCalledTimes(1)
    } finally {
      stop()
    }
  })

  it('a pushNow() call landing while one is already in flight coalesces instead of overlapping', async () => {
    let resolveFirst!: (v: PushStateResult) => void
    pushStateMock.mockImplementationOnce(
      () => new Promise<PushStateResult>(resolve => { resolveFirst = resolve }),
    )
    pushStateMock.mockResolvedValueOnce({ status: 'ok', sha: 'sha-2' })

    const stop = startSyncPusher()
    try {
      mealPoolStore.set({ entries: [{ id: 'a', mealSlug: 'tacos', receptSlug: null, addedAt: 't1', slot: null }] })
      await vi.advanceTimersByTimeAsync(20_000) // fires the first push, which hangs
      expect(pushStateMock).toHaveBeenCalledTimes(1)

      // A genuine edit landing while the first push is still in flight — this is the case
      // guard #2 exists for: it must be captured by the coalesced retry, not lost. (Two bare
      // pushNow() calls with no edit between them would now correctly dedupe to one PUT —
      // see the "skips the PUT" test below — so this test needs a real content change to
      // actually exercise the coalescing path, not just the dedup path.)
      mealPoolStore.set({ entries: [] })
      const second = pushNow() // simulates e.g. visibilitychange firing concurrently
      await Promise.resolve() // let pushNow's synchronous "in flight, mark dirty" branch run
      expect(pushStateMock).toHaveBeenCalledTimes(1) // still just the one in-flight call

      resolveFirst({ status: 'ok', sha: 'sha-1' })
      await second

      // The coalesced call happened once the first finished — never two concurrent PUTs.
      expect(pushStateMock).toHaveBeenCalledTimes(2)
      // And it actually carried the new edit, not a stale/duplicate snapshot.
      const secondSnapshot = pushStateMock.mock.calls[1][0] as { stores: Record<string, { data: unknown }> }
      expect(secondSnapshot.stores['matracet:mealpool:v1'].data).toEqual({ entries: [] })
    } finally {
      stop()
    }
  })

  it('starting twice does not leave a duplicate subscription alive after the real stop()', async () => {
    const stop1 = startSyncPusher()
    const stop2 = startSyncPusher() // no-op — already started
    stop2() // must not tear down the real (stop1-owned) subscription
    stop1() // the real teardown

    mealPoolStore.set({ entries: [{ id: 'a', mealSlug: 'tacos', receptSlug: null, addedAt: 't1', slot: null }] })
    await vi.advanceTimersByTimeAsync(20_000)
    expect(pushStateMock).not.toHaveBeenCalled() // no lingering listener firing post-teardown
  })

  it('PR #83 fix: merges a newer remote value onto local before pushing, per store — never a wholesale overwrite', async () => {
    const remoteEntries = { entries: [{ id: 'remote', mealSlug: 'tacos', receptSlug: null, addedAt: 't1', slot: null }] }
    // Local: mealPool is stale (old touchedAt) — remote has a newer value and should win.
    mealPoolStore.setFromSync({ entries: [] }, '2020-01-01T00:00:00.000Z')
    // Local: irrelevantOffers was just genuinely edited on this device — newer than what the
    // (stale) remote snapshot claims, so it must survive the push untouched.
    irrelevantOffersStore.set({ names: ['local-fresh'] })

    fetchStateMock.mockResolvedValueOnce({
      status: 'ok',
      sha: 'remote-sha',
      state: {
        version: 1,
        deviceId: 'other-device',
        updatedAt: '2026-06-01T00:00:00.000Z',
        stores: {
          'matracet:mealpool:v1': { updatedAt: '2026-06-01T00:00:00.000Z', data: remoteEntries },
          'matracet:irrelevant-offers:v1': { updatedAt: '2000-01-01T00:00:00.000Z', data: { names: ['stale-remote'] } },
        },
      },
    })

    await pushNow()

    // Merged onto local stores: remote won for mealPool, local won for irrelevantOffers.
    expect(mealPoolStore.get()).toEqual(remoteEntries)
    expect(irrelevantOffersStore.get()).toEqual({ names: ['local-fresh'] })

    // And the snapshot actually pushed reflects that same merge — the max of each, not a
    // blind copy of either side.
    expect(pushStateMock).toHaveBeenCalledTimes(1)
    const pushedSnapshot = pushStateMock.mock.calls[0][0] as { stores: Record<string, { data: unknown }> }
    expect(pushedSnapshot.stores['matracet:mealpool:v1'].data).toEqual(remoteEntries)
    expect(pushedSnapshot.stores['matracet:irrelevant-offers:v1'].data).toEqual({ names: ['local-fresh'] })
  })

  it('PR #83 fix: skips the PUT entirely when the branch already matches local content exactly', async () => {
    // Build the "remote" fixture from whatever collectSnapshot() actually returns right now
    // (rather than hand-constructing every synced store's entry) — this is the same shape
    // boot hydration would see if this device's last push is still the latest on the branch,
    // e.g. right after a hydration that only reconfirmed data already held locally.
    const { collectSnapshot } = await import('./syncSnapshot')
    const currentSnapshot = collectSnapshot()

    fetchStateMock.mockResolvedValueOnce({ status: 'ok', sha: 'remote-sha', state: currentSnapshot })

    await pushNow()

    // The discovery fetch happened (that's how we know nothing changed)...
    expect(fetchStateMock).toHaveBeenCalledTimes(1)
    // ...but since local now matches it exactly, no PUT should follow.
    expect(pushStateMock).not.toHaveBeenCalled()
  })
})
