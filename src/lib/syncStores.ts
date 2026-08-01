// Registry of which localStorage stores participate in device→GitHub sync (Phase 2 of the
// auto-sync plan — see CLAUDE.md's "GitHub-backed auto-sync" section). Deciding per store,
// not "sync everything matracet:*": exportData.ts's generic sweep is a different, broader
// concern (a one-off manual export for pasting into a chat), not what should auto-push to a
// git branch on every edit.
//
// IN — real household data another device/person would want to see:
//   feedback, irrelevant-offers, weekplan, category-feedback, stash, shopping list, meal pool
//   (matracet:mealpool:v1 — the 2026-08 Planera redesign's flat "meals this week need" list,
//   see useMealPool.ts; replaces chaos mode, which this redesign deleted), sync tasks
//   (matracet:synctasks:v1 — a task queued on one device must be visible to an interactive
//   Claude Code session working from device-sync regardless of which device queued it; see
//   CLAUDE.md's Phase 5), local meal overlay (matracet:meals:local:v1 — a meal added/edited
//   from the Planera "add meal" flow, since there's no backend to write straight into
//   public/data/meals.json).
// OUT (documented, not just omitted):
//   matracet:fynd-collapsed:v1 (useCollapsedCategories) and matracet:planner-collapsed:v1
//   (usePlannerCollapse) — purely cosmetic per-device UI state (which sections are collapsed
//   on this screen), no value in syncing across devices.

import type { LocalStore } from './localStore'
import { feedbackStore } from '../hooks/useFeedback'
import { irrelevantOffersStore } from '../hooks/useIrrelevantOffers'
import { weekPlanStore } from '../hooks/useWeekPlan'
import { categoryFeedbackStore } from '../hooks/useCategoryFeedback'
import { stashStore } from '../hooks/useStash'
import { shoppingListStore } from '../hooks/useShoppingList'
import { mealPoolStore } from '../hooks/useMealPool'
import { syncTasksStore } from '../hooks/useSyncTasks'
import { localMealsStore } from '../hooks/useLocalMeals'

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
  subscribe: (listener: () => void) => () => void
}

function asSyncable<T>(store: LocalStore<T>): SyncableStore {
  return {
    key: store.key,
    getSnapshot: () => store.getSnapshot(),
    touchedAt: () => store.touchedAt(),
    setFromSync: (next, touchedAt) => store.setFromSync(next as T, touchedAt),
    subscribe: listener => store.subscribe(listener),
  }
}

export const SYNCED_STORES: SyncableStore[] = [
  asSyncable(feedbackStore),
  asSyncable(irrelevantOffersStore),
  asSyncable(weekPlanStore),
  asSyncable(categoryFeedbackStore),
  asSyncable(stashStore),
  asSyncable(shoppingListStore),
  asSyncable(mealPoolStore),
  asSyncable(syncTasksStore),
  asSyncable(localMealsStore),
]
