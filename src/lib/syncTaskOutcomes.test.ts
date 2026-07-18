import { beforeEach, describe, expect, it } from 'vitest'
import { applyTaskOutcome } from './syncTaskOutcomes'
import { shoppingListStore } from '../hooks/useShoppingList'
import type { TaskLogEntry } from '../types/taskLog'

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
  shoppingListStore.set({
    removedIds: [],
    manualItems: [{ id: 'manual:1', vara: 'Kaffe', addedAt: '2026-01-01T00:00:00.000Z' }],
    storeAssignments: {},
  })
})

function resolveEntry(overrides?: Partial<TaskLogEntry>): TaskLogEntry {
  return {
    id: 'task:1',
    type: 'resolve-manual-item',
    processedAt: '2026-01-02T00:00:00.000Z',
    outcome: 'applied',
    result: { vara: 'Kaffe', offerRef: { store: 'willys', week: '2026-W29' } },
    ...overrides,
  }
}

describe('applyTaskOutcome — resolve-manual-item', () => {
  it('attaches the offerRef to the matching unresolved item, case-insensitively', () => {
    applyTaskOutcome(resolveEntry())
    const item = shoppingListStore.get().manualItems.find(m => m.id === 'manual:1')
    expect(item?.offerRef).toEqual({ store: 'willys', week: '2026-W29' })
  })

  it('does not overwrite an item that already has an offerRef', () => {
    shoppingListStore.set({
      removedIds: [],
      manualItems: [{ id: 'manual:1', vara: 'Kaffe', addedAt: 't', offerRef: { store: 'ica', week: '2026-W20' } }],
      storeAssignments: {},
    })
    applyTaskOutcome(resolveEntry())
    const item = shoppingListStore.get().manualItems.find(m => m.id === 'manual:1')
    expect(item?.offerRef).toEqual({ store: 'ica', week: '2026-W20' }) // unchanged
  })

  it('is a no-op when no item matches the name', () => {
    applyTaskOutcome(resolveEntry({ result: { vara: 'Nudlar', offerRef: { store: 'willys', week: '2026-W29' } } }))
    const item = shoppingListStore.get().manualItems.find(m => m.id === 'manual:1')
    expect(item?.offerRef).toBeUndefined()
  })

  it('is a no-op for a non-"applied" outcome', () => {
    applyTaskOutcome(resolveEntry({ outcome: 'not-found', result: undefined }))
    const item = shoppingListStore.get().manualItems.find(m => m.id === 'manual:1')
    expect(item?.offerRef).toBeUndefined()
  })

  it('ignores an unrecognized task type entirely', () => {
    expect(() => applyTaskOutcome(resolveEntry({ type: 'some-future-task-type' }))).not.toThrow()
    const item = shoppingListStore.get().manualItems.find(m => m.id === 'manual:1')
    expect(item?.offerRef).toBeUndefined()
  })

  it('does NOT advance the sync ledger (touchedAt) — task-log.json is a static file every ' +
    'device fetches directly, so this must not look like a fresh edit for the same reason ' +
    'mergeFeedbackBaseline does not (see CLAUDE.md)', () => {
    const before = shoppingListStore.touchedAt()
    expect(before).not.toBeNull() // the beforeEach's .set() already touched it
    applyTaskOutcome(resolveEntry())
    expect(shoppingListStore.touchedAt()).toBe(before)
  })
})
