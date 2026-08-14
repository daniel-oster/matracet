import type { RecipeIndexEntry } from '../types'

/**
 * Free-text `taggar` values that mark a recipe as *not a meal* — something you bake or
 * serve alongside/after dinner, never something that fills a lunch/middag slot.
 *
 * Deliberately a tag list rather than a new boolean field on the recipe schema: the
 * household's own framing was "flagga det som bakning och festligt", and `taggar` is
 * already the free-form classification channel (`kategorier` is the closed dietary set —
 * vegansk/vegetarisk/fisk/kott/glutenfri/laktosfri — and must stay that way, since
 * dietFit.ts and suggestions.ts read it as a diet signal).
 *
 * Note "festligt" is deliberately NOT in here: a festive *dinner* is still a dinner. Only
 * the tags that mean "this is not a main meal at all" gate planning.
 */
export const NON_MEAL_TAGS = ['bakning', 'bakverk', 'efterrätt', 'dessert', 'fika', 'godis']

/**
 * True when a recipe is baking/dessert/fika rather than a plannable meal.
 *
 * Reads the *index* entry's optional `taggar` (see the field's doc comment in types.ts) —
 * a full `Recipe` satisfies the same shape, so this works for either. A recipe with no
 * tags in the index is treated as a normal meal, which is the safe default: the failure
 * mode is "a cake shows up in the suggestion list until it's tagged", not "a real dinner
 * silently disappears from planning".
 */
export function isNonMealRecipe(entry: { taggar?: string[] }): boolean {
  return (entry.taggar ?? []).some(t => NON_MEAL_TAGS.includes(t.trim().toLowerCase()))
}

/** The plannable subset of a recipe index — everything the meal planner may suggest. */
export function filterPlannableRecipes<T extends { taggar?: string[] }>(entries: T[]): T[] {
  return entries.filter(e => !isNonMealRecipe(e))
}

/** Recipe-library label for a non-meal recipe, e.g. the "🧁 Bakning" badge on its card. */
export function nonMealLabel(entry: RecipeIndexEntry): string | null {
  if (!isNonMealRecipe(entry)) return null
  const tags = entry.taggar ?? []
  if (tags.includes('bakning') || tags.includes('bakverk')) return '🧁 Bakning'
  return '🍰 Efterrätt'
}
