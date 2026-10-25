import { addDays } from '../presence/resolver'
import type { Activity, Prepare, PresenceStore, Weekday } from '../presence/types'
import { validateSchema } from '../presence/validate'

// The activity form's logic: what a draft is, and how saving/ending one changes data/schema.json.
// Pure — the screen writes the result with updatePrivateJson.
//
// Past days must never change by editing an activity (the schedule follows "duplicate, don't
// rewrite": see CLAUDE.md, and data/schema.golden.json guards it). So editing an activity that has
// already started *ends* it yesterday and starts a new one today; only an activity that hasn't begun
// yet is edited in place.

export interface ActivityDraft {
  /** Set when editing an existing activity. */
  id: string | null
  personId: string
  label: string
  weekday: Weekday
  startTime: string
  arriveBy: string
  leaveBy: string
  endTime: string
  affectsWindow: boolean
  validFrom: string
  validUntil: string
  pausedOnBreak: boolean
  /** One preparation per line; each is "daysBefore" days ahead (kept as stored when the text is unchanged). */
  prepareLines: string
}

const orNull = (s: string): string | null => (s.trim() === '' ? null : s.trim())

export function emptyDraft(personId: string, today: string): ActivityDraft {
  return {
    id: null, personId, label: '', weekday: 1, startTime: '', arriveBy: '', leaveBy: '', endTime: '',
    affectsWindow: true, validFrom: today, validUntil: '', pausedOnBreak: false, prepareLines: '',
  }
}

export function draftFromActivity(a: Activity): ActivityDraft {
  return {
    id: a.id,
    personId: a.personId,
    label: a.label,
    weekday: a.weekday,
    startTime: a.startTime ?? '',
    arriveBy: a.arriveBy ?? '',
    leaveBy: a.leaveBy ?? '',
    endTime: a.endTime ?? '',
    affectsWindow: a.affectsWindow,
    validFrom: a.validFrom,
    validUntil: a.validUntil ?? '',
    pausedOnBreak: a.pausedOnBreak ?? false,
    prepareLines: (a.prepare ?? []).map(p => p.text).join('\n'),
  }
}

const DAY_SLUG = ['', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function slug(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'aktivitet'
}

function newId(draft: ActivityDraft, taken: Set<string>): string {
  const base = `${draft.personId}-${DAY_SLUG[draft.weekday]}-${slug(draft.label)}`
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

function prepareFrom(draft: ActivityDraft, previous: Prepare[] | undefined): Prepare[] | undefined {
  const lines = draft.prepareLines.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return undefined
  return lines.map(text => ({ text, daysBefore: previous?.find(p => p.text === text)?.daysBefore ?? 1 }))
}

function toActivity(draft: ActivityDraft, id: string, previous: Activity | undefined): Activity {
  const prepare = prepareFrom(draft, previous?.prepare)
  const act: Activity = {
    id,
    personId: draft.personId,
    label: draft.label.trim(),
    weekday: draft.weekday,
    startTime: orNull(draft.startTime),
    arriveBy: orNull(draft.arriveBy),
    leaveBy: orNull(draft.leaveBy),
    endTime: orNull(draft.endTime),
    affectsWindow: draft.affectsWindow,
    validFrom: draft.validFrom,
    validUntil: orNull(draft.validUntil),
    notes: previous?.notes ?? null,
  }
  if (prepare) act.prepare = prepare
  if (draft.pausedOnBreak) act.pausedOnBreak = true
  return act
}

/** Compares everything but the validity range and id. */
function sameContent(a: Activity, b: Activity): boolean {
  const strip = ({ id: _i, validFrom: _f, validUntil: _u, ...rest }: Activity) => JSON.stringify(rest)
  return strip(a) === strip(b)
}

export type SaveResult = { ok: true; store: PresenceStore } | { ok: false; error: string }

/**
 * Saves a draft into the store. Returns the same store when nothing changed, an error when the
 * draft is unusable or the result would fail validation (nothing is ever half-applied).
 */
export function saveActivity(store: PresenceStore, draft: ActivityDraft, today: string): SaveResult {
  if (!draft.label.trim()) return { ok: false, error: 'Aktiviteten behöver ett namn.' }
  const all = store.activities ?? []
  const taken = new Set(all.map(a => a.id))
  const previous = draft.id ? all.find(a => a.id === draft.id) : undefined
  if (draft.id && !previous) return { ok: false, error: 'Aktiviteten finns inte längre.' }

  let activities: Activity[]
  if (!previous) {
    activities = [...all, toActivity(draft, newId(draft, taken), undefined)]
  } else {
    const edited = toActivity(draft, previous.id, previous)
    if (JSON.stringify(edited) === JSON.stringify(previous)) return { ok: true, store }
    const started = previous.validFrom <= today
    if (!started || sameContent(edited, previous)) {
      // Not begun yet, or only the validity range changed: edit in place.
      activities = all.map(a => (a.id === previous.id ? edited : a))
    } else {
      // Already running: end it yesterday, continue as a new activity from today.
      const ended: Activity = { ...previous, validUntil: previous.validUntil !== null && previous.validUntil < today ? previous.validUntil : addDays(today, -1) }
      const successor = toActivity({ ...draft, validFrom: today > draft.validFrom ? today : draft.validFrom }, newId(draft, taken), previous)
      activities = [...all.map(a => (a.id === previous.id ? ended : a)), successor]
    }
  }

  const next: PresenceStore = { ...store, activities }
  const errors = validateSchema(next)
  return errors.length ? { ok: false, error: errors[0] } : { ok: true, store: next }
}

/** Ends an activity after `lastDay` (the last day it still applies). Never deletes: history stays. */
export function endActivity(store: PresenceStore, id: string, lastDay: string): SaveResult {
  const all = store.activities ?? []
  const a = all.find(x => x.id === id)
  if (!a) return { ok: false, error: 'Aktiviteten finns inte längre.' }
  if (a.validUntil !== null && a.validUntil <= lastDay) return { ok: true, store }
  const next: PresenceStore = { ...store, activities: all.map(x => (x.id === id ? { ...x, validUntil: lastDay >= x.validFrom ? lastDay : x.validFrom } : x)) }
  const errors = validateSchema(next)
  return errors.length ? { ok: false, error: errors[0] } : { ok: true, store: next }
}
