import { describe, expect, it } from 'vitest'
import { buildDay } from './buildDay'
import { makeData, makeDinner } from './fixtures'
import { dayLines, headline, topLines } from './summary'

describe('headline', () => {
  it('names the week type and counts timed things', () => {
    expect(headline(buildDay('2026-11-04', makeData()))).toBe('Barnvecka · 2 saker idag')
  })
  it('handles one thing, none, and a week without kids', () => {
    expect(headline(buildDay('2026-11-03', makeData({ events: [] })))).toBe('Ej barnvecka · inget inplanerat')
    const one = makeData()
    one.schema.activities = one.schema.activities!.filter(a => a.id !== 'barn-a-wed-a6-ht26')
    expect(headline(buildDay('2026-11-04', one))).toBe('Barnvecka · 1 sak idag')
  })
  it('counts open to-dos', () => {
    const data = makeData({ events: [], todos: [{ id: 't', title: 'Förnya busskortet', due: '2026-11-03', dueTime: null, done: null }] })
    expect(headline(buildDay('2026-11-03', data))).toBe('Ej barnvecka · 1 sak idag')
  })
})

describe('topLines', () => {
  it('gives the three most urgent lines in the spec’s format', () => {
    const lines = topLines(buildDay('2026-11-04', makeData()))
    expect(lines[0]).toEqual({ kind: 'tid', text: 'Tandläkare 14:30, åk 14:05', time: '14:05' })
    expect(lines).toHaveLength(2)
  })
  it('skips what is already over when given the time', () => {
    const lines = topLines(buildDay('2026-11-04', makeData()), 3, '16:00')
    expect(lines.map(l => l.text)).toEqual([expect.stringContaining('Aktivitet F')])
  })
  it('lists overdue to-dos after the timed items, flagged', () => {
    const data = makeData({ todos: [{ id: 't', title: 'Lämna boken', due: '2026-11-01', dueTime: null, done: null }] })
    const lines = topLines(buildDay('2026-11-04', data))
    expect(lines[lines.length - 1]).toEqual({ kind: 'gora', text: 'Lämna boken (försenad)', time: null })
  })
})

describe('dayLines', () => {
  it('lists timed items, open to-dos and the dinner, one short line each', () => {
    const data = makeData({
      dinner: makeDinner(),
      todos: [{ id: 't', title: 'Lämna boken', due: '2026-11-04', dueTime: null, done: null }],
    })
    expect(dayLines(buildDay('2026-11-04', data))).toEqual([
      'Tandläkare 14:30',
      expect.stringMatching(/^Aktivitet F 18:45$/),
      'Lämna boken (att göra)',
      'Middag: Tacos',
    ])
  })
  it('is empty on a day with nothing', () => {
    expect(dayLines(buildDay('2026-11-10', makeData({ events: [] })))).toEqual([])
  })
})
