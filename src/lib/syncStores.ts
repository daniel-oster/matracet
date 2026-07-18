// Registry of which localStorage stores participate in device→GitHub sync (Phase 2 of the
// auto-sync plan — see CLAUDE.md's "GitHub-backed auto-sync" section). Deciding per store,
// not "sync everything matracet:*": exportData.ts's generic sweep is a different, broader
// concern (a one-off manual export for pasting into a chat), not what should auto-push to a
// git branch on every edit.
//
// IN — real household data another device/person would want to see:
//   feedback, irrelevant-offers, weekplan, category-feedback, stash, shopping list, chaos mode.
// OUT (documented, not just omitted):
//   matracet:fynd-collapsed:v1 (useCollapsedCategories) — purely cosmetic per-device UI state
//   (which Fynd categories are collapsed on this screen), no value in syncing across devices.

import type { LocalStore } from './localStore'
import { feedbackStore } from '../hooks/useFeedback'
import { irrelevantOffersStore } from '../hooks/useIrrelevantOffers'
import { weekPlanStore } from '../hooks/useWeekPlan'
import { categoryFeedbackStore } from '../hooks/useCategoryFeedback'
import { stashStore } from '../hooks/useStash'
import { shoppingListStore } from '../hooks/useShoppingList'
import { chaosModeStore } from '../hooks/useChaosMode'

/** The subset of LocalStore's API the sync engine needs, with `T` erased to `unknown` so a
 * heterogeneous list of differently-typed stores can be held in one array. `set`/`setFromSync`
 * are contravariant in `T`, so `LocalStore<X>` isn't structurally assignable to
 * `LocalStore<unknown>` — this narrower interface plus the `asSyncable` adapter below is the
 * standard way around that, with the one unavoidable cast confined to the adapter itself. */
export interface SyncableStore {
  readonly key: string
  getSnapshot: () => unknown
  touchedAt: () => string | null
  setFromSync: (next: unknown, touchedAt: string) => void
}

function asSyncable<T>(store: LocalStore<T>): SyncableStore {
  return {
    key: store.key,
    getSnapshot: () => store.getSnapshot(),
    touchedAt: () => store.touchedAt(),
    setFromSync: (next, touchedAt) => store.setFromSync(next as T, touchedAt),
  }
}

export const SYNCED_STORES: SyncableStore[] = [
  asSyncable(feedbackStore),
  asSyncable(irrelevantOffersStore),
  asSyncable(weekPlanStore),
  asSyncable(categoryFeedbackStore),
  asSyncable(stashStore),
  asSyncable(shoppingListStore),
  asSyncable(chaosModeStore),
]
