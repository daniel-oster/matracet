import { describe, expect, it } from 'vitest'
import { dateLabel, dinnerHref, dinnerText, windowLine, withKlart } from './format'
import type { DayView } from './types'
import type { DayPlan } from '../presence/types'

const plan = (over: Partial<DayPlan>): DayPlan => ({
  date: '2026-11-04', activeGroup: null, presentPersons: [{ id: 'a', name: 'A' }], portions: 1, activitiesToday: [],
  windowStatus: 'OPEN', windowEndsBy: null, eatEarlyBy: null, windowNotes: [], ...over,
})

describe('dateLabel', () => {
  it('is a capitalised Swedish weekday, day and short month', () => {
    expect(dateLabel('2026-11-04')).toBe('Onsdag 4 nov')
    expect(dateLabel('2026-03-29')).toBe('Söndag 29 mars')
  })
})

describe('windowLine', () => {
  it('names the cutoff for a bounded day and the early time for a conflict day', () => {
    expect(windowLine(plan({ windowStatus: 'BOUNDED', windowEndsBy: '18:30' }))).toBe('Ät senast 18:30')
    expect(windowLine(plan({ windowStatus: 'CONFLICT', eatEarlyBy: '17:15' }))).toBe('Ät tidigt – senast 17:15')
  })
  it('says nothing for an open day or when nobody is home', () => {
    expect(windowLine(plan({}))).toBeNull()
    expect(windowLine(plan({ presentPersons: [], windowStatus: 'BOUNDED', windowEndsBy: '18:30' }))).toBeNull()
  })
})

describe('withKlart', () => {
  it('ticks, keeping an existing timestamp, and un-ticks', () => {
    const a = withKlart({}, 'k', true, 't1')
    expect(a).toEqual({ k: 't1' })
    expect(withKlart(a, 'k', true, 't2')).toBe(a)
    expect(withKlart(a, 'k', false, 't3')).toEqual({})
    expect(withKlart({}, 'k', false, 't')).toEqual({})
  })
  it('does not mutate', () => {
    const a = { k: 't' }
    withKlart(a, 'k', false, 'x')
    expect(a).toEqual({ k: 't' })
  })
})

describe('dinnerText', () => {
  const view = (dinner: DayView['dinner'], presence: Partial<DayPlan>): DayView => ({
    date: '2026-11-04', presence: plan(presence), isChildWeek: true, timeline: [], todos: [], prepareTonight: [], dinner, tomorrowTeaser: null,
  })
  it('combines the dish with the eating window', () => {
    expect(dinnerText(view({ title: 'Tacos', eatBy: '17:15' }, { windowStatus: 'CONFLICT', eatEarlyBy: '17:15' }))).toBe('Tacos, ät tidigt – senast 17:15')
    expect(dinnerText(view({ title: 'Tacos', eatBy: '18:30' }, { windowStatus: 'BOUNDED', windowEndsBy: '18:30' }))).toBe('Tacos, ät senast 18:30')
  })
  it('is just the dish on an open day, just the window with no dish, nothing with neither', () => {
    expect(dinnerText(view({ title: 'Tacos', eatBy: null }, {}))).toBe('Tacos')
    expect(dinnerText(view(null, { windowStatus: 'BOUNDED', windowEndsBy: '18:30' }))).toBe('ät senast 18:30')
    expect(dinnerText(view(null, {}))).toBeNull()
  })
})

describe('dinnerHref', () => {
  const withDinner = (dinner: DayView['dinner']): DayView => ({ dinner } as unknown as DayView)
  it('opens the recipe in Matracet when one is behind the dish', () => {
    expect(dinnerHref(withDinner({ title: 'Linsgryta', eatBy: null, receptSlug: 'linsgryta-kokos' }), '/matracet/')).toBe('/matracet/recept/linsgryta-kokos/')
  })
  it('has no link for a dish without a recipe', () => {
    expect(dinnerHref(withDinner({ title: 'Tacos', eatBy: null, receptSlug: null }), '/matracet/')).toBeNull()
    expect(dinnerHref(withDinner({ title: 'Tacos', eatBy: null }), '/matracet/')).toBeNull()
  })
  it('has nothing to open when nothing is planned or no meal is needed', () => {
    expect(dinnerHref(withDinner(null), '/matracet/')).toBeNull()
    expect(dinnerHref(withDinner({ title: 'Ingen måltid behövs', eatBy: null }), '/matracet/')).toBeNull()
  })
})
