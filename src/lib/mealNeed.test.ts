import { describe, it, expect } from 'vitest'
import { isoWeekday, isSchoolDayFor, scheduleSkipsMeal } from './mealNeed'
import type { Period } from '../presence/types'

const KIDS = ['vuxen-a', 'barn-a', 'barn-b']
const NO_KIDS = ['vuxen-a', 'vuxen-b']

const PERIODS: Period[] = [
  { id: 'vt', kind: 'termin', name: 'Vårtermin', from: '2026-01-07', to: '2026-06-01', personIds: ['barn-a', 'barn-b'] },
  { id: 'ht', kind: 'termin', name: 'Hösttermin', from: '2026-08-17', to: null, personIds: ['barn-a', 'barn-b'] },
  { id: 'lov', kind: 'lov', name: 'Höstlov', from: '2026-10-26', to: '2026-10-30', personIds: ['barn-a', 'barn-b'] },
]

describe('isoWeekday', () => {
  it('maps Sunday to 7, not 0', () => {
    expect(isoWeekday('2026-09-13')).toBe(7)
    expect(isoWeekday('2026-09-14')).toBe(1)
    expect(isoWeekday('2026-09-18')).toBe(5)
    expect(isoWeekday('2026-09-19')).toBe(6)
  })
})

describe('isSchoolDayFor', () => {
  it('is true Mon–Fri in term, false on the weekend', () => {
    expect(isSchoolDayFor('2026-09-14', 'barn-a', PERIODS)).toBe(true)   // Monday
    expect(isSchoolDayFor('2026-09-18', 'barn-a', PERIODS)).toBe(true)   // Friday
    expect(isSchoolDayFor('2026-09-19', 'barn-a', PERIODS)).toBe(false)  // Saturday
    expect(isSchoolDayFor('2026-09-20', 'barn-a', PERIODS)).toBe(false)  // Sunday
  })
  it('covers both terms but not the summer gap between them', () => {
    expect(isSchoolDayFor('2026-03-10', 'barn-a', PERIODS)).toBe(true)
    expect(isSchoolDayFor('2026-06-02', 'barn-a', PERIODS)).toBe(false)
    expect(isSchoolDayFor('2026-08-14', 'barn-a', PERIODS)).toBe(false)
    expect(isSchoolDayFor('2026-08-17', 'barn-a', PERIODS)).toBe(true)
  })
  it('is false on a weekday inside a break, and true again the day after it', () => {
    expect(isSchoolDayFor('2026-10-26', 'barn-a', PERIODS)).toBe(false)
    expect(isSchoolDayFor('2026-10-30', 'barn-a', PERIODS)).toBe(false)
    expect(isSchoolDayFor('2026-11-02', 'barn-a', PERIODS)).toBe(true)
  })
  it('only applies to the people a period names', () => {
    expect(isSchoolDayFor('2026-09-14', 'vuxen-a', PERIODS)).toBe(false)
    expect(isSchoolDayFor('2026-10-27', 'barn-a', [{ ...PERIODS[2], personIds: ['barn-b'] }, PERIODS[1]])).toBe(true)
  })
})

describe('scheduleSkipsMeal', () => {
  it('skips a term-weekday lunch when the kids are here (the reported case)', () => {
    expect(scheduleSkipsMeal('2026-09-14', 'lunch', KIDS, PERIODS)).toBe(true)
  })
  it('never skips dinner', () => {
    expect(scheduleSkipsMeal('2026-09-14', 'dinner', KIDS, PERIODS)).toBe(false)
  })
  it('leaves the weekend alone', () => {
    expect(scheduleSkipsMeal('2026-09-19', 'lunch', KIDS, PERIODS)).toBe(false)
    expect(scheduleSkipsMeal('2026-09-20', 'lunch', KIDS, PERIODS)).toBe(false)
  })
  it('leaves a mother-week weekday lunch alone — the rule is scoped to barnveckor', () => {
    expect(scheduleSkipsMeal('2026-09-15', 'lunch', NO_KIDS, PERIODS)).toBe(false)
  })
  it('fires when only one of the two kids is here', () => {
    expect(scheduleSkipsMeal('2026-09-16', 'lunch', ['vuxen-a', 'barn-b'], PERIODS)).toBe(true)
  })
  it('does not skip outside term — a summer weekday lunch is still needed', () => {
    expect(scheduleSkipsMeal('2026-07-08', 'lunch', KIDS, PERIODS)).toBe(false)
  })
  it('does not skip during a break — lunch is needed at home (höstlov)', () => {
    expect(scheduleSkipsMeal('2026-10-27', 'lunch', KIDS, PERIODS)).toBe(false)
    expect(scheduleSkipsMeal('2026-11-03', 'lunch', KIDS, PERIODS)).toBe(true)
  })
  it('never skips when attendance is unknown', () => {
    expect(scheduleSkipsMeal('2026-09-14', 'lunch', null, PERIODS)).toBe(false)
  })
  it('never skips when nobody is present at all', () => {
    expect(scheduleSkipsMeal('2026-09-14', 'lunch', [], PERIODS)).toBe(false)
  })
  it('never skips without periods (no token / not loaded)', () => {
    expect(scheduleSkipsMeal('2026-09-14', 'lunch', KIDS, null)).toBe(false)
    expect(scheduleSkipsMeal('2026-09-14', 'lunch', KIDS, [])).toBe(false)
  })
})
