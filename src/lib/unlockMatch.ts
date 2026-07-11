import type { Recipe, RecipeIndexEntry } from '../types'
import { looselyMatches } from './pantryMatch'

export interface UnlockOpportunity {
  ingredient: string
  recipes: RecipeIndexEntry[]
}

/**
 * "Buy broccoli, unlock these 6 dishes" — groups recipes that are missing exactly one
 * ingredient from what's already on hand (`haveNames`, e.g. pantry staples + the stash
 * pool) by that single missing ingredient, so a single purchase's payoff is visible.
 * Deliberately a different question from pantryMatch.ts's matchPantryRecipes ("what can
 * we cook right now") — this is "what's one purchase away from cookable."
 * Only surfaces ingredients whose purchase would unlock more than `minUnlocks` dishes —
 * unlocking a single dish isn't an interesting "efficient purchase" signal.
 */
export function findUnlockOpportunities(
  recipeIndex: RecipeIndexEntry[],
  fullRecipes: Record<string, Recipe>,
  haveNames: string[],
  minUnlocks = 2,
): UnlockOpportunity[] {
  const groups = new Map<string, RecipeIndexEntry[]>()

  for (const entry of recipeIndex) {
    const recipe = fullRecipes[entry.slug]
    if (!recipe || recipe.ingredienser.length === 0) continue
    const missing = recipe.ingredienser.filter(i => !haveNames.some(have => looselyMatches(i.vara, have)))
    if (missing.length !== 1) continue
    const key = missing[0].vara.trim()
    if (!key) continue
    const list = groups.get(key) ?? []
    list.push(entry)
    groups.set(key, list)
  }

  return Array.from(groups.entries())
    .map(([ingredient, recipes]) => ({ ingredient, recipes }))
    .filter(o => o.recipes.length >= minUnlocks)
    .sort((a, b) => b.recipes.length - a.recipes.length)
}
