import { beforeEach, describe, expect, it } from 'vitest'
import { feedbackStore, mergeFeedbackBaseline } from './useFeedback'
import type { FeedbackStore } from '../types/feedback'

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
    recipeId: 'lax',
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
        recipeId: 'lax',
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
