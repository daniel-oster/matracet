import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PushStateResult } from './githubSync'

const pushStateMock = vi.fn<(...args: unknown[]) => Promise<PushStateResult>>()

vi.mock('./githubSync', async importOriginal => {
  const actual = await importOriginal<typeof import('./githubSync')>()
  return { ...actual, pushState: (...args: unknown[]) => pushStateMock(...args) }
})

// Imported after the mock so syncPusher picks up the mocked pushState.
const { startSyncPusher, pushNow } = await import('./syncPusher')
const { chaosModeStore } = await import('../hooks/useChaosMode')

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
  pushStateMock.mockReset()
  pushStateMock.mockResolvedValue({ status: 'ok', sha: 'sha-default' })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('syncPusher', () => {
  it('coalesces rapid consecutive store changes into exactly one push, 20s after the LAST change', async () => {
    const stop = startSyncPusher()
    try {
      chaosModeStore.set(true)
      await vi.advanceTimersByTimeAsync(5_000)
      chaosModeStore.set(false)
      await vi.advanceTimersByTimeAsync(5_000)
      chaosModeStore.set(true) // resets the debounce window again

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
      chaosModeStore.set(true)
      await vi.advanceTimersByTimeAsync(20_000) // fires the first push, which hangs
      expect(pushStateMock).toHaveBeenCalledTimes(1)

      // Simulates e.g. visibilitychange firing while the first push is still in flight —
      // must not start a second, concurrent PUT.
      const second = pushNow()
      await Promise.resolve() // let pushNow's synchronous "in flight, mark dirty" branch run
      expect(pushStateMock).toHaveBeenCalledTimes(1) // still just the one in-flight call

      resolveFirst({ status: 'ok', sha: 'sha-1' })
      await second

      // The coalesced call happened once the first finished — never two concurrent PUTs.
      expect(pushStateMock).toHaveBeenCalledTimes(2)
    } finally {
      stop()
    }
  })

  it('starting twice does not leave a duplicate subscription alive after the real stop()', async () => {
    const stop1 = startSyncPusher()
    const stop2 = startSyncPusher() // no-op — already started
    stop2() // must not tear down the real (stop1-owned) subscription
    stop1() // the real teardown

    chaosModeStore.set(true)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(pushStateMock).not.toHaveBeenCalled() // no lingering listener firing post-teardown
  })
})
