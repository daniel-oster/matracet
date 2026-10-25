import { describe, expect, it } from 'vitest'
import { completeTodo, dueWords, nextDue, reminders, seriesId } from './todos'
import type { Todo } from './types'

const todo = (over: Partial<Todo> = {}): Todo => ({ id: 't-busskort', title: 'Förnya busskortet', due: '2026-11-25', dueTime: null, done: null, ...over })
// 2026-11-26 12:00 Stockholm = 11:00Z
const NOW = new Date('2026-11-26T11:00:00Z')

describe('completeTodo', () => {
  it('ticks a plain to-do and adds nothing', () => {
    const out = completeTodo([todo()], 't-busskort', NOW)
    expect(out).toEqual([todo({ done: NOW.toISOString() })])
  })

  it('repeat from done: the next one counts from the day it was ticked', () => {
    const t = todo({ repeat: { every: 'P1M', from: 'done' }, remind: [{ before: 'P3D', at: '07:30' }] })
    const out = completeTodo([t], 't-busskort', NOW)
    expect(out).toHaveLength(2)
    expect(out[0].done).toBe(NOW.toISOString())
    expect(out[1]).toEqual({ ...t, id: 't-busskort@2026-12-26', due: '2026-12-26', done: null })
  })

  it('repeat from due: counts from the due date, not from when it was ticked', () => {
    const t = todo({ repeat: { every: 'P1M', from: 'due' } })
    expect(completeTodo([t], 't-busskort', NOW)[1].due).toBe('2026-12-25')
  })

  it('repeat from due skips occurrences already in the past when ticked very late', () => {
    const t = todo({ due: '2026-08-25', repeat: { every: 'P1M', from: 'due' } })
    expect(completeTodo([t], 't-busskort', NOW)[1].due).toBe('2026-12-25')
  })

  it('is idempotent: re-ticking, an unknown id, or a retry on fresher data change nothing', () => {
    const once = completeTodo([todo({ repeat: { every: 'P1M', from: 'done' } })], 't-busskort', NOW)
    expect(completeTodo(once, 't-busskort', NOW)).toBe(once)
    expect(completeTodo(once, 'finns-inte', NOW)).toBe(once)
    const openAgain = once.map(t => (t.id === 't-busskort' ? { ...t, done: null } : t))
    // the next occurrence already exists → ticking again does not create a duplicate
    expect(completeTodo(openAgain, 't-busskort', NOW).filter(t => t.id.startsWith('t-busskort@'))).toHaveLength(1)
  })

  it('does not mutate its input', () => {
    const input = [todo({ repeat: { every: 'P1W', from: 'done' } })]
    const before = JSON.stringify(input)
    completeTodo(input, 't-busskort', NOW)
    expect(JSON.stringify(input)).toBe(before)
  })

  it('a malformed or zero repeat just ticks', () => {
    expect(completeTodo([todo({ repeat: { every: 'varje månad', from: 'done' } })], 't-busskort', NOW)).toHaveLength(1)
    expect(completeTodo([todo({ repeat: { every: 'P0D', from: 'done' } })], 't-busskort', NOW)).toHaveLength(1)
  })

  it('uses the Stockholm date for "done", not UTC (ticked just after midnight local time)', () => {
    const t = todo({ repeat: { every: 'P1D', from: 'done' } })
    const late = new Date('2026-11-26T23:30:00Z') // 00:30 on the 27th in Stockholm
    expect(completeTodo([t], 't-busskort', late)[1].due).toBe('2026-11-28')
  })
})

describe('series ids and nextDue', () => {
  it('seriesId strips the occurrence suffix', () => {
    expect(seriesId('t-busskort@2026-12-25')).toBe('t-busskort')
    expect(seriesId('t-busskort')).toBe('t-busskort')
  })
  it('nextDue is null without a usable repeat', () => {
    expect(nextDue(todo(), '2026-11-26')).toBeNull()
  })
})

describe('reminders', () => {
  it('turns relative reminders into dates and times, skipping malformed ones', () => {
    const t = todo({ remind: [{ before: 'P3D', at: '07:30' }, { before: 'P0D', at: '07:30' }, { before: 'snart', at: '07:30' }] })
    expect(reminders(t)).toEqual([
      { date: '2026-11-22', at: '07:30', before: 'P3D' },
      { date: '2026-11-25', at: '07:30', before: 'P0D' },
    ])
  })
  it('is empty without remind', () => {
    expect(reminders(todo())).toEqual([])
  })
})

describe('dueWords', () => {
  it('says idag / imorgon / om N dagar / försenad', () => {
    expect(dueWords('2026-11-25', '2026-11-25')).toBe('idag')
    expect(dueWords('2026-11-26', '2026-11-25')).toBe('imorgon')
    expect(dueWords('2026-11-28', '2026-11-25')).toBe('om 3 dagar')
    expect(dueWords('2026-11-20', '2026-11-25')).toBe('försenad')
  })
})
