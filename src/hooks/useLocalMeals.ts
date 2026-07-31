import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'
import type { Meal } from '../types/meal'

/**
 * Locally created/edited meals — there's no backend, so "add a meal"/"edit a meal" from
 * the app can't write straight into the git-tracked public/data/meals.json. Instead this
 * store holds an overlay, keyed by slug: an entry whose slug matches a git meal fully
 * replaces it (an edit); any other slug is a brand-new, locally-created meal (see
 * mealResolve.ts's uniqueMealSlug). mergeLocalMeals() below applies the overlay at read
 * time. Registered in syncStores.ts so a meal added/edited on one device is visible on
 * every device via the existing device→GitHub sync, same as feedback/weekplan/stash.
 */
export interface LocalMealsState {
  meals: Record<string, Meal>
}

const EMPTY: LocalMealsState = { meals: {} }

export const localMealsStore = createLocalStore<LocalMealsState>('matracet:meals:local:v1', EMPTY)

function upsert(meal: Meal): void {
  const state = localMealsStore.get()
  localMealsStore.set({ meals: { ...state.meals, [meal.slug]: meal } })
}

/** Overlays local creations/edits onto the git-tracked meal list — a local entry with the
 *  same slug as a git meal fully replaces it, any other local slug is a new meal appended
 *  at the end (git meals keep their existing display order). */
export function mergeLocalMeals(gitMeals: Meal[], local: Record<string, Meal>): Meal[] {
  const merged = gitMeals.map(m => local[m.slug] ?? m)
  const gitSlugs = new Set(gitMeals.map(m => m.slug))
  const added = Object.values(local).filter(m => !gitSlugs.has(m.slug))
  return [...merged, ...added]
}

export interface UseLocalMeals {
  localMeals: Record<string, Meal>
  upsertMeal: (meal: Meal) => void
}

export function useLocalMeals(): UseLocalMeals {
  const state = useSyncExternalStore(localMealsStore.subscribe, localMealsStore.getSnapshot, () => EMPTY)
  return {
    localMeals: state.meals,
    upsertMeal: upsert,
  }
}
