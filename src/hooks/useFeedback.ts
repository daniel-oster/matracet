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
