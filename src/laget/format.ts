import type { DayPlan } from '../presence/types'
import type { KlartMap } from './types'

const dateFmt = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })

/** "Onsdag 4 nov" — date strings are parsed at noon UTC so no timezone can shift the day. */
export function dateLabel(iso: string): string {
  const s = dateFmt.format(new Date(`${iso}T12:00:00Z`)).replace(/\./g, '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** The dinner line under Idag: only what the resolver knows (the dish itself is step 2). */
export function windowLine(p: DayPlan): string | null {
  if (p.presentPersons.length === 0) return null
  if (p.windowStatus === 'BOUNDED' && p.windowEndsBy) return `Ät senast ${p.windowEndsBy}`
  if (p.windowStatus === 'CONFLICT' && p.eatEarlyBy) return `Ät tidigt – senast ${p.eatEarlyBy}`
  return null
}

/** Ticking (or un-ticking) a preparation in data/klart.json. Pure; safe to re-run on fresher data. */
export function withKlart(klart: KlartMap, key: string, on: boolean, stamp: string): KlartMap {
  if (on) return klart[key] === undefined ? { ...klart, [key]: stamp } : klart
  if (klart[key] === undefined) return klart
  const { [key]: _removed, ...rest } = klart
  return rest
}
