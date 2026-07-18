import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalStore } from './localStore'

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

describe('createLocalStore', () => {
  it('persists and reads back a value unwrapped (no touchedAt envelope on the stored value)', () => {
    const store = createLocalStore('matracet:test:v1', { count: 0 })
    store.set({ count: 5 })
    expect(store.get()).toEqual({ count: 5 })
    expect(localStorage.getItem('matracet:test:v1')).toBe(JSON.stringify({ count: 5 }))
  })

  it('touchedAt is null until the first set/setFromSync', () => {
    const store = createLocalStore('matracet:test:v2', 0)
    expect(store.touchedAt()).toBeNull()
  })

  it('set() advances touchedAt to roughly now', () => {
    const store = createLocalStore('matracet:test:v3', 0)
    const before = new Date().toISOString()
    store.set(1)
    const after = new Date().toISOString()
    const touched = store.touchedAt()
    expect(touched).not.toBeNull()
    expect(touched! >= before && touched! <= after).toBe(true)
  })

  it('setFromSync stamps touchedAt with the given timestamp, not now', () => {
    const store = createLocalStore('matracet:test:v4', 0)
    store.setFromSync(42, '2020-01-01T00:00:00.000Z')
    expect(store.get()).toBe(42)
    expect(store.touchedAt()).toBe('2020-01-01T00:00:00.000Z')
  })

  it('setSilently persists the value but never touches the ledger', () => {
    const store = createLocalStore('matracet:test:v5', 0)
    expect(store.touchedAt()).toBeNull()
    store.setSilently(7)
    expect(store.get()).toBe(7)
    expect(store.touchedAt()).toBeNull()

    store.set(8) // now genuinely touched
    const touchedAfterRealEdit = store.touchedAt()
    store.setSilently(9)
    expect(store.get()).toBe(9)
    expect(store.touchedAt()).toBe(touchedAfterRealEdit) // unchanged by the silent write
  })

  it('notifies subscribers on set, setFromSync, and setSilently alike', () => {
    const store = createLocalStore('matracet:test:v6', 0)
    let calls = 0
    store.subscribe(() => { calls++ })
    store.set(1)
    store.setFromSync(2, '2020-01-01T00:00:00.000Z')
    store.setSilently(3)
    expect(calls).toBe(3)
  })

  it('keeps separate stores\' touchedAt ledgers independent', () => {
    const a = createLocalStore('matracet:test:a', 0)
    const b = createLocalStore('matracet:test:b', 0)
    a.set(1)
    expect(a.touchedAt()).not.toBeNull()
    expect(b.touchedAt()).toBeNull()
  })
})
