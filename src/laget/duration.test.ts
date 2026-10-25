import { describe, expect, it } from 'vitest'
import { addDuration, parseDuration, subtractDuration } from './duration'

describe('parseDuration', () => {
  it('reads days, weeks, months, years and combinations', () => {
    expect(parseDuration('P3D')).toEqual({ years: 0, months: 0, days: 3 })
    expect(parseDuration('P0D')).toEqual({ years: 0, months: 0, days: 0 })
    expect(parseDuration('P2W')).toEqual({ years: 0, months: 0, days: 14 })
    expect(parseDuration('P1M')).toEqual({ years: 0, months: 1, days: 0 })
    expect(parseDuration('P1Y2M10D')).toEqual({ years: 1, months: 2, days: 10 })
  })
  it('rejects anything else', () => {
    for (const bad of ['', 'P', '3D', 'P3', 'PT5M', 'p3d', 'P-1D', 'P1.5D']) expect(parseDuration(bad), bad).toBeNull()
  })
})

describe('date arithmetic', () => {
  const d = (s: string) => parseDuration(s)!
  it('adds days across month and year ends', () => {
    expect(addDuration('2026-12-30', d('P3D'))).toBe('2027-01-02')
    expect(subtractDuration('2026-03-02', d('P3D'))).toBe('2026-02-27')
  })
  it('adds months, clamping to the target month length', () => {
    expect(addDuration('2026-10-25', d('P1M'))).toBe('2026-11-25')
    expect(addDuration('2026-01-31', d('P1M'))).toBe('2026-02-28')
    expect(addDuration('2028-01-31', d('P1M'))).toBe('2028-02-29')
    expect(addDuration('2026-12-15', d('P1M'))).toBe('2027-01-15')
    expect(addDuration('2026-11-30', d('P3M'))).toBe('2027-02-28')
  })
  it('adds years, including a leap day', () => {
    expect(addDuration('2028-02-29', d('P1Y'))).toBe('2029-02-28')
  })
  it('subtracts months and crosses the year boundary', () => {
    expect(subtractDuration('2027-01-15', d('P1M'))).toBe('2026-12-15')
  })
})
