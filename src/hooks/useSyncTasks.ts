import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'

/**
 * The intelligence-queue store (Phase 5 of the auto-sync plan — see CLAUDE.md's
 * "GitHub-backed auto-sync" section). A task is a structured *intent*, never prompt text —
 * the app records "resolve this manual item against current offers," not a paragraph asking
 * an LLM to do so. Syncs like any other store (matracet:synctasks:v1 is in SYNCED_STORES),
 * so a task appended on one device is visible to an interactive Claude Code session working
 * from the device-sync branch regardless of which device it was queued on.
 */
export interface SyncTask {
  id: string
  type: string
  createdAt: string
  payload: unknown
}

export interface SyncTasksState {
  tasks: SyncTask[]
}

const EMPTY: SyncTasksState = { tasks: [] }

export const syncTasksStore = createLocalStore<SyncTasksState>('matracet:synctasks:v1', EMPTY)

function generateId(): string {
  return `task:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
}

/** Append a new task intent to the queue — see .claude/skills/run-sync-tasks/ for the
 * catalog of recognized `type`s and what each one's payload means. */
export function addSyncTask(type: string, payload: unknown): void {
  const state = syncTasksStore.get()
  const task: SyncTask = { id: generateId(), type, createdAt: new Date().toISOString(), payload }
  syncTasksStore.set({ tasks: [...state.tasks, task] })
}

/** Drop every local task whose id appears in `processedIds` (from public/data/task-log.json)
 * — the device's side of the acknowledgment channel. A no-op (and doesn't write, so it never
 * touches the sync ledger) when nothing needs pruning, so it's safe to call on every boot
 * regardless of whether the task log actually changed. A task whose id is absent survives
 * untouched, by construction — there is no other path that removes a task from the queue. */
export function pruneSyncTasks(processedIds: Set<string>): void {
  const state = syncTasksStore.get()
  if (state.tasks.length === 0) return
  const remaining = state.tasks.filter(t => !processedIds.has(t.id))
  if (remaining.length === state.tasks.length) return
  syncTasksStore.set({ tasks: remaining })
}

export function useSyncTasks(): SyncTask[] {
  return useSyncExternalStore(syncTasksStore.subscribe, syncTasksStore.getSnapshot, () => EMPTY).tasks
}
