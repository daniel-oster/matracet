import type { Offer, StoreOffers } from '../types'
import { getISOWeekString } from './isoWeek'
import { addDays } from '../presence/resolver'

/**
 * Offer validity: which saved flyers actually apply to the days being planned.
 *
 * Until this existed, every "what's cheap right now" screen read whatever week
 * `_latest.json` happened to point at — a file that is repointed by hand on import, so it
 * lags (last week's offers still on screen days after they expired) and can run ahead (next
 * week's flyer imported on a Saturday shows as if it were live). Neither is a data bug; the
 * files carry `giltigt_fran`/`giltigt_till` and always did — nothing read them.
 *
 * An individual offer may also carry its own `giltigt_fran`/`giltigt_till` (Hemköp's personal
 * "Bara för dig" coupons routinely run on a different clock than the flyer around them), in
 * which case that wins over the file's window — in both directions, since such a coupon can
 * both end mid-week and run a week longer than the flyer it was captured with.
 */
export interface DateRange {
  /** Inclusive ISO date. */
  from: string
  /** Inclusive ISO date. */
  to: string
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.from <= b.to && b.from <= a.to
}

export function fileRange(store: StoreOffers): DateRange {
  return { from: store.giltigt_fran, to: store.giltigt_till }
}

/**
 * The dates one offer is actually valid on. A per-offer bound replaces the file's, rather
 * than only narrowing it — a coupon captured with week N's flyer can legitimately run into
 * week N+1.
 *
 * Stating only one bound can put it on the wrong side of the file's other bound, and that
 * is not bad data: a coupon carrying `giltigt_till` a day *before* the flyer's own start is
 * simply one that had already expired when the flyer was captured (Hemköp ships exactly
 * this). So a single stated bound is taken at its word and the other end collapses to meet
 * it — the resulting range then correctly fails to overlap the period being planned. Only
 * when *both* bounds are stated and inverted is it genuinely unusable, and then the file's
 * window is used rather than silently dropping the offer.
 */
export function offerRange(offer: Pick<Offer, 'giltigt_fran' | 'giltigt_till'>, file: DateRange): DateRange {
  const statedFrom = offer.giltigt_fran || null
  const statedTo = offer.giltigt_till || null
  let from = statedFrom ?? file.from
  let to = statedTo ?? file.to
  if (from > to) {
    if (statedFrom && statedTo) return file
    if (statedTo) from = to
    else to = from
  }
  return { from, to }
}

/** Every offer in `stores` whose own validity overlaps `range`, with stores that end up
 * empty dropped. The file's own window is *not* used as a shortcut — a file can hold a
 * coupon valid past its own `giltigt_till`, so each offer is judged on its own dates. */
export function filterStoresToRange(stores: StoreOffers[], range: DateRange): StoreOffers[] {
  const out: StoreOffers[] = []
  for (const store of stores) {
    const file = fileRange(store)
    const erbjudanden = store.erbjudanden.filter(o => rangesOverlap(offerRange(o, file), range))
    if (erbjudanden.length > 0) out.push({ ...store, erbjudanden, antal: erbjudanden.length })
  }
  return out
}

/**
 * Which saved ISO weeks could hold an offer valid during `range`, so only those get fetched.
 * The weeks the range itself touches, plus the one before it: a flyer filed under week N can
 * still be running on week N+1's first days (stores don't all run Mon–Sun), and a coupon in
 * it can run longer still. Intersected with the weeks that actually exist, so a week nobody
 * has imported is never requested.
 */
export function candidateWeeks(range: DateRange, available: string[]): string[] {
  const have = new Set(available)
  const weeks = new Set<string>()
  for (let d = addDays(range.from, -7); d <= range.to; d = addDays(d, 1)) {
    weeks.add(getISOWeekString(d))
  }
  return [...weeks].filter(w => have.has(w)).sort()
}

/** Today as an ISO date, matching how App.tsx builds the rolling window's first day. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const WEEKDAYS = ['sön', 'mån', 'tis', 'ons', 'tors', 'fre', 'lör']

function shortDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`
}

/**
 * A short note for an offer that doesn't cover the whole period being planned — "t.o.m. ons
 * 3/9" for one that runs out mid-week, "från fre 5/9" for one that hasn't started yet.
 * `null` when it covers the entire window, which is the normal case and needs no note.
 */
export function validityNote(range: DateRange, window: DateRange): string | null {
  const startsLate = range.from > window.from
  const endsEarly = range.to < window.to
  if (startsLate && endsEarly) return `${shortDate(range.from)}–${shortDate(range.to)}`
  if (startsLate) return `från ${shortDate(range.from)}`
  if (endsEarly) return `t.o.m. ${shortDate(range.to)}`
  return null
}

/** Human-readable "why is this empty" for a period no saved flyer covers, e.g.
 * "senast sparade veckan (v.35) gick ut lör 30/8". Null when something does cover it. */
export function staleWeekNote(stores: StoreOffers[], range: DateRange): string | null {
  if (stores.length === 0) return null
  const sorted = [...stores].sort((a, b) => a.giltigt_till.localeCompare(b.giltigt_till))
  const newest = sorted[sorted.length - 1]
  if (rangesOverlap(fileRange(newest), range)) return null
  const week = newest.vecka.split('-W')[1] ?? newest.vecka
  return `senast sparade veckan (v.${week}) gick ut ${shortDate(newest.giltigt_till)}`
}
