import { beforeEach, describe, expect, it } from 'vitest'
import { applyRemoteSnapshot, collectSnapshot } from './syncSnapshot'
import type { SyncableStore } from './syncStores'
import type { SyncState } from './githubSync'

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
})

function makeFakeStore(key: string, data: unknown, touchedAt: string | null): SyncableStore {
  let current = data
  let touched = touchedAt
  return {
    key,
    getSnapshot: () => current,
    touchedAt: () => touched,
    setFromSync: (next, at) => {
      current = next
      touched = at
    },
  }
}

function makeRemote(stores: SyncState['stores']): SyncState {
  return { version: 1, deviceId: 'remote-device', updatedAt: '2026-07-18T12:00:00.000Z', stores }
}

describe('collectSnapshot', () => {
  it('collects each store\'s current value and touchedAt', () => {
    const a = makeFakeStore('store-a', { x: 1 }, '2026-01-01T00:00:00.000Z')
    const b = makeFakeStore('store-b', { y: 2 }, '2026-02-01T00:00:00.000Z')
    const snapshot = collectSnapshot([a, b])
    expect(snapshot.stores['store-a']).toEqual({ updatedAt: '2026-01-01T00:00:00.000Z', data: { x: 1 } })
    expect(snapshot.stores['store-b']).toEqual({ updatedAt: '2026-02-01T00:00:00.000Z', data: { y: 2 } })
    expect(snapshot.updatedAt).toBe('2026-02-01T00:00:00.000Z') // max of the two
    expect(snapshot.version).toBe(1)
  })

  it('a never-touched store reports the epoch, not null, so it never beats a real timestamp', () => {
    const a = makeFakeStore('store-a', {}, null)
    const snapshot = collectSnapshot([a])
    expect(snapshot.stores['store-a'].updatedAt).toBe(new Date(0).toISOString())
  })
})

describe('applyRemoteSnapshot', () => {
  it('adopts the remote value when it is newer than the local touchedAt', () => {
    const local = makeFakeStore('store-a', { local: true }, '2026-01-01T00:00:00.000Z')
    const remote = makeRemote({
      'store-a': { updatedAt: '2026-06-01T00:00:00.000Z', data: { remote: true } },
    })
    const decisions = applyRemoteSnapshot(remote, [local])
    expect(decisions).toEqual([{ key: 'store-a', action: 'adopted' }])
    expect(local.getSnapshot()).toEqual({ remote: true })
    expect(local.touchedAt()).toBe('2026-06-01T00:00:00.000Z')
  })

  it('keeps the local value when it is newer than the remote', () => {
    const local = makeFakeStore('store-a', { local: true }, '2026-06-01T00:00:00.000Z')
    const remote = makeRemote({
      'store-a': { updatedAt: '2026-01-01T00:00:00.000Z', data: { remote: true } },
    })
    const decisions = applyRemoteSnapshot(remote, [local])
    expect(decisions).toEqual([{ key: 'store-a', action: 'kept-local' }])
    expect(local.getSnapshot()).toEqual({ local: true }) // unchanged
  })

  it('adopts the remote value when the local store has never been touched', () => {
    const local = makeFakeStore('store-a', {}, null)
    const remote = makeRemote({
      'store-a': { updatedAt: '2026-01-01T00:00:00.000Z', data: { remote: true } },
    })
    const decisions = applyRemoteSnapshot(remote, [local])
    expect(decisions).toEqual([{ key: 'store-a', action: 'adopted' }])
  })

  it('ignores an unknown remote store key instead of crashing (forward compatibility)', () => {
    const local = makeFakeStore('store-a', { local: true }, '2026-01-01T00:00:00.000Z')
    const remote = makeRemote({
      'store-a': { updatedAt: '2020-01-01T00:00:00.000Z', data: {} },
      'store-from-a-newer-client': { updatedAt: '2026-06-01T00:00:00.000Z', data: { whatever: true } },
    })
    expect(() => applyRemoteSnapshot(remote, [local])).not.toThrow()
    const decisions = applyRemoteSnapshot(remote, [local])
    expect(decisions).toContainEqual({ key: 'store-from-a-newer-client', action: 'ignored-unknown-key' })
  })
})
