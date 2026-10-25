import { describe, expect, it } from 'vitest'
import { validateEvents, validateTodos } from './validate'
import { DENTIST } from './fixtures'
import type { Todo } from './types'

const PEOPLE = ['barn-a', 'barn-b']
const todo = (over: Partial<Todo> = {}): Todo => ({ id: 't', title: 'X', due: '2026-11-25', dueTime: null, done: null, ...over })

describe('validateEvents', () => {
  it('accepts a good event', () => expect(validateEvents([DENTIST], PEOPLE)).toEqual([]))
  it('flags bad dates, times, people, prepare and duplicates', () => {
    const bad = [
      { ...DENTIST, id: 'a', date: '2026-02-30', startTime: '7:30', personIds: ['ingen'], prepare: [{ text: ' ', daysBefore: 30 }] },
      { ...DENTIST, id: 'a', endDate: '2026-11-01' },
    ]
    const out = validateEvents(bad, PEOPLE).join('\n')
    for (const part of ['ogiltigt date', 'startTime="7:30"', 'okänd person "ingen"', 'saknar text', 'daysBefore måste vara 0–14', 'dubblett-id', 'endDate före date']) {
      expect(out, part).toContain(part)
    }
  })
})

describe('validateTodos', () => {
  it('accepts the spec example', () => {
    const t = todo({ remind: [{ before: 'P3D', at: '07:30' }, { before: 'P0D', at: '07:30' }], repeat: { every: 'P1M', from: 'done' }, personIds: ['barn-a'] })
    expect(validateTodos([t], PEOPLE)).toEqual([])
  })
  it('flags malformed reminders, repeats, times and people', () => {
    const t = todo({
      due: 'imorgon', dueTime: '4pm', personIds: ['ingen'],
      remind: [{ before: 'tre dagar', at: '7.30' }],
      repeat: { every: 'varje månad', from: 'whenever' as 'done' },
    })
    const out = validateTodos([t], PEOPLE).join('\n')
    for (const part of ['ogiltigt due', 'dueTime="4pm"', 'ingen ISO-varaktighet', 'at="7.30"', 'repeat.from', 'okänd person']) {
      expect(out, part).toContain(part)
    }
  })
  it('rejects a zero repeat and duplicate ids', () => {
    expect(validateTodos([todo({ repeat: { every: 'P0D', from: 'done' } })], PEOPLE).join()).toContain('inte vara noll')
    expect(validateTodos([todo(), todo()], PEOPLE).join()).toContain('dubblett-id')
  })
})
