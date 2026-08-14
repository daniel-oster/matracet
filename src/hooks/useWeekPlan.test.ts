import { describe, it, expect } from 'vitest'
import { applyOverride, effectivePresentIds, diffAttendance } from './useWeekPlan'
import type { WeekPlanOverride, MealAttendance } from './useWeekPlan'
import type { DayMeal, RecipeIndexEntry } from '../types'
import type { Meal } from '../types/meal'

const MEALS: Meal[] = [
  { slug: 'hamburgare', namn: 'Hamburgare', alias: [], komponenter: [], receptSlug: null, taggar: [] },
]
const RECIPE_INDEX: RecipeIndexEntry[] = [
  { slug: 'lax', nummer: 1, namn: 'Ugnsbakad lax', tid_min: 20, kategorier: [] },
]

const DAY: DayMeal = { dag: 'mandag', datum: '2026-08-10', recept: 'Original dish', receptSlug: 'lax' }

function makeOverride(mealSlug: string, receptSlug: string | null = null): WeekPlanOverride {
  return { mealSlug, receptSlug, updatedAt: '2026-08-01T00:00:00.000Z' }
}

function makeAttendance(overrides: Partial<MealAttendance> = {}): MealAttendance {
  return { presentIds: null, skip: false, updatedAt: '2026-08-01T00:00:00.000Z', ...overrides }
}

describe('applyOverride', () => {
  it('returns the day unchanged when there is no override or attendance', () => {
    expect(applyOverride(DAY, undefined, MEALS, RECIPE_INDEX)).toEqual(DAY)
  })

  it('resolves a real meals.json meal by name', () => {
    const result = applyOverride(DAY, makeOverride('hamburgare'), MEALS, RECIPE_INDEX)
    expect(result.recept).toBe('Hamburgare')
    expect(result.mealSlug).toBe('hamburgare')
    expect(result.receptSlug).toBeUndefined()
  })

  it('falls back to the linked recipe name when the meal slug is virtual', () => {
    const result = applyOverride(DAY, makeOverride('lax', 'lax'), MEALS, RECIPE_INDEX)
    expect(result.recept).toBe('Ugnsbakad lax')
    expect(result.receptSlug).toBe('lax')
  })

  it('clears per-person variant notes from the original day on a swap', () => {
    const dayWithVarianter: DayMeal = { ...DAY, varianter: { anna: 'byt ut fisken' } }
    const result = applyOverride(dayWithVarianter, makeOverride('hamburgare'), MEALS, RECIPE_INDEX)
    expect(result.varianter).toBeUndefined()
  })

  it('skip attendance clears the dish entirely, taking priority over any override', () => {
    const result = applyOverride(DAY, makeOverride('hamburgare'), MEALS, RECIPE_INDEX, makeAttendance({ skip: true }))
    expect(result.recept).toBeNull()
    expect(result.receptSlug).toBeUndefined()
    expect(result.mealSlug).toBeUndefined()
    expect(result.anteckning).toBe('Ingen måltid behövs')
  })

  it('a non-skip attendance override with no meal override leaves the day dish untouched', () => {
    const result = applyOverride(DAY, undefined, MEALS, RECIPE_INDEX, makeAttendance({ presentIds: ['anna'] }))
    expect(result.recept).toBe('Original dish')
  })
})

describe('effectivePresentIds', () => {
  it('falls back to the plan default when there is no attendance override', () => {
    expect(effectivePresentIds(['anna', 'erik'], undefined)).toEqual(['anna', 'erik'])
  })

  it('falls back to the plan default when presentIds is null (explicit "use the schedule")', () => {
    expect(effectivePresentIds(['anna'], makeAttendance({ presentIds: null }))).toEqual(['anna'])
  })

  it('an explicit non-empty presentIds override wins over the plan default', () => {
    expect(effectivePresentIds(['anna', 'erik'], makeAttendance({ presentIds: ['erik'] }))).toEqual(['erik'])
  })

  it('an explicit empty presentIds array ([]) is falsy and falls back to the plan default', () => {
    // Documents current behaviour: `attendance?.presentIds` on an empty array is truthy in
    // JS (arrays are always truthy), so this actually *does* win — kept as a regression test
    // for that exact fact, since it's easy to assume otherwise.
    expect(effectivePresentIds(['anna'], makeAttendance({ presentIds: [] }))).toEqual([])
  })
})

describe('diffAttendance', () => {
  it('returns no away/extra when there is no override', () => {
    expect(diffAttendance(['anna', 'erik'], undefined)).toEqual({ away: [], extra: [] })
  })

  it('returns no away/extra when presentIds is null', () => {
    expect(diffAttendance(['anna'], makeAttendance({ presentIds: null }))).toEqual({ away: [], extra: [] })
  })

  it('lists someone normally present as "away" when the override drops them', () => {
    const diff = diffAttendance(['anna', 'erik'], makeAttendance({ presentIds: ['anna'] }))
    expect(diff.away).toEqual(['erik'])
    expect(diff.extra).toEqual([])
  })

  it('lists someone not normally present as "extra" when the override adds them', () => {
    const diff = diffAttendance(['anna'], makeAttendance({ presentIds: ['anna', 'gast'] }))
    expect(diff.away).toEqual([])
    expect(diff.extra).toEqual(['gast'])
  })

  it('handles a plan with no default presence at all (treated as an empty list)', () => {
    const diff = diffAttendance(null, makeAttendance({ presentIds: ['gast'] }))
    expect(diff.away).toEqual([])
    expect(diff.extra).toEqual(['gast'])
  })

  it('reports both away and extra together for a full swap', () => {
    const diff = diffAttendance(['anna', 'erik'], makeAttendance({ presentIds: ['gast'] }))
    expect(diff.away).toEqual(['anna', 'erik'])
    expect(diff.extra).toEqual(['gast'])
  })
})
