import { addDays } from '../presence/resolver'
import { buildDay } from './buildDay'
import { headline, tomorrowHeadline } from './summary'
import { stockholmNow } from './time'
import type { LagetData } from './types'

// What the notification job should send right now. Pure: the job (scripts/laget-notiser.ts, run
// every 30 minutes by livet-data's notiser.yml) only does the file and network I/O around it.
// See docs/laget-spec-2026-10.md ("Notiser").

/** data/installningar.json — only the notification times so far. */
export interface Installningar {
  notiser: { idag: string; imorgon: string }
}

export const DEFAULT_INSTALLNINGAR: Installningar = { notiser: { idag: '06:40', imorgon: '15:40' } }

/** data/notislogg.json: what has been sent, so a re-run never repeats a notification. */
export interface NotisLogg {
  skickade: { key: string; sent: string }[]
}

export interface Notis {
  /** Dedupe key: `${date}|${type}`. */
  key: string
  title: string
  body: string
  url: string
  tag: string
}

/** A scheduled run can start late (GitHub delays cron jobs, often by 5–30 minutes, sometimes more).
 *  A notification still goes out up to this long after its time, then it is dropped — a "Läget idag"
 *  at lunchtime is worse than none. */
export const GRACE_MINUTES = 90

/** Log entries older than this many days are pruned when something new is recorded. */
const LOG_KEEP_DAYS = 14

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/

function minutes(hhmm: string): number | null {
  const m = HHMM.exec(hhmm)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** True when `scheduled` has passed by at most the grace period (same day). A malformed time never fires. */
function isDue(nowTime: string, scheduled: string): boolean {
  const now = minutes(nowTime)
  const at = minutes(scheduled)
  return now !== null && at !== null && now >= at && now - at < GRACE_MINUTES
}

export function dueNotifications(
  now: Date,
  data: LagetData,
  settings: Installningar,
  log: NotisLogg,
): Notis[] {
  const { date, time } = stockholmNow(now)
  const sent = new Set(log.skickade.map(s => s.key))
  const out: Notis[] = []

  const idagKey = `${date}|idag`
  if (!sent.has(idagKey) && isDue(time, settings.notiser.idag)) {
    out.push({
      key: idagKey,
      title: 'Läget idag',
      body: headline(buildDay(date, data)),
      url: '/matracet/laget/?vy=idag',
      tag: 'laget-idag',
    })
  }

  const imorgonKey = `${date}|imorgon`
  if (!sent.has(imorgonKey) && isDue(time, settings.notiser.imorgon)) {
    const body = tomorrowHeadline(buildDay(date, data), buildDay(addDays(date, 1), data))
    if (body !== null) {
      out.push({ key: imorgonKey, title: 'Läget imorgon', body, url: '/matracet/laget/?vy=imorgon', tag: 'laget-imorgon' })
    }
  }

  return out
}

/** The log after sending `keys` at `now`, with entries older than two weeks dropped. */
export function recordSent(log: NotisLogg, keys: string[], now: Date): NotisLogg {
  const { date } = stockholmNow(now)
  const cutoff = addDays(date, -LOG_KEEP_DAYS)
  const kept = log.skickade.filter(s => s.key.slice(0, 10) >= cutoff)
  return { skickade: [...kept, ...keys.map(key => ({ key, sent: now.toISOString() }))] }
}
