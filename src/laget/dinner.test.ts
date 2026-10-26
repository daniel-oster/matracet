import { describe, expect, it } from 'vitest'
import { dinnerFor, lunchFor, mergeMeals, NO_MEAL_NEEDED } from './dinner'
import { makeDinner } from './fixtures'
import type { Meal } from '../types/meal'

describe('dinnerFor', () => {
  const src = makeDinner()
  it('uses a slot assigned in Planera, named through meals.json, with the eating window', () => {
    expect(dinnerFor('2026-11-04', src, '17:15')).toEqual({ title: 'Tacos', eatBy: '17:15', receptSlug: null })
  })
  it('falls back to the dish in the week file', () => {
    expect(dinnerFor('2026-11-02', src, null)).toEqual({ title: 'Ugnsbakad lax', eatBy: null, receptSlug: null })
  })
  it('a planned slot beats the week file for the same day', () => {
    const both = makeDinner({ weekplan: { '2026-11-02': { dinner: { mealSlug: 'tacos', receptSlug: null } } } })
    expect(dinnerFor('2026-11-02', both, null)?.title).toBe('Tacos')
  })
  it('says "no meal needed" for a skipped slot, and drops the eating window', () => {
    expect(dinnerFor('2026-11-03', src, '18:00')).toEqual({ title: NO_MEAL_NEEDED, eatBy: null })
  })
  it('carries the recipe behind the dish, so tapping it can open that recipe', () => {
    const src = makeDinner({ weekplan: { '2026-11-05': { dinner: { mealSlug: 'linsgryta', receptSlug: 'linsgryta-kokos' } } } })
    expect(dinnerFor('2026-11-05', src, null)?.receptSlug).toBe('linsgryta-kokos')
  })
  it('is null when nothing is planned (no entry, or a week-file day with recept: null)', () => {
    expect(dinnerFor('2026-11-05', src, null)).toBeNull()
    expect(dinnerFor('2026-11-06', src, null)).toBeNull()
  })
  it('names a recipe-backed slot from the recipe index when the meal is virtual', () => {
    const s = makeDinner({
      weekplan: { '2026-11-05': { dinner: { mealSlug: 'linsgryta', receptSlug: 'linsgryta-kokos' } } },
      recipeIndex: [{ slug: 'linsgryta-kokos', nummer: 1, namn: 'Linsgryta med kokos', tid_min: 30, kategorier: [] }] as never,
    })
    expect(dinnerFor('2026-11-05', s, null)?.title).toBe('Linsgryta med kokos')
  })
})

describe('mergeMeals', () => {
  const m = (slug: string, namn: string): Meal => ({ slug, namn, alias: [], komponenter: [], receptSlug: null, taggar: [] })
  it('replaces by slug, appends new ones, and passes through without local meals', () => {
    const git = [m('a', 'A'), m('b', 'B')]
    expect(mergeMeals(git, undefined)).toBe(git)
    expect(mergeMeals(git, { b: m('b', 'B2'), c: m('c', 'C') }).map(x => x.namn)).toEqual(['A', 'B2', 'C'])
  })
})

describe('lunchFor', () => {
  it('reads the lunch slot from the Planera plan, with its recipe', () => {
    const src = makeDinner({ weekplan: { '2026-10-26': { lunch: { mealSlug: 'stekta-agg-bonsallad', receptSlug: 'stekta-agg-bonsallad' } } } })
    expect(lunchFor('2026-10-26', src)).toMatchObject({ receptSlug: 'stekta-agg-bonsallad', eatBy: null })
  })
  it('is null with nothing planned, and when the lunch is marked as not needed', () => {
    expect(lunchFor('2026-10-26', makeDinner({}))).toBeNull()
    const skipped = makeDinner({ weekplan: { '2026-10-26': { lunch: { mealSlug: 'x', receptSlug: null }, lunchAttendance: { skip: true } } } })
    expect(lunchFor('2026-10-26', skipped)).toBeNull()
  })
})
