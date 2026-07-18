import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'
import type {
  FeedbackSentiment,
  FeedbackStore,
  PersonRecipeFeedback,
  RecipeFeedbackRecord,
} from '../types/feedback'

const EMPTY: FeedbackStore = {}

export const feedbackStore = createLocalStore<FeedbackStore>('matracet:feedback:v1', EMPTY)

function now(): string {
  return new Date().toISOString()
}

function ensureRecord(all: FeedbackStore, recipeId: string): RecipeFeedbackRecord {
  return (
    all[recipeId] ?? {
      recipeId,
      persons: [],
      excludeFromWeekPlan: false,
      updatedAt: now(),
    }
  )
}

/** Drop a record once it carries no opinions and no exclude flag. */
function prune(all: FeedbackStore, recipeId: string, record: RecipeFeedbackRecord): FeedbackStore {
  const next = { ...all }
  if (record.persons.length === 0 && !record.excludeFromWeekPlan) {
    delete next[recipeId]
  } else {
    next[recipeId] = record
  }
  return next
}

function setPersonSentiment(
  recipeId: string,
  personId: string,
  sentiment: FeedbackSentiment | null,
  note?: string,
): void {
  const all = feedbackStore.get()
  const existing = ensureRecord(all, recipeId)
  const persons = existing.persons.filter(p => p.personId !== personId)
  if (sentiment !== null) {
    const trimmed = note?.trim()
    const entry: PersonRecipeFeedback = {
      personId,
      sentiment,
      updatedAt: now(),
      ...(trimmed ? { note: trimmed } : {}),
    }
    persons.push(entry)
  }
  const record: RecipeFeedbackRecord = { ...existing, persons, updatedAt: now() }
  feedbackStore.set(prune(all, recipeId, record))
}

function setExcludeFromWeekPlan(recipeId: string, excluded: boolean): void {
  const all = feedbackStore.get()
  const existing = ensureRecord(all, recipeId)
  const record: RecipeFeedbackRecord = {
    ...existing,
    excludeFromWeekPlan: excluded,
    updatedAt: now(),
  }
  feedbackStore.set(prune(all, recipeId, record))
}

function clearFeedback(recipeId: string): void {
  const all = feedbackStore.get()
  if (!all[recipeId]) return
  const next = { ...all }
  delete next[recipeId]
  feedbackStore.set(next)
}

/**
 * Seed any (recipe, person) rating present in the git-tracked backend snapshot
 * but missing locally — e.g. a rating entered on another device and synced via
 * the sync-local-storage skill. Local edits always win: an existing local entry
 * for that recipe+person is never overwritten. Safe to call on every app load.
 *
 * Uses `setSilently`, not `set`: this is a gap-fill from the (comparatively stale)
 * git-tracked baseline, not a genuine local edit or a GitHub-sync hydration — it must
 * not advance feedbackStore's sync ledger, or a later device-sync hydration (see
 * CLAUDE.md's "GitHub-backed auto-sync" section) would wrongly see this store as
 * "just touched" and skip adopting a genuinely newer remote snapshot. Keeping this
 * write silent makes the boot-time ordering between this call and sync hydration
 * irrelevant to correctness — whichever runs first, the other's newer-wins decision
 * is unaffected.
 */
export function mergeFeedbackBaseline(baseline: FeedbackStore): void {
  const all = feedbackStore.get()
  let changed = false
  const next: FeedbackStore = { ...all }
  for (const [recipeId, record] of Object.entries(baseline)) {
    const local = next[recipeId]
    const localPersonIds = new Set((local?.persons ?? []).map(p => p.personId))
    const missing = record.persons.filter(p => !localPersonIds.has(p.personId))
    if (missing.length === 0) continue
    changed = true
    next[recipeId] = {
      recipeId,
      excludeFromWeekPlan: local?.excludeFromWeekPlan ?? record.excludeFromWeekPlan,
      updatedAt: now(),
      persons: [...(local?.persons ?? []), ...missing],
    }
  }
  if (changed) feedbackStore.setSilently(next)
}

export interface UseFeedback {
  data: FeedbackStore
  getFeedback: (recipeId: string) => RecipeFeedbackRecord | null
  setPersonSentiment: (
    recipeId: string,
    personId: string,
    sentiment: FeedbackSentiment | null,
    note?: string,
  ) => void
  setExcludeFromWeekPlan: (recipeId: string, excluded: boolean) => void
  clearFeedback: (recipeId: string) => void
}

export function useFeedback(): UseFeedback {
  const data = useSyncExternalStore(
    feedbackStore.subscribe,
    feedbackStore.getSnapshot,
    () => EMPTY,
  )
  return {
    data,
    getFeedback: (recipeId: string) => data[recipeId] ?? null,
    setPersonSentiment,
    setExcludeFromWeekPlan,
    clearFeedback,
  }
}
