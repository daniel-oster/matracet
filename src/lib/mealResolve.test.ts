import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { MealsFile } from '../types/meal'

// Data-integrity guards for public/data/meals.json — not about evaluateFit itself, but
// about a real orphaning risk in how it (and feedback, keyed by meal slug since Stage 5)
// resolves a recipe to its meal. See src/lib/mealResolve.ts's resolveMealForRecipe: a
// recipe with no meals.json entry gets a *virtual* meal keyed to the recipe's own slug;
// once a real meals.json entry links that recipe via receptSlug, resolveMealForRecipe
// starts returning *that meal's own slug* instead — silently orphaning any feedback
// already recorded under the old virtual-meal key if the two slugs differ.
const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/data')
const meals = (JSON.parse(readFileSync(path.join(dataDir, 'meals.json'), 'utf8')) as MealsFile).meals
const recipeSlugs = readdirSync(path.join(dataDir, 'recipes'), { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)

describe('meals.json data invariants', () => {
  it('every receptSlug-linked meal avoids orphaning feedback recorded under the recipe\'s own virtual-meal slug', () => {
    for (const meal of meals) {
      if (!meal.receptSlug) continue
      const safe = meal.slug === meal.receptSlug || meal.alias.includes(meal.receptSlug)
      expect(
        safe,
        `Meal "${meal.slug}" links receptSlug "${meal.receptSlug}" but its own slug differs and ` +
          `"${meal.receptSlug}" isn't in its alias list. Before this meal existed, that recipe resolved ` +
          `to its own virtual meal keyed "${meal.receptSlug}" (see resolveMealForRecipe in ` +
          `src/lib/mealResolve.ts) — any feedback recorded under that key is now orphaned, since ` +
          `resolveMealForRecipe returns this meal's slug ("${meal.slug}") instead going forward. If this ` +
          `split is deliberate, extend migrateFeedbackV1 in src/hooks/useFeedback.ts to re-key the ` +
          `orphaned entries by hand.`,
      ).toBe(true)
    }
  })

  it('no meal slug collides with an unrelated recipe directory name', () => {
    for (const meal of meals) {
      if (!recipeSlugs.includes(meal.slug)) continue
      expect(
        meal.receptSlug === meal.slug,
        `Meal "${meal.slug}" shares its slug with a recipe directory of the same name, but isn't linked ` +
          `to it (receptSlug is "${JSON.stringify(meal.receptSlug)}"). A recipe with no meals.json entry ` +
          `resolves to a virtual meal keyed to its own slug (resolveMealForRecipe in ` +
          `src/lib/mealResolve.ts) — that virtual meal would collide with this real one, mixing up ` +
          `feedback/history between two unrelated things.`,
      ).toBe(true)
    }
  })
})
