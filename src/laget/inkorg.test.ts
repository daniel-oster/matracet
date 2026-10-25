import { describe, expect, it } from 'vitest'
import { MAX_TEXT, latestMessages, newMessage, newMessageId, staleNew, statusLine, type InkorgMeddelande } from './inkorg'

const m = (over: Partial<InkorgMeddelande>): InkorgMeddelande => ({ id: 'i-20261025-0931-x7k', sent: '2026-10-25T08:31:12.000Z', text: 'hej', status: 'ny', ...over })

describe('newMessageId', () => {
  it('is Stockholm date and time plus three characters, like the spec’s example', () => {
    // 08:31Z on 25 Oct 2026 is 09:31 CET (the clocks went back that night).
    expect(newMessageId(new Date('2026-10-25T08:31:12Z'), () => 0.5)).toBe('i-20261025-0931-sss')
  })
  it('uses Stockholm time around midnight, so ids keep sorting by when they were sent', () => {
    expect(newMessageId(new Date('2026-12-01T23:30:00Z'), () => 0)).toBe('i-20261202-0030-aaa')
  })
  it('sorts by time across a day and across the summer-time change', () => {
    const ids = ['2026-10-24T22:30:00Z', '2026-10-25T08:00:00Z', '2026-10-25T20:00:00Z'].map(t => newMessageId(new Date(t), () => 0))
    expect([...ids].sort()).toEqual(ids)
  })
})

describe('newMessage', () => {
  it('trims, stamps and marks it ny', () => {
    expect(newMessage('  Förnya busskortet  ', new Date('2026-10-25T08:31:12Z'), () => 0)).toEqual({
      id: 'i-20261025-0931-aaa', sent: '2026-10-25T08:31:12.000Z', text: 'Förnya busskortet', status: 'ny',
    })
  })
  it('refuses empty and over-long text', () => {
    expect(newMessage('   ', new Date())).toBeNull()
    expect(newMessage('x'.repeat(MAX_TEXT + 1), new Date())).toBeNull()
    expect(newMessage('x'.repeat(MAX_TEXT), new Date())).not.toBeNull()
  })
})

describe('latestMessages', () => {
  it('returns the newest three, newest first', () => {
    const all = ['a', 'd', 'b', 'c'].map(s => m({ id: `i-2026-${s}` }))
    expect(latestMessages(all).map(x => x.id)).toEqual(['i-2026-d', 'i-2026-c', 'i-2026-b'])
    expect(all.map(x => x.id)).toEqual(['i-2026-a', 'i-2026-d', 'i-2026-b', 'i-2026-c'])
  })
})

describe('staleNew', () => {
  const now = new Date('2026-10-25T08:50:00Z')
  it('finds ny messages older than 15 minutes, and only those', () => {
    const fresh = m({ id: 'a', sent: '2026-10-25T08:40:00Z' })
    const old = m({ id: 'b', sent: '2026-10-25T08:30:00Z' })
    const done = m({ id: 'c', sent: '2026-10-25T08:00:00Z', status: 'klar' })
    expect(staleNew([fresh, old, done], now).map(x => x.id)).toEqual(['b'])
  })
  it('includes the boundary (exactly 15 minutes)', () => {
    expect(staleNew([m({ sent: '2026-10-25T08:35:00Z' })], now)).toHaveLength(1)
  })
})

describe('statusLine', () => {
  it('shows each state the way the spec’s sketch does', () => {
    expect(statusLine(m({}))).toBe('Skickat: hej')
    expect(statusLine(m({ status: 'klar', reply: 'Inlagt: Förnya busskortet 25/11' }))).toBe('Inlagt: Förnya busskortet 25/11')
    expect(statusLine(m({ status: 'klar', reply: 'Förnya busskortet 25/11' }))).toBe('Inlagt: Förnya busskortet 25/11')
    expect(statusLine(m({ status: 'oklar', reply: 'vilken tid är mötet?' }))).toBe('Oklart: vilken tid är mötet?')
    expect(statusLine(m({ status: 'fel', reply: 'schemat blev ogiltigt' }))).toBe('Gick inte: schemat blev ogiltigt')
  })
  it('has a fallback when Claude left no reply', () => {
    expect(statusLine(m({ status: 'oklar' }))).toContain('skriv gärna om')
    expect(statusLine(m({ status: 'fel' }))).toBe('Gick inte: kunde inte behandlas')
    expect(statusLine(m({ status: 'klar', text: 'busskort' }))).toBe('Inlagt: busskort')
  })
})
