import { describe, expect, it } from 'vitest'
import { buildDay, buildWeek } from './buildDay'
import { DENTIST, makeData, makeDinner } from './fixtures'
import type { LagetEvent } from './types'

const MON = '2026-11-02'
const TUE = '2026-11-03'
const WED = '2026-11-04'
const MON_LOV = '2026-11-09'

describe('buildDay: timeline', () => {
  it('merges recurring activities and events, ordered by when you must act', () => {
    const view = buildDay(WED, makeData())
    expect(view.timeline.map(t => t.id)).toEqual(['h-2026-11-04-tandlakare', 'barn-a-wed-a6-ht26'])
    expect(view.timeline[0]).toMatchObject({ kind: 'handelse', startTime: '14:30', leaveBy: '14:05', leaveByEffective: '14:05', place: 'Folktandvården' })
    expect(view.timeline[1]).toMatchObject({ kind: 'aktivitet', leaveByEffective: '18:30' })
  })

  it('puts untimed items after timed ones', () => {
    const view = buildDay(MON, makeData())
    const firstUntimed = view.timeline.findIndex(t => t.leaveByEffective === null && t.startTime === null)
    expect(view.timeline.slice(firstUntimed).every(t => t.startTime === null && t.leaveByEffective === null)).toBe(true)
  })

  it('shows an event for someone who is not home, without letting it bind the window', () => {
    const away: LagetEvent = { ...DENTIST, id: 'h-borta', date: TUE, personIds: ['barn-a'], leaveBy: '16:00', affectsWindow: true }
    const view = buildDay(TUE, makeData({ events: [away] }))
    expect(view.timeline.map(t => t.id)).toEqual(['h-borta'])
    expect(view.presence.windowStatus).toBe('OPEN')
  })
})

describe('buildDay: dinner window', () => {
  const baseline = buildDay(WED, makeData({ events: [] })).presence

  it('is unchanged by an event that does not affect the window', () => {
    expect(buildDay(WED, makeData()).presence).toEqual(baseline)
  })

  it('is tightened by an event that does, while its person is home', () => {
    const tight: LagetEvent = { ...DENTIST, id: 'h-tidig', leaveBy: '16:00', affectsWindow: true }
    const p = buildDay(WED, makeData({ events: [tight] })).presence
    expect(p).not.toEqual(baseline)
    expect(p.windowNotes.join('\n')).toContain('Tandläkare')
  })
})

describe('buildDay: breaks', () => {
  it('cancels a pausedOnBreak activity during a lov, keeping the others', () => {
    const during = buildDay(MON_LOV, makeData()).timeline.map(t => t.id)
    expect(during).not.toContain('barn-a-mon-a1-ht26')
    expect(during).toContain('barn-a-mon-a5-ht26')
    expect(buildDay(MON, makeData()).timeline.map(t => t.id)).toContain('barn-a-mon-a1-ht26')
  })
})

describe('buildDay: isChildWeek', () => {
  it('is true when a person with a term is home, false otherwise', () => {
    expect(buildDay(MON, makeData()).isChildWeek).toBe(true)
    expect(buildDay(TUE, makeData()).isChildWeek).toBe(false)
  })
  it('is false when no periods name anyone', () => {
    expect(buildDay(MON, makeData({ periods: [] })).isChildWeek).toBe(false)
  })
})

