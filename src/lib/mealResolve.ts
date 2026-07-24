import type { Meal, MealComponent } from '../types/meal'
import type { DayMeal, RecipeIndexEntry } from '../types'
import { looselyMatches } from './pantryMatch'

/** Same slug convention as recipes (see CLAUDE.md's "Recipe files" section): lowercase,
 *  hyphens, Swedish vowels transliterated. Used only for locally-derived "virtual" meal
 *  slugs (see resolveMealForRecipe/resolveMealForName below) — never written to the
 *  git-tracked meals.json, which is hand-authored. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ö/g, 'o')
    .replace(/ä/g, 'a')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Case-insensitive match against a meal's namn or any of its alias. */
export function matchMealByName(name: string, meals: Meal[]): Meal | undefined {
  const needle = name.trim().toLowerCase()
  if (!needle) return undefined
  return meals.find(m => m.namn.toLowerCase() === needle || m.alias.some(a => a.toLowerCase() === needle))
}

/**
 * Resolve (or virtually construct) the meal behind a recipe-only assignment. meals.json
 * only holds a curated ~30 hand-authored dishes — most of the app's 120 recipes have no
 * matching entry, and Stage 1's plan explicitly says not to bulk-generate one. So a recipe
 * with no matching meal becomes its own "virtual" meal, keyed by the recipe's own slug —
 * this is never written back to meals.json, it just lets every plan slot uniformly
 * reference a mealSlug (per the design's "always a meal, never sometimes-a-recipe" rule)
 * without requiring every recipe to have a real meals.json entry first.
 */
export function resolveMealForRecipe(recipeSlug: string, recipeNamn: string, meals: Meal[]): Meal {
  const existing = meals.find(m => m.receptSlug === recipeSlug)
  if (existing) return existing
  return {
    slug: recipeSlug,
    namn: recipeNamn,
    alias: [],
    komponenter: [],
    receptSlug: recipeSlug,
    taggar: [],
  }
}

/**
 * Resolve (or virtually construct) the meal behind a freeform name with no recipe at
 * all — e.g. a hand-typed stash idea or a v2 weekplan override with no receptSlug.
 * Matches by namn/alias first so "grillburgare" finds the real "Hamburgare" meal;
 * falls back to a virtual meal slugified from the name itself.
 */
export function resolveMealForName(name: string, meals: Meal[]): Meal {
  const matched = matchMealByName(name, meals)
  if (matched) return matched
  return {
    slug: slugify(name) || 'okand-ratt',
    namn: name,
    alias: [],
    komponenter: [],
    receptSlug: null,
    taggar: [],
  }
}

/**
 * A meal's components with any plan-time swaps (WeekPlanOverride.komponentByten)
 * applied — the post-swap list to actually shop/cook from. A swap only takes effect
 * when it names the component's own vara or one of its declared alternativ; anything
 * else in komponentByten (stale data from a since-edited meal) is ignored rather than
 * silently substituting an unrelated item.
 */
export function resolveComponents(meal: Meal, komponentByten?: Record<string, string>): MealComponent[] {
  return meal.komponenter.map(c => {
    const chosen = komponentByten?.[c.vara]
    if (chosen && chosen !== c.vara && c.alternativ.includes(chosen)) {
      return { ...c, vara: chosen }
    }
    return c
  })
}

/**
 * Orders a component's own name plus its alternativ so whichever one is already on
 * hand (haveNames — pantry staples/current stock and/or the stash pool's stock items,
 * same combination pantryMatch.ts's callers already build) sorts first. Reuses
 * pantryMatch.ts's looselyMatches rather than a second substring matcher.
 */
export function rankComponentOptions(component: MealComponent, haveNames: string[]): string[] {
  const options = [component.vara, ...component.alternativ]
  const onHand = (name: string) => haveNames.some(h => looselyMatches(h, name))
  return [...options].sort((a, b) => Number(onHand(b)) - Number(onHand(a)))
}

/**
 * The meal behind an already-resolved day/lunch slot (a DayMeal as returned by
 * applyOverride, or the raw static entry) — for callers (WeekWarnings, VeckanOverview)
 * that need the actual Meal object for evaluateFit, not just its display name. Prefers
 * the real meals.json entry when `mealSlug` names one, else reconstructs the same virtual
 * meal resolveMealForRecipe/resolveMealForName would have produced. Returns null only for
 * a genuinely empty slot (no dish at all).
 */
export function resolveDayMeal(day: Pick<DayMeal, 'recept' | 'receptSlug' | 'mealSlug'>, meals: Meal[]): Meal | null {
  if (day.mealSlug) {
    const meal = meals.find(m => m.slug === day.mealSlug)
    if (meal) return meal
  }
  if (day.receptSlug) return resolveMealForRecipe(day.receptSlug, day.recept ?? day.receptSlug, meals)
  if (day.recept) return resolveMealForName(day.recept, meals)
  return null
}

/** Display name for a plan slot given only its mealSlug/receptSlug — looks up the real
 *  meal first, falls back to the linked recipe's name, and finally the bare slug (should
 *  only happen for data that predates this system). */
export function resolveMealDisplayName(
  mealSlug: string,
  receptSlug: string | null,
  meals: Meal[],
  recipeIndex: RecipeIndexEntry[],
): string {
  const meal = meals.find(m => m.slug === mealSlug)
  if (meal) return meal.namn
  if (receptSlug) {
    const recipe = recipeIndex.find(r => r.slug === receptSlug)
    if (recipe) return recipe.namn
  }
  return mealSlug
}
