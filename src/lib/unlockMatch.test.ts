import { describe, it, expect } from 'vitest'
import { findUnlockOpportunities } from './unlockMatch'
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

const A = makeRecipe('a', 'Broccolipasta', [
  { vara: 'Pasta', mangd: 500, enhet: 'g' },
  { vara: 'Broccoli', mangd: 1, enhet: 'st' },
])
const B = makeRecipe('b', 'Broccolisoppa', [
  { vara: 'Broccoli', mangd: 2, enhet: 'st' },
  { vara: 'Buljong', mangd: 1, enhet: 'l' },
])
const C = makeRecipe('c', 'Laxwok', [
  { vara: 'Laxfilé', mangd: 400, enhet: 'g' },
  { vara: 'Broccoli', mangd: 1, enhet: 'st' },
  { vara: 'Soja', mangd: 1, enhet: 'msk' },
])
const D = makeRecipe('d', 'Pastapesto', [
  { vara: 'Pasta', mangd: 500, enhet: 'g' },
  { vara: 'Pesto', mangd: 1, enhet: 'burk' },
])

const INDEX = [A, B, C, D].map(r => ({ slug: r.slug, nummer: 1, namn: r.namn, tid_min: r.tid_min, kategorier: [] }))
const RECIPES = { a: A, b: B, c: C, d: D }

describe('findUnlockOpportunities', () => {
  it('groups recipes missing exactly one ingredient by that ingredient, ranked by count', () => {
    // Have pasta, buljong, laxfilé, soja — missing broccoli unlocks a/b/c, missing pesto unlocks only d.
    const haveNames = ['Pasta', 'Buljong', 'Laxfilé', 'Soja']
    const result = findUnlockOpportunities(INDEX, RECIPES, haveNames)
    expect(result).toEqual([
      { ingredient: 'Broccoli', recipes: [INDEX[0], INDEX[1], INDEX[2]] },
    ])
  })

  it('excludes recipes missing zero or more than one ingredient', () => {
    // Pastapesto already fully covered (0 missing); broccolisoppa/laxwok miss 2+ each.
    const haveNames = ['Pasta', 'Pesto']
    const result = findUnlockOpportunities(INDEX, RECIPES, haveNames, 1)
    expect(result).toEqual([{ ingredient: 'Broccoli', recipes: [INDEX[0]] }])
  })

  it('respects minUnlocks threshold', () => {
    const haveNames = ['Pasta', 'Buljong', 'Laxfilé', 'Soja']
    expect(findUnlockOpportunities(INDEX, RECIPES, haveNames, 4)).toEqual([])
  })
})
