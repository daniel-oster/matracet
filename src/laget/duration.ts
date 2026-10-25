import { addDays } from '../presence/resolver'

// ISO-8601 durations as used in data/attgora.json ("P3D", "P1W", "P1M", "P1Y", "P0D") and date
// arithmetic on plain YYYY-MM-DD strings (UTC, so no timezone can shift a day).

export interface Duration {
  years: number
  months: number
  days: number // weeks are folded into days
}

const RE = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/

export function parseDuration(s: string): Duration | null {
  const m = RE.exec(s)
  if (!m || s === 'P') return null
  return { years: Number(m[1] ?? 0), months: Number(m[2] ?? 0), days: Number(m[3] ?? 0) * 7 + Number(m[4] ?? 0) }
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
}

/** date + n months, clamping the day to the target month's length (Jan 31 + P1M = Feb 28/29). */
function addMonths(date: string, n: number): string {
  const [y, mo, d] = date.split('-').map(Number)
  const total = y * 12 + (mo - 1) + n
  const year = Math.floor(total / 12)
  const month0 = ((total % 12) + 12) % 12
  const day = Math.min(d, daysInMonth(year, month0))
  return `${String(year).padStart(4, '0')}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function addDuration(date: string, dur: Duration): string {
  return addDays(addMonths(date, dur.years * 12 + dur.months), dur.days)
}

export function subtractDuration(date: string, dur: Duration): string {
  return addDays(addMonths(date, -(dur.years * 12 + dur.months)), -dur.days)
}
