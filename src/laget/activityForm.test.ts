import { describe, expect, it } from 'vitest'
import { draftFromActivity, emptyDraft, endActivity, saveActivity } from './activityForm'
import { validateSchema } from '../presence/validate'
import { makeData } from './fixtures'
import type { Activity, PresenceStore } from '../presence/types'

const TODAY = '2026-11-02'
const store = (): PresenceStore => makeData().schema
const find = (s: PresenceStore, id: string) => s.activities!.find(a => a.id === id)!
const last = (s: PresenceStore) => s.activities![s.activities!.length - 1]
// Aktivitet E: Mon 18:00, valid from 2026-08-17, open-ended, with a "Packa väskan" preparation (see fixtures).
const E = 'barn-a-mon-a5-ht26'

describe('saveActivity: new', () => {
  it('adds an activity with a generated, unique id and nulls for empty times', () => {
    const d = { ...emptyDraft('barn-a', TODAY), label: 'Simskola', weekday: 4 as const, startTime: '16:30', arriveBy: '16:15' }
    const r = saveActivity(store(), d, TODAY)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const a = last(r.store)
    expect(a).toMatchObject({ id: 'barn-a-thu-simskola', personId: 'barn-a', label: 'Simskola', weekday: 4, startTime: '16:30', arriveBy: '16:15', leaveBy: null, endTime: null, validFrom: TODAY, validUntil: null, affectsWindow: true })
    expect(validateSchema(r.store)).toEqual([])
    // a second one with the same name gets a suffix instead of colliding
    const again = saveActivity(r.store, d, TODAY)
    expect(again.ok && last(again.store).id).toBe('barn-a-thu-simskola-2')
  })
  it('needs a name', () => {
    expect(saveActivity(store(), emptyDraft('barn-a', TODAY), TODAY)).toEqual({ ok: false, error: 'Aktiviteten behöver ett namn.' })
  })
  it('refuses what validation refuses (a time that is not HH:MM) and applies nothing', () => {
    const s = store()
    const r = saveActivity(s, { ...emptyDraft('barn-a', TODAY), label: 'X', startTime: '7.30' }, TODAY)
    expect(r.ok).toBe(false)
    expect(s.activities).toEqual(store().activities)
  })
  it('turns lines into preparations with daysBefore 1, and pausedOnBreak only when set', () => {
    const d = { ...emptyDraft('barn-a', TODAY), label: 'Gympa', prepareLines: 'Packa gympapåsen\n\n  Ta fram skor ', pausedOnBreak: true }
    const r = saveActivity(store(), d, TODAY)
    const a = r.ok ? last(r.store) : null
    expect(a?.prepare).toEqual([{ text: 'Packa gympapåsen', daysBefore: 1 }, { text: 'Ta fram skor', daysBefore: 1 }])
    expect(a?.pausedOnBreak).toBe(true)
  })
})

describe('saveActivity: edit', () => {
  it('is a no-op when nothing changed', () => {
    const s = store()
    const r = saveActivity(s, draftFromActivity(find(s, E)), TODAY)
    expect(r).toEqual({ ok: true, store: s })
  })

  it('ending-and-continuing: an already running activity keeps its past, and the change starts today', () => {
    const s = store()
    const r = saveActivity(s, { ...draftFromActivity(find(s, E)), startTime: '17:00', arriveBy: '16:45' }, TODAY)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(find(r.store, E)).toMatchObject({ validUntil: '2026-11-01', startTime: '18:00' }) // old one untouched except its end
    const successor = last(r.store)
    expect(successor).toMatchObject({ id: 'barn-a-mon-aktivitet-e', startTime: '17:00', arriveBy: '16:45', validFrom: TODAY, validUntil: null })
    expect(validateSchema(r.store)).toEqual([])
  })

  it('keeps stored daysBefore for an unchanged preparation text, 1 for a new one', () => {
    const s = store()
    find(s, E).prepare = [{ text: 'Packa väskan', daysBefore: 2 }]
    const r = saveActivity(s, { ...draftFromActivity(find(s, E)), startTime: '17:00', prepareLines: 'Packa väskan\nNy sak' }, TODAY)
    expect(r.ok && last(r.store).prepare).toEqual([{ text: 'Packa väskan', daysBefore: 2 }, { text: 'Ny sak', daysBefore: 1 }])
  })

  it('edits in place when the activity has not started yet', () => {
    const s = store()
    s.activities!.push({ ...find(s, E), id: 'fram', validFrom: '2026-12-01' })
    const n = s.activities!.length
    const r = saveActivity(s, { ...draftFromActivity(find(s, 'fram')), startTime: '19:00' }, TODAY)
    expect(r.ok && r.store.activities!.length).toBe(n)
    expect(r.ok && find(r.store, 'fram').startTime).toBe('19:00')
  })

  it('edits in place when only the validity range changed', () => {
    const s = store()
    const r = saveActivity(s, { ...draftFromActivity(find(s, E)), validUntil: '2026-12-18' }, TODAY)
    expect(r.ok && r.store.activities!.length).toBe(s.activities!.length)
    expect(r.ok && find(r.store, E).validUntil).toBe('2026-12-18')
  })

  it('does not change the resolved past: every day before today resolves as before an edit', async () => {
    const { resolvePresenceRange } = await import('../presence/resolver')
    const s = store()
    const r = saveActivity(s, { ...draftFromActivity(find(s, E)), startTime: '17:00', arriveBy: '16:45' }, TODAY)
    if (!r.ok) throw new Error(r.error)
    // What a day means for the household: group, eating window, portions and which activities (with times) apply.
    const days = (st: PresenceStore) =>
      resolvePresenceRange('2026-08-17', '2026-11-01', st).map(p => ({
        date: p.date, group: p.activeGroup?.id, status: p.windowStatus, endsBy: p.windowEndsBy, eatEarly: p.eatEarlyBy, portions: p.portions,
        acts: p.activitiesToday.map(a => `${a.label}@${a.startTime}/${a.arriveBy}`).sort(),
      }))
    expect(days(r.store)).toEqual(days(s))
    // …and from today the new times apply
    const after = resolvePresenceRange('2026-11-02', '2026-11-02', r.store)[0]
    expect(after.activitiesToday.map(a => a.startTime)).toContain('17:00')
  })

  it('reports a vanished activity', () => {
    expect(saveActivity(store(), { ...emptyDraft('barn-a', TODAY), id: 'finns-inte', label: 'X' }, TODAY).ok).toBe(false)
  })
})

describe('endActivity', () => {
  it('sets validUntil instead of deleting, so history stays', () => {
    const s = store()
    const r = endActivity(s, E, '2026-11-01')
    expect(r.ok && r.store.activities!.length).toBe(s.activities!.length)
    expect(r.ok && find(r.store, E).validUntil).toBe('2026-11-01')
  })
  it('never moves an earlier end later, and never ends before the start', () => {
    const s = store()
    const a: Activity = find(s, E)
    a.validUntil = '2026-10-10'
    expect(endActivity(s, E, '2026-11-01')).toEqual({ ok: true, store: s })
    a.validUntil = null
    const r = endActivity(s, E, '2026-01-01')
    expect(r.ok && find(r.store, E).validUntil).toBe(a.validFrom)
  })
  it('reports a vanished activity', () => {
    expect(endActivity(store(), 'finns-inte', TODAY).ok).toBe(false)
  })
})
