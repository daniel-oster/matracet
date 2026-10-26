import { resolveMealDisplayName } from '../lib/mealResolve'
import type { RecipeIndexEntry, WeekMenu } from '../types'
import type { Meal } from '../types/meal'
import type { DinnerLine } from './types'

// Tonight's dish, taken from Matracet. Läget never plans meals; it only reads what the household
// planned: a slot assigned in Planera (the `matracet:weekplan:v3` store in the device-sync snapshot)
// wins, otherwise the dish named in that day's week file (livet-data/matracet/weeks/).

/** The parts of the weekplan store this needs (the full type lives in Matracet's useWeekPlan). */
export interface WeekPlanDay {
  dinner?: { mealSlug: string; receptSlug: string | null }
  dinnerAttendance?: { skip: boolean }
  lunch?: { mealSlug: string; receptSlug: string | null }
  lunchAttendance?: { skip: boolean }
}

export interface DinnerSources {
  weekplan: Record<string, WeekPlanDay>
  weeks: WeekMenu[]
  /** meals.json plus the locally created ones from the sync snapshot. */
  meals: Meal[]
  recipeIndex: RecipeIndexEntry[]
}

export const NO_MEAL_NEEDED = 'Ingen måltid behövs'

/** The dinner for `date`, or null when nothing is planned. `eatBy` comes from the day's eating window. */
export function dinnerFor(date: string, src: DinnerSources, eatBy: string | null): DinnerLine | null {
  const day = src.weekplan[date]
  if (day?.dinnerAttendance?.skip) return { title: NO_MEAL_NEEDED, eatBy: null }
  if (day?.dinner) {
    return { title: resolveMealDisplayName(day.dinner.mealSlug, day.dinner.receptSlug, src.meals, src.recipeIndex), eatBy, receptSlug: day.dinner.receptSlug }
  }
  for (const week of src.weeks) {
    const planned = week.middagar.find(m => m.datum === date && m.recept)
    if (planned?.recept) return { title: planned.recept, eatBy, receptSlug: planned.receptSlug ?? null }
  }
  return null
}

/** The lunch for `date`, or null when nothing is planned or no meal is needed (a skipped lunch isn't
 *  worth a line of its own). Same sources as the dinner; there is no eating window for lunch. */
export function lunchFor(date: string, src: DinnerSources): DinnerLine | null {
  const day = src.weekplan[date]
  if (day?.lunchAttendance?.skip) return null
  if (day?.lunch) {
    return { title: resolveMealDisplayName(day.lunch.mealSlug, day.lunch.receptSlug, src.meals, src.recipeIndex), eatBy: null, receptSlug: day.lunch.receptSlug }
  }
  for (const week of src.weeks) {
    const planned = (week.luncher ?? []).find(m => m.datum === date && m.recept)
    if (planned?.recept) return { title: planned.recept, eatBy: null, receptSlug: planned.receptSlug ?? null }
  }
  return null
}

/** meals.json plus the meals created in the app (the sync snapshot's `matracet:meals:local:v1`):
 *  a local entry with a git meal's slug replaces it, others are appended. Same rule as
 *  Matracet's mergeLocalMeals, kept here so Läget doesn't pull in Matracet's localStorage stores. */
export function mergeMeals(gitMeals: Meal[], local: Record<string, Meal> | undefined): Meal[] {
  if (!local) return gitMeals
  const gitSlugs = new Set(gitMeals.map(m => m.slug))
  return [...gitMeals.map(m => local[m.slug] ?? m), ...Object.values(local).filter(m => !gitSlugs.has(m.slug))]
}
