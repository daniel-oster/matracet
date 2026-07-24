import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'
import type { RecipeIndexEntry } from '../types'
import type { Meal } from '../types/meal'
import { resolveMealForRecipe } from '../lib/mealResolve'
import type {
  FeedbackSentiment,
  FeedbackStore,
  PersonRecipeFeedback,
  RecipeFeedbackRecord,
} from '../types/feedback'

const EMPTY: FeedbackStore = {}

const STORE_KEY = 'matracet:feedback:v2'
const LEGACY_KEY = 'matracet:feedback:v1'

export const feedbackStore = createLocalStore<FeedbackStore>(STORE_KEY, EMPTY)

function now(): string {
  return new Date().toISOString()
}

function ensureRecord(all: FeedbackStore, mealId: string): RecipeFeedbackRecord {
  return (
    all[mealId] ?? {
      mealId,
      persons: [],
      excludeFromWeekPlan: false,
      updatedAt: now(),
    }
  )
}

/** Drop a record once it carries no opinions and no exclude flag. */
function prune(all: FeedbackStore, mealId: string, record: RecipeFeedbackRecord): FeedbackStore {
  const next = { ...all }
  if (record.persons.length === 0 && !record.excludeFromWeekPlan) {
    delete next[mealId]
  } else {
    next[mealId] = record
  }
  return next
}

function setPersonSentiment(
  mealId: string,
  personId: string,
  sentiment: FeedbackSentiment | null,
  note?: string,
): void {
  const all = feedbackStore.get()
  const existing = ensureRecord(all, mealId)
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
  feedbackStore.set(prune(all, mealId, record))
}

function setExcludeFromWeekPlan(mealId: string, excluded: boolean): void {
  const all = feedbackStore.get()
  const existing = ensureRecord(all, mealId)
  const record: RecipeFeedbackRecord = {
    ...existing,
    excludeFromWeekPlan: excluded,
    updatedAt: now(),
  }
  feedbackStore.set(prune(all, mealId, record))
}

function clearFeedback(mealId: string): void {
  const all = feedbackStore.get()
  if (!all[mealId]) return
  const next = { ...all }
  delete next[mealId]
  feedbackStore.set(next)
}

/**
 * Seed any (meal, person) rating present in the git-tracked backend snapshot
 * but missing locally — e.g. a rating entered on another device and synced via
 * the sync-local-storage skill. Local edits always win: an existing local entry
 * for that meal+person is never overwritten. Safe to call on every app load.
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
  for (const [mealId, record] of Object.entries(baseline)) {
    const local = next[mealId]
    const localPersonIds = new Set((local?.persons ?? []).map(p => p.personId))
    const missing = record.persons.filter(p => !localPersonIds.has(p.personId))
    if (missing.length === 0) continue
    changed = true
    next[mealId] = {
      mealId,
      excludeFromWeekPlan: local?.excludeFromWeekPlan ?? record.excludeFromWeekPlan,
      updatedAt: now(),
      persons: [...(local?.persons ?? []), ...missing],
    }
  }
  if (changed) feedbackStore.setSilently(next)
}

interface LegacyFeedbackRecord {
  recipeId: string
  persons: PersonRecipeFeedback[]
  excludeFromWeekPlan: boolean
  updatedAt: string
}

/**
 * One-time re-key of this device's pre-Stage-5 local ratings (`matracet:feedback:v1`,
 * keyed by recipe slug) into the new meal-keyed store. Run once, after meals.json and
 * the recipe index have both loaded (see App.tsx) — needs both to resolve each old
 * recipe slug to the meal it belongs to via resolveMealForRecipe. No-ops if v2 already
 * has any data (already migrated) or there's no v1 data to read. Uses `setSilently` for
 * the same reason migrateWeekPlanV2 does: adopting old local data is neither a fresh
 * edit nor a sync hydration.
 */
export function migrateFeedbackV1(meals: Meal[], recipeIndex: RecipeIndexEntry[]): void {
  if (Object.keys(feedbackStore.get()).length > 0) return
  let raw: string | null = null
  try {
    raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_KEY) : null
  } catch {
    return
  }
  if (!raw) return
  let legacy: Record<string, LegacyFeedbackRecord>
  try {
    legacy = JSON.parse(raw)
  } catch {
    return
  }
  if (Object.keys(legacy).length === 0) return

  const next: FeedbackStore = {}
  for (const [recipeSlug, record] of Object.entries(legacy)) {
    const recipeNamn = recipeIndex.find(r => r.slug === recipeSlug)?.namn ?? recipeSlug
    const meal = resolveMealForRecipe(recipeSlug, recipeNamn, meals)
    const existing = next[meal.slug]
    if (!existing) {
      next[meal.slug] = {
        mealId: meal.slug,
        persons: record.persons,
        excludeFromWeekPlan: record.excludeFromWeekPlan,
        updatedAt: record.updatedAt,
      }
      continue
    }
    // Two old recipe-keyed records resolved to the same meal — only possible when a real
    // meals.json entry links more than one recipe. Merge persons, newer updatedAt per
    // person wins, matching mergeFeedbackBaseline's own newer-wins convention.
    const personMap = new Map(existing.persons.map(p => [p.personId, p]))
    for (const p of record.persons) {
      const current = personMap.get(p.personId)
      if (!current || p.updatedAt > current.updatedAt) personMap.set(p.personId, p)
    }
    next[meal.slug] = {
      mealId: meal.slug,
      persons: [...personMap.values()],
      excludeFromWeekPlan: existing.excludeFromWeekPlan || record.excludeFromWeekPlan,
      updatedAt: record.updatedAt > existing.updatedAt ? record.updatedAt : existing.updatedAt,
    }
  }
  feedbackStore.setSilently(next)
}

export interface UseFeedback {
  data: FeedbackStore
  getFeedback: (mealId: string) => RecipeFeedbackRecord | null
  setPersonSentiment: (
    mealId: string,
    personId: string,
    sentiment: FeedbackSentiment | null,
    note?: string,
  ) => void
  setExcludeFromWeekPlan: (mealId: string, excluded: boolean) => void
  clearFeedback: (mealId: string) => void
}

export function useFeedback(): UseFeedback {
  const data = useSyncExternalStore(
    feedbackStore.subscribe,
    feedbackStore.getSnapshot,
    () => EMPTY,
  )
  return {
    data,
    getFeedback: (mealId: string) => data[mealId] ?? null,
    setPersonSentiment,
    setExcludeFromWeekPlan,
    clearFeedback,
  }
}
