import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { evaluateFit } from './dietFit'
import type { Eater, Recipe, RecipeIndexEntry } from '../types'
import type { Meal } from '../types/meal'
import type { RecipeFeedbackRecord } from '../types/feedback'

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/data')
const REAL_MEALS: Meal[] = JSON.parse(readFileSync(path.join(dataDir, 'meals.json'), 'utf8')).meals
function realMeal(slug: string): Meal {
  const meal = REAL_MEALS.find(m => m.slug === slug)
  if (!meal) throw new Error(`fixture meal "${slug}" not found in public/data/meals.json`)
  return meal
}
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
    const result = evaluateFit(HAMBURGARE, null, [makeEater({ id: 'vanlig' })], null)
    expect(result).toEqual({ ok: true, conflicts: [], requiredSwaps: [], unknowns: [] })
  })

  it('suggests the meat-patty swap for a vegan eater against a recipe-less meal (the Hamburgare worked example)', () => {
    // Updated for the fail-closed rework (see CLAUDE.md's "Vegan classification is
    // fail-closed"): "nötfärsbiff" is still correctly matched to "vegansk biff", but
    // "hamburgerbröd"/"sallad" carry no explicit vegan signal either way, so they now
    // correctly surface as unknowns rather than being silently waved through — this is
    // the intended, disclosed consequence of no longer treating "unknown" as "fine",
    // not a regression.
    const vegan = makeEater({ id: 'vegan', namn: 'Vegan', kost: ['vegan'] })
    const result = evaluateFit(HAMBURGARE, null, [vegan], null)
    expect(result.requiredSwaps).toEqual([
      { from: 'nötfärsbiff', to: 'vegansk biff', reason: 'Vegan äter veganskt' },
    ])
    expect(result.conflicts).toEqual([])
    expect(result.unknowns).toHaveLength(2)
    expect(result.unknowns.every(u => u.reason === 'vegan-unknown')).toBe(true)
    expect(result.ok).toBe(false)
  })

  it('conflicts when a vegan eater has no vegan-compatible alternativ available', () => {
    const noAltMeal = makeMeal({
      komponenter: [{ vara: 'köttfärs', alternativ: ['fläskfärs'] }],
    })
    const vegan = makeEater({ id: 'vegan', kost: ['vegan'] })
    const result = evaluateFit(noAltMeal, null, [vegan], null)
    expect(result.ok).toBe(false)
    expect(result.conflicts).toEqual([
      { personId: 'vegan', reason: 'vegan', detail: expect.stringContaining('köttfärs') },
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
    const vegan = makeEater({ id: 'vegan', namn: 'Vegan', kost: ['vegan'] })
    const result = evaluateFit(HAMBURGARE, recipe, [vegan], null)
    expect(result.ok).toBe(true)
    expect(result.requiredSwaps).toEqual([
      { from: 'grädde', to: 'havregrädde', reason: 'Vegan äter veganskt' },
    ])
  })

  it('conflicts when a recipe is not vegan and has no vegansk variant', () => {
    const recipe = makeRecipe({ namn: 'Köttbullar', kategorier: ['kott'] })
    const vegan = makeEater({ id: 'vegan', kost: ['vegan'] })
    const result = evaluateFit(HAMBURGARE, recipe, [vegan], null)
    expect(result.ok).toBe(false)
    expect(result.conflicts).toEqual([
      { personId: 'vegan', reason: 'vegan', detail: expect.stringContaining('Köttbullar') },
    ])
  })

  it('a recipe already marked vegansk needs no swap', () => {
    const recipe = makeRecipe({ kategorier: ['vegansk'] })
    const vegan = makeEater({ id: 'vegan', kost: ['vegan'] })
    const result = evaluateFit(HAMBURGARE, recipe, [vegan], null)
    expect(result).toEqual({ ok: true, conflicts: [], requiredSwaps: [], unknowns: [] })
  })

  it('suggests a swap when an avoided ingredient has a component alternativ', () => {
    const undviker = makeEater({ id: 'undviker', namn: 'Undviker', undviker: ['lax'] })
    const meal = makeMeal({ komponenter: [{ vara: 'lax', alternativ: ['torsk'] }] })
    const result = evaluateFit(meal, null, [undviker], null)
    expect(result.ok).toBe(true)
    expect(result.requiredSwaps).toEqual([{ from: 'lax', to: 'torsk', reason: 'Undviker undviker lax' }])
  })

  it('conflicts when an avoided ingredient has no substitute at all', () => {
    const undviker = makeEater({ id: 'undviker', namn: 'Undviker', undviker: ['lax'] })
    const meal = makeMeal({ komponenter: [{ vara: 'lax', alternativ: [] }] })
    const result = evaluateFit(meal, null, [undviker], null)
    expect(result.ok).toBe(false)
    expect(result.conflicts).toEqual([
      { personId: 'undviker', reason: 'avoid-ingredient', detail: expect.stringContaining('lax') },
    ])
  })

  it('a refusal is a veto no substitution fixes, even alongside an otherwise-clean fit', () => {
    const vanlig = makeEater({ id: 'vanlig', namn: 'Vanlig' })
    const feedback: RecipeFeedbackRecord = {
      mealId: 'hamburgare',
      persons: [{ personId: 'vanlig', sentiment: 'refuses', updatedAt: '2026-01-01T00:00:00Z' }],
      excludeFromWeekPlan: false,
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const result = evaluateFit(HAMBURGARE, null, [vanlig], feedback)
    expect(result.ok).toBe(false)
    expect(result.conflicts).toEqual([
      { personId: 'vanlig', reason: 'refuses', detail: expect.stringContaining('Hamburgare') },
    ])
    expect(result.requiredSwaps).toEqual([])
  })

  it('merges duplicate swaps requested by more than one present eater into one, with combined reasons', () => {
    const meal = makeMeal({ komponenter: [{ vara: 'lax', alternativ: ['torsk'] }] })
    const undviker = makeEater({ id: 'undviker', namn: 'Undviker', undviker: ['lax'] })
    const other = makeEater({ id: 'other', namn: 'Other', undviker: ['lax'] })
    const result = evaluateFit(meal, null, [undviker, other], null)
    expect(result.requiredSwaps).toHaveLength(1)
    expect(result.requiredSwaps[0].reason).toContain('Undviker')
    expect(result.requiredSwaps[0].reason).toContain('Other')
  })
})

// ── PR follow-up: the vegan check must fail closed ──────────────────────────────────
// A code review found evaluateFit reports a dish safe for a vegan eater when it isn't —
// every defect below fails in the direction of a false "fine". These 5 cases must fail
// against today's production code before any fix lands (see the task's Stage A).
describe('evaluateFit — fail-closed vegan classification (PR follow-up)', () => {
  it('does not offer halloumi as a vegan substitute for the real tacos meal', () => {
    const tacos = realMeal('tacos')
    const eaters = [
      makeEater({ id: 'vanlig' }),
      makeEater({ id: 'undviker', undviker: ['svamp', 'bittert', 'lax'] }),
      makeEater({ id: 'vegan', kost: ['vegan'], undviker: ['bönor', 'linser', 'grön sallad'] }),
    ]
    const result = evaluateFit(tacos, null, eaters, null)
    expect(result.requiredSwaps.some(s => s.to === 'halloumi')).toBe(false)
  })

  it('does not silently pass a dish with no known component data for a vegan eater', () => {
    const emptyMeal = makeMeal({ komponenter: [] })
    const vegan = makeEater({ id: 'vegan', namn: 'Vegan', kost: ['vegan'] })
    const result = evaluateFit(emptyMeal, null, [vegan], null)
    expect(result.ok).toBe(false)
    expect(result.unknowns).toHaveLength(1)
    expect(result.unknowns[0].reason).toBe('vegan-unknown')
  })

  it('does not propose a swap that violates the same eater\'s own avoid list', () => {
    // "svarta bönor" is genuinely vegan (matches the allow-list) — the defect isn't in
    // classifying it, it's in offering it anyway when the same eater's own undviker rules
    // it out for a different reason.
    const meal = makeMeal({
      komponenter: [{ vara: 'köttfärs', alternativ: ['svarta bönor'] }],
    })
    const vegan = makeEater({ id: 'vegan', namn: 'Vegan', kost: ['vegan'], undviker: ['bönor'] })
    const result = evaluateFit(meal, null, [vegan], null)
    expect(result.requiredSwaps.some(s => s.to === 'svarta bönor')).toBe(false)
  })

  it('loosely matches a recipe substitute keyed to a shorter ingredient name', () => {
    const recipe = makeRecipe({
      namn: 'Äggrätt',
      kategorier: ['vegetarisk'],
      ingredienser: [{ vara: 'ägg (stora)', mangd: 4, enhet: 'st' }],
      varianter: { vegansk: { byt: { ägg: 'rökt tofu i skivor' } } },
    })
    const undviker = makeEater({ id: 'undviker', namn: 'Undviker', undviker: ['ägg'] })
    const result = evaluateFit(HAMBURGARE, recipe, [undviker], null)
    expect(result.requiredSwaps).toContainEqual({ from: 'ägg (stora)', to: 'rökt tofu i skivor', reason: 'Undviker undviker ägg' })
  })

  it('a dairy/animal-product denylist probe', () => {
    const probe = makeEater({ id: 'vegan', namn: 'Vegan', kost: ['vegan'] })
    const names = [
      'halloumi', 'mozzarella', 'parmesan', 'yoghurt', 'kvarg', 'crème fraiche',
      'majonnäs', 'aioli', 'hollandaise', 'salami', 'chorizo', 'prosciutto',
      'leverpastej', 'hönsbuljong', 'gelatin', 'musslor',
    ]
    for (const name of names) {
      const meal = makeMeal({ komponenter: [{ vara: name, alternativ: [] }] })
      const result = evaluateFit(meal, null, [probe], null)
      expect(result.ok, `"${name}" was reported as vegan-compatible`).toBe(false)
      expect(result.conflicts.length + result.unknowns.length, `"${name}" produced neither a conflict nor an unknown`).toBeGreaterThan(0)
    }
  })
})

function makeIndexEntry(over: Partial<RecipeIndexEntry> = {}): RecipeIndexEntry {
  return { slug: 'test-recipe', nummer: 1, namn: 'Testrätt', tid_min: 20, kategorier: [], ...over }
}

// ── Stage D: a lightweight RecipeIndexEntry (kategorier only, no ingredienser/varianter) ──
describe('evaluateFit — lightweight RecipeIndexEntry', () => {
  it('uses kategorier for a definite vegan verdict with no ingredient data at all', () => {
    const entry = makeIndexEntry({ namn: 'Köttbullar', kategorier: ['kott'] })
    const vegan = makeEater({ id: 'vegan', kost: ['vegan'] })
    const result = evaluateFit(HAMBURGARE, entry, [vegan], null)
    expect(result.ok).toBe(false)
    expect(result.conflicts).toEqual([
      { personId: 'vegan', reason: 'vegan', detail: expect.stringContaining('Köttbullar') },
    ])
    expect(result.unknowns).toEqual([])
  })

  it('an index entry already marked vegansk needs no swap and no unknown', () => {
    const entry = makeIndexEntry({ kategorier: ['vegansk'] })
    const vegan = makeEater({ id: 'vegan', kost: ['vegan'] })
    const result = evaluateFit(HAMBURGARE, entry, [vegan], null)
    expect(result).toEqual({ ok: true, conflicts: [], requiredSwaps: [], unknowns: [] })
  })

  it('emits an ingredients-unavailable unknown for an undviker check with no ingredient list', () => {
    const entry = makeIndexEntry({ namn: 'Fisksoppa' })
    const undviker = makeEater({ id: 'undviker', namn: 'Undviker', undviker: ['lax'] })
    const result = evaluateFit(HAMBURGARE, entry, [undviker], null)
    expect(result.ok).toBe(false)
    expect(result.conflicts).toEqual([])
    expect(result.unknowns).toEqual([
      { personId: 'undviker', reason: 'ingredients-unavailable', detail: expect.stringContaining('lax') },
    ])
  })

  it('does not report an unknown for an eater with nothing to avoid', () => {
    const entry = makeIndexEntry()
    const vanlig = makeEater({ id: 'vanlig', namn: 'Vanlig' })
    const result = evaluateFit(HAMBURGARE, entry, [vanlig], null)
    expect(result).toEqual({ ok: true, conflicts: [], requiredSwaps: [], unknowns: [] })
  })
})
