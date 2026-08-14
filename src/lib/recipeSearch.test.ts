import { describe, it, expect } from 'vitest'
import { matchesRecipeQuery, partitionRecipes } from './recipeSearch'
import type { RecipeIndexEntry } from '../types'

function entry(namn: string, taggar?: string[], kategorier: string[] = []): RecipeIndexEntry {
  return { slug: namn.toLowerCase(), nummer: 1, namn, tid_min: 30, kategorier, ...(taggar ? { taggar } : {}) }
}

const brownies = entry('Citronbrownies med citronglasyr', ['bakning', 'festligt', 'efterrätt'], ['vegetarisk'])
const pasta = entry('Pasta med zucchini och citronsås', undefined, ['vegetarisk'])
const tacos = entry('Tacogratäng', undefined, ['kott'])
const library = [pasta, tacos, brownies]

describe('matchesRecipeQuery', () => {
  it('matches on name, case-insensitively', () => {
    expect(matchesRecipeQuery(brownies, 'BROWNIES')).toBe(true)
  })

  it('matches on a tag, so "bakning"/"fika"/"efterrätt" find what the filter is named after', () => {
    expect(matchesRecipeQuery(brownies, 'bakning')).toBe(true)
    expect(matchesRecipeQuery(brownies, 'efterrätt')).toBe(true)
    expect(matchesRecipeQuery(pasta, 'bakning')).toBe(false)
  })

  it('matches on a diet category', () => {
    expect(matchesRecipeQuery(tacos, 'kott')).toBe(true)
  })

  it('an empty query matches everything', () => {
    expect(matchesRecipeQuery(tacos, '   ')).toBe(true)
  })
})

describe('partitionRecipes', () => {
  it('regression: a baking recipe searched by its own name is reported, not silently dropped', () => {
    // The bug this whole module exists to prevent — under the 'maltider' default the recipe
    // matched the query but was filtered out, so the screen said "inga recept matchar".
    const { visible, hiddenMatches } = partitionRecipes(library, 'maltider', 'brownies')
    expect(visible).toEqual([])
    expect(hiddenMatches).toEqual([brownies])
  })

  it('hides baking under "maltider" and shows only baking under "bakning"', () => {
    expect(partitionRecipes(library, 'maltider', '').visible).toEqual([pasta, tacos])
    expect(partitionRecipes(library, 'bakning', '').visible).toEqual([brownies])
  })

  it('reports meal recipes as hidden matches when the baking tab is active', () => {
    const { visible, hiddenMatches } = partitionRecipes(library, 'bakning', 'citron')
    expect(visible).toEqual([brownies])
    expect(hiddenMatches).toEqual([pasta])
  })

  it('"alla" shows everything and never reports hidden matches', () => {
    const { visible, hiddenMatches } = partitionRecipes(library, 'alla', 'citron')
    expect(visible).toEqual([pasta, brownies])
    expect(hiddenMatches).toEqual([])
  })

  it('a genuine miss is empty on both sides — that is the only real "no matches" case', () => {
    const { visible, hiddenMatches } = partitionRecipes(library, 'maltider', 'sushi')
    expect(visible).toEqual([])
    expect(hiddenMatches).toEqual([])
  })
})
