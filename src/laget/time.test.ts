import { describe, expect, it } from 'vitest'
import { stockholmNow } from './time'

describe('stockholmNow', () => {
  it('uses CET in winter (UTC+1)', () => {
    expect(stockholmNow(new Date('2026-12-01T22:30:00Z'))).toEqual({ date: '2026-12-01', time: '23:30' })
    expect(stockholmNow(new Date('2026-12-01T23:30:00Z'))).toEqual({ date: '2026-12-02', time: '00:30' })
  })
  it('uses CEST in summer (UTC+2): the date rolls over at 22:00 UTC', () => {
    expect(stockholmNow(new Date('2026-07-01T21:59:00Z'))).toEqual({ date: '2026-07-01', time: '23:59' })
    expect(stockholmNow(new Date('2026-07-01T22:00:00Z'))).toEqual({ date: '2026-07-02', time: '00:00' })
  })
  it('handles the autumn change on 2026-10-25 (03:00 CEST → 02:00 CET at 01:00 UTC)', () => {
    expect(stockholmNow(new Date('2026-10-25T00:30:00Z'))).toEqual({ date: '2026-10-25', time: '02:30' })
    expect(stockholmNow(new Date('2026-10-25T01:30:00Z'))).toEqual({ date: '2026-10-25', time: '02:30' })
    expect(stockholmNow(new Date('2026-10-25T23:30:00Z'))).toEqual({ date: '2026-10-26', time: '00:30' })
  })
  it('handles the spring change on 2026-03-29 (02:00 CET → 03:00 CEST at 01:00 UTC)', () => {
    expect(stockholmNow(new Date('2026-03-29T00:59:00Z'))).toEqual({ date: '2026-03-29', time: '01:59' })
    expect(stockholmNow(new Date('2026-03-29T01:00:00Z'))).toEqual({ date: '2026-03-29', time: '03:00' })
  })
})
