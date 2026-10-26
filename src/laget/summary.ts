import type { DayView, TimelineItem } from './types'

// The short texts built from a DayView: the shield on the start page and the notification line.
// Kept next to buildDay so the app and the notification job say the same thing.

export interface TopLine {
  kind: 'tid' | 'gora'
  text: string
  time: string | null
}

function timeLine(t: TimelineItem): string {
  return `${t.title}${t.startTime ? ` ${t.startTime}` : ''}${t.leaveBy ? `, åk ${t.leaveBy}` : ''}`
}

/** Items worth a glance: timed things (from `fromTime` on, when given) then open to-dos. */
export function topLines(view: DayView, max = 3, fromTime?: string): TopLine[] {
  const timed = view.timeline.filter(t => t.startTime !== null || t.leaveByEffective !== null)
  const upcoming = fromTime ? timed.filter(t => (t.endTime ?? t.leaveByEffective ?? t.startTime ?? '00:00') >= fromTime) : timed
  const lines: TopLine[] = upcoming.map(t => ({ kind: 'tid', text: timeLine(t), time: t.leaveByEffective ?? t.startTime }))
  for (const todo of view.todos) {
    lines.push({ kind: 'gora', text: todo.due < view.date ? `${todo.title} (försenad)` : todo.title, time: todo.dueTime })
  }
  return lines.slice(0, max)
}

export interface ShieldRow {
  kind: 'tid' | 'gora'
  /** The time column: start (or the to-do's time), null when it has none. */
  time: string | null
  title: string
  /** Smaller line under the title: "på plats 19:30", "åk 18:40", "försenad". */
  note: string | null
}

/** The rows of the start page's shield: timed things (from `fromTime` on) then open to-dos, `max` of them.
 *  Same selection as topLines, but split into columns instead of one sentence. */
export function shieldRows(view: DayView, max = 3, fromTime?: string): ShieldRow[] {
  const timed = view.timeline.filter(t => t.startTime !== null || t.leaveByEffective !== null)
  const upcoming = fromTime ? timed.filter(t => (t.endTime ?? t.leaveByEffective ?? t.startTime ?? '00:00') >= fromTime) : timed
  const rows: ShieldRow[] = upcoming.map(t => ({
    kind: 'tid',
    time: t.startTime,
    title: t.title,
    note: t.leaveBy ? `åk ${t.leaveBy}` : t.arriveBy && t.arriveBy !== t.startTime ? `på plats ${t.arriveBy}` : null,
  }))
  for (const todo of view.todos) {
    rows.push({ kind: 'gora', time: todo.dueTime, title: todo.title, note: todo.due < view.date ? 'försenad' : null })
  }
  return rows.slice(0, max)
}

/** "Barnvecka · 3 saker idag" — the notification body. */
export function headline(view: DayView): string {
  const n = view.timeline.filter(t => t.startTime !== null).length + view.todos.length
  const week = view.isChildWeek ? 'Barnvecka' : 'Ej barnvecka'
  return `${week} · ${n === 0 ? 'inget inplanerat' : n === 1 ? '1 sak idag' : `${n} saker idag`}`
}

/** "2 saker imorgon · 1 att förbereda" — the afternoon notification body, or null when tomorrow
 *  holds nothing (no point pinging about an empty day). */
export function tomorrowHeadline(today: DayView, tomorrow: DayView): string | null {
  const n = tomorrow.timeline.filter(t => t.startTime !== null).length
  const prep = today.prepareTonight.filter(p => !p.done).length
  if (n === 0 && prep === 0) return null
  const parts = [n === 0 ? 'inget inplanerat imorgon' : n === 1 ? '1 sak imorgon' : `${n} saker imorgon`]
  if (prep > 0) parts.push(`${prep} att förbereda`)
  return parts.join(' · ')
}

/** One short line per thing happening that day, for the week list: timed items, open to-dos, dinner. */
export function dayLines(view: DayView): string[] {
  const lines: string[] = view.timeline
    .filter(t => t.startTime !== null)
    .map(t => `${t.title} ${t.startTime}`)
  for (const todo of view.todos) lines.push(`${todo.title} (att göra)`)
  if (view.dinner) lines.push(`Middag: ${view.dinner.title}`)
  return lines
}
