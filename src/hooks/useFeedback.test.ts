import { beforeEach, describe, expect, it } from 'vitest'
import { feedbackStore, mergeFeedbackBaseline, migrateFeedbackV1 } from './useFeedback'
import type { FeedbackStore } from '../types/feedback'
import type { Meal } from '../types/meal'
import type { RecipeIndexEntry } from '../types'

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
  feedbackStore.set({})
})

const baseline: FeedbackStore = {
  lax: {
    mealId: 'lax',
    excludeFromWeekPlan: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
    persons: [{ personId: 'anna', sentiment: 'likes', updatedAt: '2026-01-01T00:00:00.000Z' }],
  },
}

describe('mergeFeedbackBaseline', () => {
  it('gap-fills a missing (recipe, person) rating', () => {
    mergeFeedbackBaseline(baseline)
    expect(feedbackStore.get().lax?.persons).toHaveLength(1)
    expect(feedbackStore.get().lax?.persons[0].personId).toBe('anna')
  })

  it('never overwrites an existing local rating for the same (recipe, person)', () => {
    feedbackStore.set({
      lax: {
        mealId: 'lax',
        excludeFromWeekPlan: false,
        updatedAt: '2026-02-01T00:00:00.000Z',
        persons: [{ personId: 'anna', sentiment: 'refuses', updatedAt: '2026-02-01T00:00:00.000Z' }],
      },
    })
    mergeFeedbackBaseline(baseline)
    expect(feedbackStore.get().lax?.persons[0].sentiment).toBe('refuses') // local edit wins
  })

  it(
    'does NOT advance the sync ledger (touchedAt) — the critique-gate proof for App.tsx\'s ' +
      'boot ordering: a baseline gap-fill must never look like a fresh local edit, or a later ' +
      'GitHub-sync hydration would wrongly think this store was "just touched" and skip ' +
      'adopting a genuinely newer remote snapshot',
    () => {
      const before = feedbackStore.touchedAt() // set in beforeEach — a real edit, so non-null
      expect(before).not.toBeNull()
      mergeFeedbackBaseline(baseline) // gap-fills into the empty store — a real content change
      expect(feedbackStore.get().lax).toBeDefined() // sanity: the merge actually wrote something
      expect(feedbackStore.touchedAt()).toBe(before) // ...yet the ledger didn't move
    },
  )
})

const RECIPE_INDEX: RecipeIndexEntry[] = [
  { slug: 'lax', nummer: 1, namn: 'Ugnsbakad lax', tid_min: 20, kategorier: [] },
  { slug: 'tacos-kottfars', nummer: 2, namn: 'Tacos med köttfärs', tid_min: 25, kategorier: [] },
  { slug: 'vegotacos', nummer: 3, namn: 'Vegotacos', tid_min: 20, kategorier: [] },
]

const TACOS_MEAL: Meal = {
  slug: 'tacos',
  namn: 'Tacos',
  alias: [],
  komponenter: [],
  receptSlug: 'tacos-kottfars',
  taggar: [],
}

function setLegacyV1(value: unknown) {
  localStorage.setItem('matracet:feedback:v1', JSON.stringify(value))
}

describe('migrateFeedbackV1', () => {
  it('re-keys a recipe-slug record to its own virtual meal slug when no meals.json entry matches', () => {
    setLegacyV1({
      lax: {
        recipeId: 'lax',
        excludeFromWeekPlan: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
        persons: [{ personId: 'anna', sentiment: 'likes', updatedAt: '2026-01-01T00:00:00.000Z' }],
      },
    })
    migrateFeedbackV1([], RECIPE_INDEX)
    const record = feedbackStore.get().lax
    expect(record?.mealId).toBe('lax')
    expect(record?.persons).toHaveLength(1)
  })

  it('merges two legacy recipe records that resolve to the same real meal, newer person wins', () => {
    setLegacyV1({
      'tacos-kottfars': {
        recipeId: 'tacos-kottfars',
        excludeFromWeekPlan: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
        persons: [{ personId: 'anna', sentiment: 'likes', updatedAt: '2026-01-01T00:00:00.000Z' }],
      },
    })
    migrateFeedbackV1([TACOS_MEAL], RECIPE_INDEX)
    const record = feedbackStore.get().tacos
    expect(record?.mealId).toBe('tacos')
    expect(record?.persons[0].personId).toBe('anna')
  })

  it('does nothing when v2 already has data (already migrated)', () => {
    feedbackStore.set({ tacos: { mealId: 'tacos', excludeFromWeekPlan: false, updatedAt: '2026-01-01T00:00:00.000Z', persons: [] } })
    setLegacyV1({ lax: { recipeId: 'lax', excludeFromWeekPlan: false, updatedAt: '2026-01-01T00:00:00.000Z', persons: [] } })
    migrateFeedbackV1([], RECIPE_INDEX)
    expect(feedbackStore.get().lax).toBeUndefined()
  })

  it('does nothing when there is no legacy v1 data at all', () => {
    migrateFeedbackV1([], RECIPE_INDEX)
    expect(feedbackStore.get()).toEqual({})
  })
})
