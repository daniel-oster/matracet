import { describe, it, expect } from 'vitest'
import { proposeWeek, ProposeWeekOptions } from './weekProposal'
import type { Eater, Recipe, RecipeIndexEntry } from '../types'
import type { Meal } from '../types/meal'
import type { TaggedOffer } from './bevaka'

const eater = (id: string, kost: string[] = []): Eater => ({ id, namn: id, roll: '', kost, gillar: [], undviker: [] })
const idx = (slug: string, o: Partial<RecipeIndexEntry> = {}): RecipeIndexEntry =>
  ({ slug, nummer: 1, namn: slug, tid_min: 40, kategorier: [], ...o }) as RecipeIndexEntry
const full = (slug: string, vara: string[]): Recipe =>
  ({ slug, namn: slug, kategorier: [], ingredienser: vara.map(v => ({ vara: v, mangd: '1', enhet: 'st' })), instruktioner: [] }) as unknown as Recipe
const offer = (namn: string, besparing: string): TaggedOffer =>
  ({ namn, besparing, store: 'willys', week: '2026-W47' }) as unknown as TaggedOffer
const fb = (map: Record<string, unknown>) => ((id: string) => (map[id] ?? null)) as ProposeWeekOptions['getFeedback']
const rec = (mealId: string, persons: { personId: string; sentiment: string }[], excl = false) =>
  ({ mealId, persons, excludeFromWeekPlan: excl, updatedAt: '' })

function opts(o: Partial<ProposeWeekOptions> = {}): ProposeWeekOptions {
  return {
    slots: [{ date: '2026-11-23', presentIds: ['a'], fast: false }],
    meals: [], recipeIndex: [idx('x'), idx('y')], fullRecipes: {},
    eaters: [eater('a')], offers: [], getFeedback: fb({}), ...o,
  }
}
const first = (r: ReturnType<typeof proposeWeek>, d = '2026-11-23') => r[d][0]

describe('proposeWeek', () => {
  it('excludes refused and excludeFromWeekPlan recipes', () => {
    const r = proposeWeek(opts({
      recipeIndex: [idx('x'), idx('y'), idx('z')],
      getFeedback: fb({ x: rec('x', [{ personId: 'a', sentiment: 'refuses' }]), y: rec('y', [], true) }),
    }))
    expect(r['2026-11-23'].map(c => c.receptSlug)).toEqual(['z'])
  })

  it('excludes non-vegan dishes for a vegan, but allows one with a vegansk swap', () => {
    const swappable = { ...full('sw', ['köttfärs']), varianter: { vegansk: { byt: { köttfärs: 'sojafärs' } } } } as unknown as Recipe
    const r = proposeWeek(opts({
      eaters: [eater('a', ['vegan'])],
      recipeIndex: [idx('plain'), idx('sw'), idx('veg', { kategorier: ['vegansk'] })],
      fullRecipes: { plain: full('plain', ['kyckling']), sw: swappable },
    }))
    const slugs = r['2026-11-23'].map(c => c.receptSlug)
    expect(slugs).not.toContain('plain')
    expect(slugs).toContain('sw')
    expect(slugs).toContain('veg')
    expect(r['2026-11-23'].find(c => c.receptSlug === 'sw')!.reasons.join()).toContain('🔁 byt köttfärs → sojafärs')
  })

  it('boosts a recipe matching an offer', () => {
    const r = proposeWeek(opts({
      fullRecipes: { y: full('y', ['kycklingfilé']) },
      offers: [offer('Kycklingfilé', '20kr')],
    }))
    expect(first(r).receptSlug).toBe('y')
    expect(first(r).reasons[0]).toContain('🏷 Kycklingfilé −20 kr')
    expect(first(r).offer).toBeDefined()
  })

  it('gives fast recipes a bonus only on fast slots', () => {
    const base = opts({ recipeIndex: [idx('slow', { tid_min: 60 }), idx('quick', { tid_min: 15 })] })
    const fast = proposeWeek({ ...base, slots: [{ date: '2026-11-23', presentIds: ['a'], fast: true }] })
    expect(first(fast).receptSlug).toBe('quick')
    expect(first(fast).reasons).toContain('⚡ 15 min')
    const notFast = proposeWeek(base)
    expect(notFast['2026-11-23'].every(c => !c.reasons.some(x => x.startsWith('⚡')))).toBe(true)
  })

  it('penalises recent recipes and meals', () => {
    const r = proposeWeek(opts({
      recipeIndex: [idx('x'), idx('y'), idx('z')],
      recentRecipeSlugs: ['x'], recentMealSlugs: ['y'],
    }))
    expect(first(r).receptSlug).toBe('z')
    expect(r['2026-11-23'].find(c => c.receptSlug === 'x')!.reasons).toContain('↺ ätet nyligen')
  })

  it('likes by present eaters add score and reason', () => {
    const r = proposeWeek(opts({ getFeedback: fb({ y: rec('y', [{ personId: 'a', sentiment: 'likes' }]) }) }))
    expect(first(r).receptSlug).toBe('y')
    expect(first(r).reasons).toContain('❤ a')
  })

  it('never repeats a meal among first picks and groups recipes by meals[].recept', () => {
    const meals: Meal[] = [{ slug: 'pasta', namn: 'Pasta', alias: [], komponenter: [], receptSlug: null, taggar: [], recept: ['p1', 'p2'] }]
    const slots = ['2026-11-23', '2026-11-24', '2026-11-25'].map(date => ({ date, presentIds: ['a'], fast: false }))
    const r = proposeWeek(opts({
      slots, meals, recipeIndex: [idx('p1'), idx('p2'), idx('o1')],
    }))
    const firsts = slots.map(s => r[s.date][0].mealSlug)
    expect(new Set(firsts).size).toBe(3 - 1) // pasta once + o1; third slot has no unused meal left
    expect(firsts.filter(m => m === 'pasta').length).toBeLessThanOrEqual(2)
    expect(r['2026-11-23'][0].mealNamn).toBeTruthy()
    const metaFirst = firsts.slice(0, 2)
    expect(new Set(metaFirst).size).toBe(2)
  })

  it('is deterministic per seed and varies across seeds', () => {
    const recipeIndex = Array.from({ length: 12 }, (_, i) => idx(`r${i}`))
    const slots = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26'].map(date => ({ date, presentIds: ['a'], fast: false }))
    const run = (seed: number) => JSON.stringify(proposeWeek(opts({ recipeIndex, slots, seed })))
    expect(run(1)).toBe(run(1))
    const distinct = new Set([1, 2, 3, 4, 5].map(run))
    expect(distinct.size).toBeGreaterThan(1)
  })
})
