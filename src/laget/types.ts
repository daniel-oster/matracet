import type { DayPlan, Period, Prepare, PresenceStore } from '../presence/types'
import type { DinnerSources } from './dinner'

// Läget's data model — see docs/laget-spec-2026-10.md ("Datamodell"). Everything here is pure
// data; no DOM, no localStorage. The same module runs in the app and in the notification job.

/** A one-off happening (dentist, school photo). Same timing fields as a recurring Activity. */
export interface LagetEvent {
  id: string
  title: string
  date: string               // ISO date
  endDate: string | null     // inclusive; null = single day. Multi-day events show no times.
  personIds: string[]
  startTime: string | null   // HH:MM
  arriveBy: string | null
  leaveBy: string | null
  endTime: string | null
  /** Constrains the dinner window like a recurring activity (only while its person is home). */
  affectsWindow: boolean
  place: string | null
  prepare?: Prepare[]
  source?: string
  inboxId?: string
}

/** A reminder relative to the due date: `before` is an ISO duration ("P3D", "P0D" = the day itself). */
export interface TodoRemind {
  before: string
  at: string                 // HH:MM, Stockholm time
}

/** `from: 'done'` counts from the day it was ticked, `'due'` from the due date. */
export interface TodoRepeat {
  every: string              // ISO duration
  from: 'done' | 'due'
}

/** Something with a due date (data/attgora.json). */
export interface Todo {
  id: string
  title: string
  due: string                // ISO date
  dueTime: string | null
  remind?: TodoRemind[]
  repeat?: TodoRepeat | null
  done: string | null        // ISO timestamp when ticked
  personIds?: string[]
  source?: string
  inboxId?: string
}

/** data/klart.json: which preparations are ticked. Key = `${prepDate}|${sourceId}|${index}`. */
export type KlartMap = Record<string, string>

export interface LagetData {
  schema: PresenceStore
  periods: Period[]
  events: LagetEvent[]
  todos: Todo[]
  klart: KlartMap
  /** Matracet's plan, for the dinner line. Absent (e.g. in the notification job) = no dinner. */
  dinner?: DinnerSources
}

export interface TimelineItem {
  id: string
  kind: 'aktivitet' | 'handelse'
  title: string
  personIds: string[]
  startTime: string | null
  arriveBy: string | null
  leaveBy: string | null
  endTime: string | null
  /** When you must leave (leaveBy → arriveBy → startTime), the resolver's own fallback chain. */
  leaveByEffective: string | null
  place: string | null
  affectsWindow: boolean
}

export interface PrepItem {
  /** The klart.json key. */
  key: string
  text: string
  sourceId: string
  sourceTitle: string
  /** The day the thing happens that this prepares for. */
  forDate: string
  done: boolean
}

export interface DinnerLine {
  title: string
  eatBy: string | null
}

/** One day, computed and never stored. */
export interface DayView {
  date: string
  presence: DayPlan
  /** Someone with a term/break (a school-age child) is home today. */
  isChildWeek: boolean
  timeline: TimelineItem[]
  todos: Todo[]
  /** Preparations to do TODAY for what happens in the next days — ticked ones included,
   *  with `done: true`, so the app can show and undo them. */
  prepareTonight: PrepItem[]
  /** From Matracet's plan; null when nothing is planned or `data.dinner` isn't loaded. */
  dinner: DinnerLine | null
  tomorrowTeaser: string | null
}
