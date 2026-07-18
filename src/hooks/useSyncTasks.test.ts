import { beforeEach, describe, expect, it } from 'vitest'
import { addSyncTask, pruneSyncTasks, syncTasksStore } from './useSyncTasks'
import { applyTaskOutcome } from '../lib/syncTaskOutcomes'
import { shoppingListStore } from './useShoppingList'
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
  syncTasksStore.set({ tasks: [] })
})

describe('addSyncTask', () => {
  it('appends a task with a generated id and createdAt', () => {
    addSyncTask('resolve-manual-item', { vara: 'kaffe' })
    const tasks = syncTasksStore.get().tasks
    expect(tasks).toHaveLength(1)
    expect(tasks[0].type).toBe('resolve-manual-item')
    expect(tasks[0].payload).toEqual({ vara: 'kaffe' })
    expect(tasks[0].id).toBeTruthy()
    expect(tasks[0].createdAt).toBeTruthy()
  })

  it('appends multiple tasks without clobbering earlier ones', () => {
    addSyncTask('resolve-manual-item', { vara: 'kaffe' })
    addSyncTask('resolve-manual-item', { vara: 'mjölk' })
    expect(syncTasksStore.get().tasks).toHaveLength(2)
  })
})

describe('pruneSyncTasks', () => {
  it('removes only the tasks whose id is in the processed set', () => {
    addSyncTask('resolve-manual-item', { vara: 'kaffe' })
    addSyncTask('resolve-manual-item', { vara: 'mjölk' })
    const [first, second] = syncTasksStore.get().tasks

    pruneSyncTasks(new Set([first.id]))

    const remaining = syncTasksStore.get().tasks
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(second.id)
  })

  it('leaves an unrecognized/not-yet-processed task untouched', () => {
    addSyncTask('resolve-manual-item', { vara: 'kaffe' })
    pruneSyncTasks(new Set(['some-other-task-id']))
    expect(syncTasksStore.get().tasks).toHaveLength(1)
  })

  it('is a no-op (does not write) when nothing matches', () => {
    addSyncTask('resolve-manual-item', { vara: 'kaffe' })
    let calls = 0
    syncTasksStore.subscribe(() => { calls++ })
    pruneSyncTasks(new Set(['nonexistent']))
    expect(calls).toBe(0)
  })
})

describe('boot-time hydration with tasks present (App.tsx\'s task-log flow)', () => {
  it('applies a matching task-log outcome and prunes the task from the local queue', () => {
    shoppingListStore.set({
      removedIds: [],
      manualItems: [{ id: 'manual:1', vara: 'Kaffe', addedAt: '2026-01-01T00:00:00.000Z' }],
      storeAssignments: {},
    })
    addSyncTask('resolve-manual-item', { vara: 'Kaffe' })
    const [task] = syncTasksStore.get().tasks

    const taskLogEntries: TaskLogEntry[] = [
      {
        id: task.id,
        type: 'resolve-manual-item',
        processedAt: '2026-01-02T00:00:00.000Z',
        outcome: 'applied',
        result: { vara: 'Kaffe', offerRef: { store: 'willys', week: '2026-W29' } },
      },
    ]

    // Mirrors App.tsx's boot effect exactly: apply every entry's outcome, then prune by id.
    for (const entry of taskLogEntries) applyTaskOutcome(entry)
    pruneSyncTasks(new Set(taskLogEntries.map(e => e.id)))

    expect(shoppingListStore.get().manualItems[0].offerRef).toEqual({ store: 'willys', week: '2026-W29' })
    expect(syncTasksStore.get().tasks).toHaveLength(0)
  })

  it('a task-log entry for a type this client does not recognize still gets pruned locally', () => {
    addSyncTask('some-future-task-type', { whatever: true })
    const [task] = syncTasksStore.get().tasks

    const taskLogEntries: TaskLogEntry[] = [
      { id: task.id, type: 'some-future-task-type', processedAt: 't', outcome: 'applied', result: {} },
    ]
    for (const entry of taskLogEntries) applyTaskOutcome(entry) // no-op, unrecognized type
    pruneSyncTasks(new Set(taskLogEntries.map(e => e.id)))

    // Pruning is keyed on "does this id appear in the log", independent of whether this
    // client understood the type — the log entry itself is the source of truth that it
    // was processed by *some* (newer) client's skill run.
    expect(syncTasksStore.get().tasks).toHaveLength(0)
  })
})
