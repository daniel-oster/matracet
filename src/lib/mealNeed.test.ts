import { describe, it, expect } from 'vitest'
import { isoWeekday, isTermDate, isSchoolDay, scheduleSkipsMeal, type TermPeriod } from './mealNeed'

const KIDS = ['daniel', 'sarah', 'annabelle']
const NO_KIDS = ['daniel', 'erika']

describe('isoWeekday', () => {
  it('maps Sunday to 7, not 0', () => {
    expect(isoWeekday('2026-09-13')).toBe(7)
    expect(isoWeekday('2026-09-14')).toBe(1)
    expect(isoWeekday('2026-09-18')).toBe(5)
    expect(isoWeekday('2026-09-19')).toBe(6)
  })
})

describe('isTermDate', () => {
  it('covers the autumn term from 2026-08-17 onwards', () => {
    expect(isTermDate('2026-09-14')).toBe(true)
    expect(isTermDate('2026-08-17')).toBe(true)
  })
  it('excludes the summer gap between the two terms', () => {
    expect(isTermDate('2026-07-01')).toBe(false)
    expect(isTermDate('2026-08-16')).toBe(false)
  })
  it('covers the spring term', () => {
    expect(isTermDate('2026-03-10')).toBe(true)
    expect(isTermDate('2026-06-02')).toBe(false)
  })
})

describe('isSchoolDay', () => {
  it('is true Mon–Fri in term, false on the weekend', () => {
    expect(isSchoolDay('2026-09-14')).toBe(true)   // Monday
    expect(isSchoolDay('2026-09-18')).toBe(true)   // Friday
    expect(isSchoolDay('2026-09-19')).toBe(false)  // Saturday
    expect(isSchoolDay('2026-09-20')).toBe(false)  // Sunday
  })
  it('is false on a weekday outside term', () => {
    expect(isSchoolDay('2026-07-08')).toBe(false)
  })
})

describe('scheduleSkipsMeal', () => {
  it('skips a term-weekday lunch when the kids are here (the reported case)', () => {
    expect(scheduleSkipsMeal('2026-09-14', 'lunch', KIDS)).toBe(true)
  })
  it('never skips dinner', () => {
    expect(scheduleSkipsMeal('2026-09-14', 'dinner', KIDS)).toBe(false)
  })
  it('leaves the weekend alone', () => {
    expect(scheduleSkipsMeal('2026-09-19', 'lunch', KIDS)).toBe(false)
    expect(scheduleSkipsMeal('2026-09-20', 'lunch', KIDS)).toBe(false)
  })
  it('leaves a mother-week weekday lunch alone — the rule is scoped to barnveckor', () => {
    expect(scheduleSkipsMeal('2026-09-15', 'lunch', NO_KIDS)).toBe(false)
  })
  it('fires when only one of the two kids is here', () => {
    expect(scheduleSkipsMeal('2026-09-16', 'lunch', ['daniel', 'annabelle'])).toBe(true)
  })
  it('does not skip outside term — a summer weekday lunch is still needed', () => {
    expect(scheduleSkipsMeal('2026-07-08', 'lunch', KIDS)).toBe(false)
  })
  it('never skips when attendance is unknown', () => {
    expect(scheduleSkipsMeal('2026-09-14', 'lunch', null)).toBe(false)
  })
  it('never skips when nobody is present at all', () => {
    expect(scheduleSkipsMeal('2026-09-14', 'lunch', [])).toBe(false)
  })
  it('honours injected term periods rather than only the built-in ones', () => {
    const periods: TermPeriod[] = [{ id: 't', label: 'T', from: '2027-01-11', until: '2027-06-11' }]
    expect(scheduleSkipsMeal('2026-09-14', 'lunch', KIDS, periods)).toBe(false)
    expect(scheduleSkipsMeal('2027-02-01', 'lunch', KIDS, periods)).toBe(true)
  })
})
