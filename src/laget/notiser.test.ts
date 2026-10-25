import { describe, expect, it } from 'vitest'
import { DEFAULT_INSTALLNINGAR, GRACE_MINUTES, dueNotifications, recordSent, withNotisTimes, type Installningar } from './notiser'
import { makeData } from './fixtures'

// Wed 2026-11-04 is a barnvecka with the dentist at 14:30; Tue 2026-11-03 prepares for it.
// Winter: Stockholm = UTC+1.
const at = (iso: string) => new Date(iso)
const EMPTY = { skickade: [] }
const keys = (d: ReturnType<typeof dueNotifications>) => d.map(n => n.key)

describe('dueNotifications: Läget idag', () => {
  const data = makeData()
  it('is not due before its time', () => {
    expect(dueNotifications(at('2026-11-04T05:39:00Z'), data, DEFAULT_INSTALLNINGAR, EMPTY)).toEqual([])  // 06:39
  })
  it('fires at and just after its time, with a link and the headline', () => {
    const [n] = dueNotifications(at('2026-11-04T05:55:00Z'), data, DEFAULT_INSTALLNINGAR, EMPTY)           // 06:55
    expect(n).toEqual({
      key: '2026-11-04|idag',
      title: 'Läget idag',
      body: 'Barnvecka · 2 saker idag',
      url: '/matracet/laget/?vy=idag',
      tag: 'laget-idag',
    })
  })
  it('is dropped once the grace period has passed (a late run must not ping at lunch)', () => {
    const late = new Date(at('2026-11-04T05:40:00Z').getTime() + GRACE_MINUTES * 60_000)
    expect(dueNotifications(late, data, DEFAULT_INSTALLNINGAR, EMPTY)).toEqual([])
    const justInside = new Date(late.getTime() - 60_000)
    expect(keys(dueNotifications(justInside, data, DEFAULT_INSTALLNINGAR, EMPTY))).toEqual(['2026-11-04|idag'])
  })
  it('is never repeated once logged', () => {
    const log = { skickade: [{ key: '2026-11-04|idag', sent: '2026-11-04T05:41:00Z' }] }
    expect(dueNotifications(at('2026-11-04T05:50:00Z'), data, DEFAULT_INSTALLNINGAR, log)).toEqual([])
  })
  it('uses Stockholm time, not UTC: the same instant is a different day around midnight', () => {
    // 2026-11-04T23:10Z is 00:10 on the 5th in Stockholm — nothing is due, and certainly not the 4th's.
    expect(dueNotifications(at('2026-11-04T23:10:00Z'), data, DEFAULT_INSTALLNINGAR, EMPTY)).toEqual([])
  })
  it('follows summer time: 06:40 CEST is 04:40 UTC', () => {
    const summer: Installningar = DEFAULT_INSTALLNINGAR
    expect(dueNotifications(at('2026-07-01T04:30:00Z'), makeData(), summer, EMPTY)).toEqual([])
    expect(keys(dueNotifications(at('2026-07-01T04:45:00Z'), makeData(), summer, EMPTY))).toEqual(['2026-07-01|idag'])
  })
  it('ignores a malformed time instead of firing at the wrong moment', () => {
    const bad: Installningar = { notiser: { idag: '6:40', imorgon: 'kvart i fyra' } }
    expect(dueNotifications(at('2026-11-04T06:00:00Z'), data, bad, EMPTY)).toEqual([])
    expect(dueNotifications(at('2026-11-04T15:00:00Z'), data, bad, EMPTY)).toEqual([])
  })
})

describe('dueNotifications: Läget imorgon', () => {
  it('names tomorrow and what to prepare tonight', () => {
    const [n] = dueNotifications(at('2026-11-03T14:50:00Z'), makeData(), DEFAULT_INSTALLNINGAR, EMPTY)      // Tue 15:50
    expect(n).toMatchObject({
      key: '2026-11-03|imorgon',
      title: 'Läget imorgon',
      body: '2 saker imorgon · 1 att förbereda',
      url: '/matracet/laget/?vy=imorgon',
    })
  })
  it('stops counting a preparation once it is ticked', () => {
    const data = makeData({ klart: { '2026-11-03|h-2026-11-04-tandlakare|0': '2026-11-03T12:00:00Z' } })
    const [n] = dueNotifications(at('2026-11-03T14:50:00Z'), data, DEFAULT_INSTALLNINGAR, EMPTY)
    expect(n.body).toBe('2 saker imorgon')
  })
  it('stays quiet when tomorrow holds nothing and nothing needs preparing', () => {
    const data = makeData({ events: [], schema: { ...makeData().schema, activities: [] } })
    expect(dueNotifications(at('2026-11-03T14:50:00Z'), data, DEFAULT_INSTALLNINGAR, EMPTY)).toEqual([])
  })
  it('can fire together with, and independently of, the morning one', () => {
    const settings: Installningar = { notiser: { idag: '15:30', imorgon: '15:40' } }
    expect(keys(dueNotifications(at('2026-11-03T14:50:00Z'), makeData(), settings, EMPTY))).toEqual(['2026-11-03|idag', '2026-11-03|imorgon'])
    const log = { skickade: [{ key: '2026-11-03|idag', sent: 'x' }] }
    expect(keys(dueNotifications(at('2026-11-03T14:50:00Z'), makeData(), settings, log))).toEqual(['2026-11-03|imorgon'])
  })
})

