import { describe, it, expect } from 'vitest'
import { distributeToSlots } from './distribute'

describe('distributeToSlots', () => {
  const slots = [
    { date: '2026-11-22', kind: 'lunch' as const, fast: false },
    { date: '2026-11-23', kind: 'dinner' as const, fast: false },
    { date: '2026-11-22', kind: 'dinner' as const, fast: true },
  ]
  it('fills dinners first, chronological; fast slot gets fastest', () => {
    const r = distributeToSlots([{ id: 'a', tidMin: 60 }, { id: 'b', tidMin: 15 }, { id: 'c', tidMin: 40 }], slots)
    expect(r).toEqual([
      { entryId: 'b', date: '2026-11-22', kind: 'dinner' },
      { entryId: 'a', date: '2026-11-23', kind: 'dinner' },
      { entryId: 'c', date: '2026-11-22', kind: 'lunch' },
    ])
  })
  it('saves quick dishes for fast slots and treats null as slow', () => {
    const r = distributeToSlots([{ id: 'q', tidMin: 10 }, { id: 'n', tidMin: null }], slots)
    expect(r[0]).toEqual({ entryId: 'q', date: '2026-11-22', kind: 'dinner' })
    expect(r[1].entryId).toBe('n')
  })
  it('stops when either side runs out, never reuses', () => {
    expect(distributeToSlots([{ id: 'a', tidMin: 1 }], slots)).toHaveLength(1)
    expect(distributeToSlots([], slots)).toEqual([])
    const ids = distributeToSlots([{ id: 'a', tidMin: 1 }, { id: 'b', tidMin: 2 }, { id: 'c', tidMin: 3 }, { id: 'd', tidMin: 4 }], slots).map(x => x.entryId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
