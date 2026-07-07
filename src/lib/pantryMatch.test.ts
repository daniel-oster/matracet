import { describe, it, expect } from 'vitest'
import { matchPantryRecipes } from './pantryMatch'
import type { Recipe } from '../types'

function makeRecipe(slug: string, namn: string, ingredienser: Recipe['ingredienser']): Recipe {
  return {
    schema_version: '1',
    slug,
    nummer: 1,
    namn,
    tid_min: 20,
    portioner: 4,
    kategorier: [],
    sasong: [],
    svarighet: 'latt',
    barnvanlig: 'ja',
    taggar: [],
    dagkedja: null,
    ingredienser,
    instruktioner: [],
    komplett: true,
  }
}

const LAX = makeRecipe('lax', 'Ugnsbakad lax', [
  { vara: 'Laxfilé', mangd: 400, enhet: 'g' },
  { vara: 'Gul lök', mangd: 1, enhet: 'st' },
])
const PASTA = makeRecipe('pasta', 'Pasta pomodoro', [
  { vara: 'Pasta', mangd: 500, enhet: 'g' },
])
const INDEX = [
  { slug: 'lax', nummer: 1, namn: 'Ugnsbakad lax', tid_min: 20, kategorier: [] },
  { slug: 'pasta', nummer: 2, namn: 'Pasta pomodoro', tid_min: 15, kategorier: [] },
]
const RECIPES = { lax: LAX, pasta: PASTA }

describe('matchPantryRecipes', () => {
  it('only returns recipes with at least one matching stock item', () => {
    const result = matchPantryRecipes(INDEX, RECIPES, ['laxfilé'])
    expect(result.map(r => r.entry.slug)).toEqual(['lax'])
    expect(result[0].matchedNames).toEqual(['laxfilé'])
  })

  it('matches loosely in either substring direction and ranks by match count', () => {
    const result = matchPantryRecipes(INDEX, RECIPES, ['lax', 'gul lök i påse', 'pasta'])
    expect(result.map(r => r.entry.slug)).toEqual(['lax', 'pasta'])
    expect(result[0].matchedNames).toEqual(['lax', 'gul lök i påse'])
  })

  it('returns nothing when no stock item matches any ingredient', () => {
    expect(matchPantryRecipes(INDEX, RECIPES, ['choklad'])).toEqual([])
  })
})
