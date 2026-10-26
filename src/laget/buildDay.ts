import { addDays, effectiveLeaveBy, resolvePresence } from '../presence/resolver'
import type { Activity, DayPlan, Period, Weekday } from '../presence/types'
import { isoWeekday } from '../lib/mealNeed'
import { dinnerFor, lunchFor } from './dinner'
import type { DayView, LagetData, LagetEvent, PrepItem, TimelineItem } from './types'

// The one place that turns the data files into a day. Pure and deterministic: the app and the
// notification job both call `buildDay`, so they can never disagree about what a day holds.
// See docs/laget-spec-2026-10.md.

/** Prefix of the synthetic activities events are turned into for the resolver. */
const EVENT_PREFIX = 'ev:'
const MAX_PREPARE_DAYS = 14
const MAX_EVENT_DAYS = 31

function covers(p: Period, date: string): boolean {
  return date >= p.from && (p.to === null || date <= p.to)
}

function onBreak(date: string, personId: string, periods: Period[]): boolean {
  return periods.some(p => p.kind === 'lov' && p.personIds.includes(personId) && covers(p, date))
}

function eventCovers(ev: LagetEvent, date: string): boolean {
  return date >= ev.date && date <= (ev.endDate ?? ev.date) && date <= addDays(ev.date, MAX_EVENT_DAYS - 1)
}

function isMultiDay(ev: LagetEvent): boolean {
  return ev.endDate !== null && ev.endDate !== ev.date
}

/** An event, as the resolver sees it on one date: an activity per person valid that day only.
 *  Multi-day events carry no times (they have no single start). */
function eventAsActivities(ev: LagetEvent, date: string): Activity[] {
  const timed = !isMultiDay(ev)
  return ev.personIds.map(personId => ({
    id: `${EVENT_PREFIX}${ev.id}:${personId}`,
    personId,
    label: ev.title,
    weekday: isoWeekday(date) as Weekday,
    startTime: timed ? ev.startTime : null,
    arriveBy: timed ? ev.arriveBy : null,
    leaveBy: timed ? ev.leaveBy : null,
    endTime: timed ? ev.endTime : null,
    affectsWindow: timed && ev.affectsWindow,
    validFrom: date,
    validUntil: date,
    notes: ev.place,
  }))
}

/** Presence for one date with breaks and one-off events folded into the activity list. */
function resolveDate(date: string, data: LagetData): DayPlan {
  const activities = [
    ...(data.schema.activities ?? []).filter(a => !(a.pausedOnBreak && onBreak(date, a.personId, data.periods))),
    ...data.events.filter(ev => eventCovers(ev, date)).flatMap(ev => eventAsActivities(ev, date)),
  ]
  return resolvePresence(date, { ...data.schema, activities })
}

function timelineFor(date: string, plan: DayPlan, data: LagetData): TimelineItem[] {
  const recurring: TimelineItem[] = plan.activitiesToday
    .filter(a => !a.id.startsWith(EVENT_PREFIX))
    .map(a => ({
      id: a.id,
      kind: 'aktivitet',
      title: a.label,
      personIds: [a.personId],
      startTime: a.startTime,
      arriveBy: a.arriveBy,
      leaveBy: a.leaveBy,
      endTime: a.endTime,
      leaveByEffective: effectiveLeaveBy(a),
      place: a.notes,
      affectsWindow: a.affectsWindow,
    }))
  const events: TimelineItem[] = data.events
    .filter(ev => eventCovers(ev, date))
    .map(ev => {
      const [a] = eventAsActivities(ev, date)
      return {
        id: ev.id,
        kind: 'handelse',
        title: ev.title,
        personIds: ev.personIds,
        startTime: a?.startTime ?? null,
        arriveBy: a?.arriveBy ?? null,
        leaveBy: a?.leaveBy ?? null,
        endTime: a?.endTime ?? null,
        leaveByEffective: a ? effectiveLeaveBy(a) : null,
        place: ev.place,
        affectsWindow: a?.affectsWindow ?? false,
      }
    })
  // Timed items by the time you have to act, untimed ones (all-day, "dagtid") last.
  const sortKey = (t: TimelineItem) => t.leaveByEffective ?? t.startTime ?? '99:99'
  return [...recurring, ...events].sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.title.localeCompare(b.title, 'sv'))
}

/** Preparations to do on `date`, for things happening 0–14 days later. */
function prepareFor(date: string, data: LagetData): PrepItem[] {
  const maxDays = Math.max(
    -1,
    ...(data.schema.activities ?? []).flatMap(a => (a.prepare ?? []).map(p => p.daysBefore)),
    ...data.events.flatMap(ev => (ev.prepare ?? []).map(p => p.daysBefore)),
  )
  const items: PrepItem[] = []
  for (let n = 0; n <= Math.min(maxDays, MAX_PREPARE_DAYS); n++) {
    const target = addDays(date, n)
    const push = (sourceId: string, sourceTitle: string, prepare: { text: string; daysBefore: number }[] | undefined) => {
      ;(prepare ?? []).forEach((p, index) => {
        if (p.daysBefore !== n) return
        const key = `${date}|${sourceId}|${index}`
        items.push({ key, text: p.text, sourceId, sourceTitle, forDate: target, done: data.klart[key] !== undefined })
      })
    }
    for (const a of resolveDate(target, data).activitiesToday) {
      if (!a.id.startsWith(EVENT_PREFIX)) push(a.id, a.label, a.prepare)
    }
    // Only an event's first day: "Ta med kallelsen" is for the start, not every day of a camp.
    for (const ev of data.events) if (ev.date === target) push(ev.id, ev.title, ev.prepare)
  }
  return items
}

export function buildDay(date: string, data: LagetData): DayView {
  const plan = resolveDate(date, data)
  // The synthetic event activities are an implementation detail of the resolver call.
  const presence: DayPlan = { ...plan, activitiesToday: plan.activitiesToday.filter(a => !a.id.startsWith(EVENT_PREFIX)) }
  const childIds = new Set(data.periods.flatMap(p => p.personIds))
  const prepareTonight = prepareFor(date, data)
  const open = prepareTonight.filter(p => !p.done).length
  return {
    date,
    presence,
    isChildWeek: presence.presentPersons.some(p => childIds.has(p.id)),
    timeline: timelineFor(date, plan, data),
    todos: data.todos.filter(t => t.done === null && t.due <= date),
    prepareTonight,
    lunch: data.dinner ? lunchFor(date, data.dinner) : null,
    dinner: data.dinner ? dinnerFor(date, data.dinner, presence.windowStatus === 'BOUNDED' ? presence.windowEndsBy : presence.windowStatus === 'CONFLICT' ? presence.eatEarlyBy : null) : null,
    tomorrowTeaser: open > 0 ? `${open} att förbereda` : null,
  }
}

/** `n` consecutive days from `start`, each built independently. */
export function buildWeek(start: string, data: LagetData, n = 7): DayView[] {
  return Array.from({ length: n }, (_, i) => buildDay(addDays(start, i), data))
}
