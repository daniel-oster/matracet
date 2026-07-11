import type { Recipe, RecipeIndexEntry } from '../types'

export interface PantryMatch {
  entry: RecipeIndexEntry
  matchedNames: string[]
}

/** Same loose substring-either-direction heuristic as suggestions.ts's offer matching. */
export function looselyMatches(a: string, b: string): boolean {
  const x = a.trim().toLowerCase()
  const y = b.trim().toLowerCase()
  if (!x || !y) return false
  return x.includes(y) || y.includes(x)
}

/**
 * Recipes buildable from what's actually on hand — the caller decides what "on hand"
 * means (household pantry staples, the stash pool's stock items, or both combined) by
 * what it passes as `haveNames` — ranked by how many of those items they use. This is
 * deliberately a different question from suggestions.ts's rankSuggestions, which scores
 * against *any* current offer.
 */
export function matchPantryRecipes(
  recipeIndex: RecipeIndexEntry[],
  fullRecipes: Record<string, Recipe>,
  haveNames: string[],
): PantryMatch[] {
  const matches = recipeIndex
    .map((entry): PantryMatch | null => {
      const recipe = fullRecipes[entry.slug]
      if (!recipe) return null
      const matchedNames = haveNames.filter(have =>
        recipe.ingredienser.some(i => looselyMatches(i.vara, have)),
      )
      return matchedNames.length > 0 ? { entry, matchedNames } : null
    })
    .filter((m): m is PantryMatch => m !== null)

  return matches.sort((a, b) => b.matchedNames.length - a.matchedNames.length || a.entry.tid_min - b.entry.tid_min)
}