describe('recordSent', () => {
  it('appends the new keys with a timestamp and does not mutate the log', () => {
    const log = { skickade: [{ key: '2026-11-03|idag', sent: 'a' }] }
    const out = recordSent(log, ['2026-11-04|idag'], at('2026-11-04T05:45:00Z'))
    expect(out.skickade.map(s => s.key)).toEqual(['2026-11-03|idag', '2026-11-04|idag'])
    expect(out.skickade[1].sent).toBe('2026-11-04T05:45:00.000Z')
    expect(log.skickade).toHaveLength(1)
  })
  it('prunes entries older than two weeks', () => {
    const log = { skickade: [{ key: '2026-10-01|idag', sent: 'a' }, { key: '2026-10-25|imorgon', sent: 'b' }] }
    const out = recordSent(log, ['2026-11-04|idag'], at('2026-11-04T05:45:00Z'))
    expect(out.skickade.map(s => s.key)).toEqual(['2026-10-25|imorgon', '2026-11-04|idag'])
  })
})

describe('dueNotifications: to-do reminders', () => {
  // The spec's example: due 25 Nov, reminded 3 days before and on the day, both at 07:30.
  const busskort = {
    id: 't-busskort', title: 'Förnya busskortet', due: '2026-11-25', dueTime: null, done: null,
    remind: [{ before: 'P3D', at: '07:30' }, { before: 'P0D', at: '07:30' }],
  }
  const data = () => makeData({ todos: [busskort] })
  const names = (d: ReturnType<typeof dueNotifications>) => d.filter(n => n.title === 'Påminnelse')

  it('fires on the reminder day at its time, naming how far off the due date is', () => {
    const [n] = names(dueNotifications(at('2026-11-22T06:35:00Z'), data(), DEFAULT_INSTALLNINGAR, EMPTY)) // Sun 07:35
    expect(n).toEqual({
      key: '2026-11-22|pam|t-busskort|P3D',
      title: 'Påminnelse',
      body: 'Förnya busskortet – om 3 dagar',
      url: '/matracet/laget/?vy=idag',
      tag: 'laget-pam-t-busskort',
    })
    const [same] = names(dueNotifications(at('2026-11-25T06:35:00Z'), data(), DEFAULT_INSTALLNINGAR, EMPTY))
    expect(same.body).toBe('Förnya busskortet – idag')
  })
  it('does not fire on other days, before its time, once logged, or when done', () => {
    expect(names(dueNotifications(at('2026-11-23T06:35:00Z'), data(), DEFAULT_INSTALLNINGAR, EMPTY))).toEqual([])
    expect(names(dueNotifications(at('2026-11-22T06:25:00Z'), data(), DEFAULT_INSTALLNINGAR, EMPTY))).toEqual([])
    const log = { skickade: [{ key: '2026-11-22|pam|t-busskort|P3D', sent: 'x' }] }
    expect(names(dueNotifications(at('2026-11-22T06:35:00Z'), data(), DEFAULT_INSTALLNINGAR, log))).toEqual([])
    const done = makeData({ todos: [{ ...busskort, done: '2026-11-21T10:00:00Z' }] })
    expect(names(dueNotifications(at('2026-11-22T06:35:00Z'), done, DEFAULT_INSTALLNINGAR, EMPTY))).toEqual([])
  })
  it('adds the time for something due today at a set time', () => {
    const t = makeData({ todos: [{ ...busskort, dueTime: '16:00' }] })
    const [n] = names(dueNotifications(at('2026-11-25T06:35:00Z'), t, DEFAULT_INSTALLNINGAR, EMPTY))
    expect(n.body).toBe('Förnya busskortet – idag 16:00')
  })
})

describe('withNotisTimes', () => {
  it('sets both times, keeping other settings', () => {
    expect(withNotisTimes(DEFAULT_INSTALLNINGAR, '06:55', '16:10')).toEqual({ notiser: { idag: '06:55', imorgon: '16:10' } })
  })
  it('refuses anything that is not HH:MM', () => {
    for (const bad of [['6:55', '16:10'], ['06:55', ''], ['24:00', '16:10'], ['06:60', '16:10'], ['kvart i sju', '16:10']]) {
      expect(withNotisTimes(DEFAULT_INSTALLNINGAR, bad[0], bad[1]), bad.join()).toBeNull()
    }
  })
})
