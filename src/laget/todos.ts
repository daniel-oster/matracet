import { addDays } from '../presence/resolver'
import { addDuration, parseDuration, subtractDuration } from './duration'
import { stockholmNow } from './time'
import type { Todo } from './types'

// To-dos: ticking (with the next occurrence of a repeating one) and the reminder schedule.
// Pure — the app writes the result to data/attgora.json, the notification job reads the reminders.

/** `t-busskort@2026-12-25` and `t-busskort` are the same series. */
export function seriesId(id: string): string {
  return id.split('@')[0]
}

/**
 * The next due date of a repeating to-do, strictly after `today`. Counting from the due date can
 * land in the past when something was ticked long after its date; those catch-up occurrences are
 * skipped rather than spawned as instantly-overdue to-dos.
 */
export function nextDue(todo: Todo, today: string): string | null {
  const dur = todo.repeat ? parseDuration(todo.repeat.every) : null
  if (!todo.repeat || !dur || (dur.years === 0 && dur.months === 0 && dur.days === 0)) return null
  let next = addDuration(todo.repeat.from === 'done' ? today : todo.due, dur)
  for (let guard = 0; next <= today && guard < 1000; guard++) next = addDuration(next, dur)
  return next
}

/**
 * Ticks a to-do. A repeating one also gets its next occurrence (a new open entry, id
 * `<series>@<due>`) unless one with that id already exists. Idempotent: ticking something already
 * ticked, or unknown, returns the same array — which `updatePrivateJson` reads as "nothing to write",
 * so a retry on fresher data can't double-create.
 */
export function completeTodo(todos: Todo[], id: string, now: Date): Todo[] {
  const todo = todos.find(t => t.id === id)
  if (!todo || todo.done !== null) return todos
  const today = stockholmNow(now).date
  const ticked = todos.map(t => (t.id === id ? { ...t, done: now.toISOString() } : t))
  const due = nextDue(todo, today)
  if (due === null) return ticked
  const nextId = `${seriesId(todo.id)}@${due}`
  if (ticked.some(t => t.id === nextId)) return ticked
  return [...ticked, { ...todo, id: nextId, due, done: null }]
}

export interface Reminder {
  /** The day it fires, and the time on that day. */
  date: string
  at: string
  before: string
}

/** The days/times a to-do should ping, from its `remind` list (a malformed entry is skipped). */
export function reminders(todo: Todo): Reminder[] {
  const out: Reminder[] = []
  for (const r of todo.remind ?? []) {
    const dur = parseDuration(r.before)
    if (dur) out.push({ date: subtractDuration(todo.due, dur), at: r.at, before: r.before })
  }
  return out
}

/** "idag", "imorgon" or "om 3 dagar" for a notification body. */
export function dueWords(due: string, today: string): string {
  if (due <= today) return due < today ? 'försenad' : 'idag'
  if (due === addDays(today, 1)) return 'imorgon'
  const days = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
  return `om ${days} dagar`
}