describe('buildDay: prepare (Imorgon)', () => {
  it('lists what to prepare today for tomorrow, from activities and events', () => {
    const sun = buildDay('2026-11-01', makeData())
    expect(sun.prepareTonight.map(p => [p.key, p.text, p.forDate])).toEqual([
      ['2026-11-01|barn-a-mon-a1-ht26|0', 'Packa gympapåsen', MON],
      ['2026-11-01|barn-a-mon-a5-ht26|0', 'Packa väskan', MON],
    ])
    const tue = buildDay(TUE, makeData())
    expect(tue.prepareTonight).toEqual([
      expect.objectContaining({ key: '2026-11-03|h-2026-11-04-tandlakare|0', text: 'Ta med kallelsen', sourceTitle: 'Tandläkare', forDate: WED, done: false }),
    ])
    expect(tue.tomorrowTeaser).toBe('1 att förbereda')
  })

  it('keeps a ticked item, marked done, and drops the teaser', () => {
    const klart = { '2026-11-03|h-2026-11-04-tandlakare|0': '2026-11-03T19:02:00+01:00' }
    const view = buildDay(TUE, makeData({ klart }))
    expect(view.prepareTonight).toEqual([expect.objectContaining({ done: true })])
    expect(view.tomorrowTeaser).toBeNull()
  })

  it('prepares nothing for an activity that does not happen (paused during a lov)', () => {
    const sun = buildDay('2026-11-08', makeData())
    expect(sun.prepareTonight.map(p => p.sourceId)).toEqual(['barn-a-mon-a5-ht26'])
  })

  it('supports preparing several days ahead and the same day', () => {
    const ev: LagetEvent = { ...DENTIST, prepare: [{ text: 'Boka tid', daysBefore: 3 }, { text: 'Lämna blankett', daysBefore: 0 }] }
    const data = makeData({ events: [ev] })
    expect(buildDay('2026-11-01', data).prepareTonight.some(p => p.text === 'Boka tid' && p.forDate === WED)).toBe(true)
    expect(buildDay(WED, data).prepareTonight.some(p => p.text === 'Lämna blankett')).toBe(true)
  })

  it('prepares a multi-day event only for its first day', () => {
    const camp: LagetEvent = { ...DENTIST, id: 'h-lager', title: 'Läger', date: '2026-11-05', endDate: '2026-11-06', startTime: '09:00', prepare: [{ text: 'Packa', daysBefore: 1 }] }
    const data = makeData({ events: [camp] })
    expect(buildDay(WED, data).prepareTonight.map(p => p.text)).toContain('Packa')
    expect(buildDay('2026-11-05', data).prepareTonight.map(p => p.text)).not.toContain('Packa')
  })
})

describe('buildDay: events over several days', () => {
  const camp: LagetEvent = { ...DENTIST, id: 'h-lager', title: 'Läger', date: '2026-11-05', endDate: '2026-11-06', startTime: '09:00', leaveBy: null, arriveBy: null, endTime: null, prepare: undefined }
  it('shows on every covered day, without times', () => {
    const data = makeData({ events: [camp] })
    for (const d of ['2026-11-05', '2026-11-06']) {
      expect(buildDay(d, data).timeline.find(t => t.id === 'h-lager')).toMatchObject({ startTime: null, leaveByEffective: null })
    }
    expect(buildDay('2026-11-07', data).timeline.some(t => t.id === 'h-lager')).toBe(false)
  })
})

describe('buildDay: todos', () => {
  const todo = (id: string, due: string, done: string | null = null) => ({ id, title: id, due, dueTime: null, done })
  it('returns open todos due today or earlier', () => {
    const data = makeData({ todos: [todo('idag', MON), todo('forsenad', '2026-10-30'), todo('imorgon', TUE), todo('klar', MON, '2026-11-01T10:00:00Z')] })
    expect(buildDay(MON, data).todos.map(t => t.id)).toEqual(['idag', 'forsenad'])
  })
})

describe('buildDay: purity', () => {
  it('does not mutate its input and is deterministic', () => {
    const data = makeData()
    const before = JSON.stringify(data)
    const a = buildDay(WED, data)
    expect(JSON.stringify(data)).toBe(before)
    expect(buildDay(WED, data)).toEqual(a)
  })
  it('works with every optional list empty', () => {
    const data = makeData({ events: [], todos: [], periods: [], klart: {} })
    const v = buildDay(MON, data)
    expect(v.dinner).toBeNull()
    expect(v.prepareTonight).toEqual([])
  })
})

describe('buildDay: dinner', () => {
  it('is null without Matracet data (as in the notification job)', () => {
    expect(buildDay(WED, makeData()).dinner).toBeNull()
  })
  it('carries the planned dish and the day’s eating window', () => {
    const view = buildDay(WED, makeData({ dinner: makeDinner() }))
    expect(view.dinner).toEqual({ title: 'Tacos', eatBy: view.presence.eatEarlyBy, receptSlug: null })
    expect(view.dinner?.eatBy).not.toBeNull()
  })
  it('has no eating window to report on an open day', () => {
    const view = buildDay('2026-11-10', makeData({ dinner: makeDinner({ weekplan: { '2026-11-10': { dinner: { mealSlug: 'tacos', receptSlug: null } } } }) }))
    expect(view.presence.windowStatus).toBe('OPEN')
    expect(view.dinner).toEqual({ title: 'Tacos', eatBy: null, receptSlug: null })
  })
})

describe('buildWeek', () => {
  it('builds consecutive days, each the same as buildDay on its own', () => {
    const data = makeData()
    const week = buildWeek(MON, data)
    expect(week.map(d => d.date)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'])
    expect(week[2]).toEqual(buildDay(WED, data))
    expect(buildWeek(MON, data, 14)).toHaveLength(14)
  })
})
