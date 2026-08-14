import type { RecipeIndexEntry } from '../types'
import { isNonMealRecipe } from './recipeKind'

/** Which slice of the recipe library `ReceptView` is showing. */
export type RecipeLibraryFilter = 'maltider' | 'bakning' | 'alla'

/**
 * Free-text match against everything a person plausibly remembers a recipe by: its name,
 * its tags, and its diet categories. Name-only (what this used to be) meant searching
 * "bakning", "efterrätt" or "fika" found nothing at all, even though those are exactly the
 * words the library's own filter uses.
 */
export function matchesRecipeQuery(entry: RecipeIndexEntry, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    entry.namn.toLowerCase().includes(q) ||
    (entry.taggar ?? []).some(t => t.toLowerCase().includes(q)) ||
    entry.kategorier.some(k => k.toLowerCase().includes(q))
  )
}

function inFilter(entry: RecipeIndexEntry, filter: RecipeLibraryFilter): boolean {
  if (filter === 'alla') return true
  return filter === 'bakning' ? isNonMealRecipe(entry) : !isNonMealRecipe(entry)
}

export interface RecipePartition {
  /** Matches the query *and* the active filter — what the list renders. */
  visible: RecipeIndexEntry[]
  /** Matches the query but is hidden by the active filter. Must never be dropped silently:
   *  a search that quietly swallows its only hit is indistinguishable from "no such recipe",
   *  which is exactly how a tagged baking recipe became unfindable after it was tagged. */
  hiddenMatches: RecipeIndexEntry[]
}

export function partitionRecipes(
  entries: RecipeIndexEntry[],
  filter: RecipeLibraryFilter,
  query: string,
): RecipePartition {
  const matching = entries.filter(e => matchesRecipeQuery(e, query))
  return {
    visible: matching.filter(e => inFilter(e, filter)),
    hiddenMatches: matching.filter(e => !inFilter(e, filter)),
  }
}
