import { describe, it, expect } from 'vitest'
import { evaluateFit } from './dietFit'
import type { Eater, Recipe } from '../types'
import type { Meal } from '../types/meal'
import type { RecipeFeedbackRecord } from '../types/feedback'

function makeRecipe(over: Partial<Recipe> = {}): Recipe {
  return {
    schema_version: '1',
    slug: 'test-recipe',
    nummer: 1,
    namn: 'Testrätt',
    tid_min: 20,
    portioner: 4,
    kategorier: [],
    sasong: [],
    svarighet: 'latt',
    barnvanlig: 'ja',
    taggar: [],
    dagkedja: null,
    ingredienser: [],
    instruktioner: [],
    komplett: true,
    ...over,
  }
}

function makeMeal(over: Partial<Meal> = {}): Meal {
  return {
    slug: 'test-meal',
    namn: 'Testmåltid',
    alias: [],
    komponenter: [],
    receptSlug: null,
    taggar: [],
    ...over,
  }
}

function makeEater(over: Partial<Eater> = {}): Eater {
  return {
    id: 'x',
    namn: 'X',
    roll: 'barn',
    gillar: [],
    undviker: [],
    ...over,
  }
}

const HAMBURGARE = makeMeal({
  slug: 'hamburgare',
  namn: 'Hamburgare',
  komponenter: [
    { vara: 'hamburgerbröd', alternativ: [] },
    { vara: 'nötfärsbiff', alternativ: ['vegansk biff', 'halloumi'] },
    { vara: 'sallad', alternativ: [], valfri: true },
  ],
})

describe('evaluateFit', () => {
  it('is ok with no conflicts or swaps when nobody present has any requirement', () => {
    const result = evaluateFit(HAMBURGARE, null, [makeEater({ id: 'daniel' })], null)
    expect(result).toEqual({ ok: true, conflicts: [], requiredSwaps: [] })
  })

  it('suggests a swap for a vegan eater against a recipe-less meal (the Hamburgare worked example)', () => {
    const annabelle = makeEater({ id: 'annabelle', namn: 'Annabelle', kost: ['vegan'] })
    const result = evaluateFit(HAMBURGARE, null, [annabelle], null)
    expect(result.ok).toBe(true)
    expect(result.conflicts).toEqual([])
    expect(result.requiredSwaps).toEqual([
      { from: 'nötfärsbiff', to: 'vegansk biff', reason: 'Annabelle äter veganskt' },
    ])
  })

  it('conflicts when a vegan eater has no vegan-compatible alternativ available', () => {
    const noAltMeal = makeMeal({
      komponenter: [{ vara: 'köttfärs', alternativ: ['fläskfärs'] }],
    })
    const annabelle = makeEater({ id: 'annabelle', kost: ['vegan'] })
    const result = evaluateFit(noAltMeal, null, [annabelle], null)
    expect(result.ok).toBe(false)
    expect(result.conflicts).toEqual([
      { personId: 'annabelle', reason: 'vegan', detail: expect.stringContaining('köttfärs') },
    ])
    expect(result.requiredSwaps).toEqual([])
  })

  it('uses Recipe.kategorier + varianter.vegansk.byt for a recipe-backed slot', () => {
    const recipe = makeRecipe({
      namn: 'Blomkålssoppa',
      kategorier: ['vegetarisk'],
      ingredienser: [{ vara: 'grädde', mangd: 2, enhet: 'dl' }],
      varianter: { vegansk: { byt: { grädde: 'havregrädde' } } },
    })
    const annabelle = makeEater({ id: 'annabelle', namn: 'Annabelle', kost: ['vegan'] })
    const result = evaluateFit(HAMBURGARE, recipe, [annabelle], null)
    expect(result.ok).toBe(true)
    expect(result.requiredSwaps).toEqual([
      { from: 'grädde', to: 'havregrädde', reason: 'Annabelle äter veganskt' },
    ])
  })

  it('conflicts when a recipe is not vegan and has no vegansk variant', () => {
    const recipe = makeRecipe({ namn: 'Köttbullar', kategorier: ['kott'] })
    const annabelle = makeEater({ id: 'annabelle', kost: ['vegan'] })
    const result = evaluateFit(HAMBURGARE, recipe, [annabelle], null)
    expect(result.ok).toBe(false)
    expect(result.conflicts).toEqual([
      { personId: 'annabelle', reason: 'vegan', detail: expect.stringContaining('Köttbullar') },
    ])
  })

  it('a recipe already marked vegansk needs no swap', () => {
    const recipe = makeRecipe({ kategorier: ['vegansk'] })
    const annabelle = makeEater({ id: 'annabelle', kost: ['vegan'] })
    const result = evaluateFit(HAMBURGARE, recipe, [annabelle], null)
    expect(result).toEqual({ ok: true, conflicts: [], requiredSwaps: [] })
  })

  it('suggests a swap when an avoided ingredient has a component alternativ', () => {
    const sarah = makeEater({ id: 'sarah', namn: 'Sarah', undviker: ['lax'] })
    const meal = makeMeal({ komponenter: [{ vara: 'lax', alternativ: ['torsk'] }] })
    const result = evaluateFit(meal, null, [sarah], null)
    expect(result.ok).toBe(true)
    expect(result.requiredSwaps).toEqual([{ from: 'lax', to: 'torsk', reason: 'Sarah undviker lax' }])
  })

  it('conflicts when an avoided ingredient has no substitute at all', () => {
    const sarah = makeEater({ id: 'sarah', namn: 'Sarah', undviker: ['lax'] })
    const meal = makeMeal({ komponenter: [{ vara: 'lax', alternativ: [] }] })
    const result = evaluateFit(meal, null, [sarah], null)
    expect(result.ok).toBe(false)
    expect(result.conflicts).toEqual([
      { personId: 'sarah', reason: 'avoid-ingredient', detail: expect.stringContaining('lax') },
    ])
  })

  it('a refusal is a veto no substitution fixes, even alongside an otherwise-clean fit', () => {
    const daniel = makeEater({ id: 'daniel', namn: 'Daniel' })
    const feedback: RecipeFeedbackRecord = {
      mealId: 'hamburgare',
      persons: [{ personId: 'daniel', sentiment: 'refuses', updatedAt: '2026-01-01T00:00:00Z' }],
      excludeFromWeekPlan: false,
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const result = evaluateFit(HAMBURGARE, null, [daniel], feedback)
    expect(result.ok).toBe(false)
    expect(result.conflicts).toEqual([
      { personId: 'daniel', reason: 'refuses', detail: expect.stringContaining('Hamburgare') },
    ])
    expect(result.requiredSwaps).toEqual([])
  })

  it('merges duplicate swaps requested by more than one present eater into one, with combined reasons', () => {
    const meal = makeMeal({ komponenter: [{ vara: 'lax', alternativ: ['torsk'] }] })
    const sarah = makeEater({ id: 'sarah', namn: 'Sarah', undviker: ['lax'] })
    const other = makeEater({ id: 'other', namn: 'Other', undviker: ['lax'] })
    const result = evaluateFit(meal, null, [sarah, other], null)
    expect(result.requiredSwaps).toHaveLength(1)
    expect(result.requiredSwaps[0].reason).toContain('Sarah')
    expect(result.requiredSwaps[0].reason).toContain('Other')
  })
})
