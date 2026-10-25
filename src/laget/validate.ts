import { parseDuration } from './duration'
import type { LagetEvent, Todo } from './types'

// Structural checks for data/handelser.json and data/attgora.json. Claude writes both from free
// text (step 2), so a malformed entry must be caught before it quietly becomes a missing reminder.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

function isDate(v: unknown): v is string {
  if (typeof v !== 'string' || !ISO_DATE.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}
const isTime = (v: unknown) => typeof v === 'string' && HHMM.test(v)
const dup = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i)

export function validateEvents(events: LagetEvent[], personIds: string[]): string[] {
  const errors: string[] = []
  const known = new Set(personIds)
  for (const id of dup(events.map(e => e.id))) errors.push(`händelse: dubblett-id "${id}"`)
  for (const e of events) {
    const at = `händelse ${e.id}`
    if (!e.title?.trim()) errors.push(`${at}: saknar title`)
    if (!isDate(e.date)) errors.push(`${at}: ogiltigt date`)
    if (e.endDate !== null && e.endDate !== undefined && !isDate(e.endDate)) errors.push(`${at}: ogiltigt endDate`)
    if (isDate(e.date) && isDate(e.endDate) && e.endDate < e.date) errors.push(`${at}: endDate före date`)
    for (const p of e.personIds ?? []) if (!known.has(p)) errors.push(`${at}: okänd person "${p}"`)
    for (const f of ['startTime', 'arriveBy', 'leaveBy', 'endTime'] as const) {
      if (e[f] !== null && e[f] !== undefined && !isTime(e[f])) errors.push(`${at}: ${f}="${e[f]}" är inte HH:MM`)
    }
    for (const [i, pr] of (e.prepare ?? []).entries()) {
      if (!pr.text?.trim()) errors.push(`${at}: prepare[${i}] saknar text`)
      if (!Number.isInteger(pr.daysBefore) || pr.daysBefore < 0 || pr.daysBefore > 14) errors.push(`${at}: prepare[${i}].daysBefore måste vara 0–14`)
    }
  }
  return errors
}

export function validateTodos(todos: Todo[], personIds: string[]): string[] {
  const errors: string[] = []
  const known = new Set(personIds)
  for (const id of dup(todos.map(t => t.id))) errors.push(`att göra: dubblett-id "${id}"`)
  for (const t of todos) {
    const at = `att göra ${t.id}`
    if (!t.title?.trim()) errors.push(`${at}: saknar title`)
    if (!isDate(t.due)) errors.push(`${at}: ogiltigt due`)
    if (t.dueTime !== null && t.dueTime !== undefined && !isTime(t.dueTime)) errors.push(`${at}: dueTime="${t.dueTime}" är inte HH:MM`)
    for (const [i, r] of (t.remind ?? []).entries()) {
      if (!parseDuration(r.before)) errors.push(`${at}: remind[${i}].before="${r.before}" är ingen ISO-varaktighet`)
      if (!isTime(r.at)) errors.push(`${at}: remind[${i}].at="${r.at}" är inte HH:MM`)
    }
    if (t.repeat) {
      const d = parseDuration(t.repeat.every)
      if (!d) errors.push(`${at}: repeat.every="${t.repeat.every}" är ingen ISO-varaktighet`)
      else if (d.years === 0 && d.months === 0 && d.days === 0) errors.push(`${at}: repeat.every får inte vara noll`)
      if (t.repeat.from !== 'done' && t.repeat.from !== 'due') errors.push(`${at}: repeat.from måste vara done eller due`)
    }
    for (const p of t.personIds ?? []) if (!known.has(p)) errors.push(`${at}: okänd person "${p}"`)
  }
  return errors
}
