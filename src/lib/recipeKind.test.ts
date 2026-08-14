import { describe, it, expect } from 'vitest'
import { isNonMealRecipe, filterPlannableRecipes, nonMealLabel, NON_MEAL_TAGS } from './recipeKind'
import type { RecipeIndexEntry } from '../types'

function entry(slug: string, taggar?: string[]): RecipeIndexEntry {
  return { slug, nummer: 1, namn: slug, tid_min: 30, kategorier: [], ...(taggar ? { taggar } : {}) }
}

describe('isNonMealRecipe', () => {
  it('flags a baking recipe', () => {
    expect(isNonMealRecipe(entry('citronbrownies', ['bakning', 'festligt', 'efterrätt']))).toBe(true)
  })

  it('treats an untagged recipe as a normal meal (safe default)', () => {
    expect(isNonMealRecipe(entry('tacogratang'))).toBe(false)
    expect(isNonMealRecipe(entry('tacogratang', []))).toBe(false)
  })

  it('does not flag a festive *dinner* — "festligt" alone is descriptive, not a gate', () => {
    expect(NON_MEAL_TAGS).not.toContain('festligt')
    expect(isNonMealRecipe(entry('julskinka', ['festligt', 'jul']))).toBe(false)
  })

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    expect(isNonMealRecipe(entry('kladdkaka', [' Bakning ']))).toBe(true)
  })

  it('does not match a tag that merely contains a non-meal tag as a substring', () => {
    // Guards the Swedish-compound substring trap documented in CLAUDE.md — the tag list is
    // compared whole, not by substring, so "fikabröd-tillbehör" style tags don't leak in.
    expect(isNonMealRecipe(entry('x', ['fikabröd']))).toBe(false)
  })
})

describe('filterPlannableRecipes', () => {
  it('drops non-meal recipes and keeps the rest in order', () => {
    const list = [entry('a'), entry('kaka', ['bakning']), entry('b'), entry('glass', ['dessert'])]
    expect(filterPlannableRecipes(list).map(r => r.slug)).toEqual(['a', 'b'])
  })

  it('is a no-op on an index with no tags at all', () => {
    const list = [entry('a'), entry('b')]
    expect(filterPlannableRecipes(list)).toEqual(list)
  })
})

describe('nonMealLabel', () => {
  it('labels baking and dessert differently, and returns null for a meal', () => {
    expect(nonMealLabel(entry('x', ['bakning']))).toBe('🧁 Bakning')
    expect(nonMealLabel(entry('x', ['efterrätt']))).toBe('🍰 Efterrätt')
    expect(nonMealLabel(entry('x'))).toBeNull()
  })
})
