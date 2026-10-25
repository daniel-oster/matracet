import { addDays } from '../presence/resolver'
import { staleNew, statusLine, type InkorgMeddelande } from './inkorg'
import type { Notis, NotisLogg } from './notiser'
import { stockholmNow } from './time'

// What the inbox workflow (inkorg.yml in livet-data) and the safety net (in notiser.yml) decide.
// Pure; scripts/laget-inkorg.ts does the git, HTTP and file I/O around it.

export type ChangeKind = 'fire' | 'confirm' | null

/**
 * What a changed inbox file means:
 *  - `fire`: a brand-new message (no previous version) that is still `ny` — wake the routine.
 *  - `confirm`: it was `ny` and Claude has now answered (klar / oklar / fel) — tell the phone.
 *  - anything else (an edit while still `ny`, or an answered message touched again): nothing. In
 *    particular Claude's own commit, which flips `ny` to `klar`, can never fire the routine again.
 */
export function classifyChange(prev: InkorgMeddelande | null, cur: InkorgMeddelande): ChangeKind {
  if (prev === null && cur.status === 'ny') return 'fire'
  if (prev?.status === 'ny' && cur.status !== 'ny') return 'confirm'
  return null
}

const BODY_MAX = 160

/** The push for an answered message: Claude's reply, opening the start page. */
export function confirmNotis(m: InkorgMeddelande): Notis {
  const line = statusLine(m)
  return {
    key: `${m.id.slice(2, 6)}-${m.id.slice(6, 8)}-${m.id.slice(8, 10)}|bek|${m.id}`,
    title: m.status === 'klar' ? 'Läget – inlagt' : m.status === 'oklar' ? 'Läget – en fråga' : 'Läget – gick inte',
    body: line.length > BODY_MAX ? `${line.slice(0, BODY_MAX - 1)}…` : line,
    url: '/matracet/laget/',
    tag: `laget-inkorg-${m.id}`,
  }
}

/** How many times the safety net may re-fire one message before giving up on it. */
export const MAX_REFIRES = 2

export const GAVE_UP_REPLY = 'Ingen behandling inom en timme – skicka meddelandet igen.'

function sentDate(m: InkorgMeddelande): string {
  return stockholmNow(new Date(m.sent)).date
}

function fireKeyPrefix(m: InkorgMeddelande): string {
  return `${sentDate(m)}|fire|${m.id}|`
}

export interface StalePlan {
  /** Messages to POST to the routine again, with the log key to record for each. */
  fire: { message: InkorgMeddelande; key: string }[]
  /** Messages that already used all their re-fires: marked `fel` so the sender sees it. */
  giveUp: InkorgMeddelande[]
}

/** The safety net: a message still `ny` after 15 minutes is re-fired, at most MAX_REFIRES times. */
export function planStale(messages: InkorgMeddelande[], log: NotisLogg, now: Date): StalePlan {
  const plan: StalePlan = { fire: [], giveUp: [] }
  for (const m of staleNew(messages, now)) {
    const used = log.skickade.filter(s => s.key.startsWith(fireKeyPrefix(m))).length
    if (used >= MAX_REFIRES) plan.giveUp.push(m)
    else plan.fire.push({ message: m, key: `${fireKeyPrefix(m)}${used + 1}` })
  }
  return plan
}

/** The message as the job rewrites it when giving up. */
export function gaveUp(m: InkorgMeddelande, now: Date): InkorgMeddelande {
  return { ...m, status: 'fel', reply: GAVE_UP_REPLY, processedAt: now.toISOString() }
}

/** Fire log entries are kept as long as the notification log keeps them (two weeks). */
export function fireLogCutoff(now: Date): string {
  return addDays(stockholmNow(now).date, -14)
}
