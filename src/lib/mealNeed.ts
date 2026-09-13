import type { MealKind } from '../types'

/**
 * Which meal slots the *schedule* says nobody needs at home — as opposed to
 * `MealAttendance.skip`, which is a manual, per-slot "no meal needed tonight" the household
 * ticks by hand (eating out, etc.).
 *
 * The one rule so far, reported 2026-09 once the autumn term started: **on a school-term
 * weekday with the kids here, no lunch is needed at home** — the kids eat at school and the
 * adults at work. Before this, Planera counted all 14 slots in the rolling window as needing
 * a meal, so a normal term week opened with ~5 lunch "gaps" that were never real work, and
 * the budget ("N av M måltider klara") could never reach M.
 *
 * Deliberately narrow, matching what was actually asked ("lunch på barnveckor behöver vi inte
 * på vardagar"): it fires only when a school-age child is among the day's eaters. A weekday
 * lunch on a mother-week (Daniel, or Daniel + Erika) is left alone — nobody has said those
 * aren't wanted, and silently widening the rule would hide slots the household may well use.
 *
 * This is a *default*, never a lock: a slot that already has a dish still counts, the slot
 * stays pickable in the assign picker (marked "skoldag", sorted last), and nothing here ever
 * clears an assignment. See VeckanPlanner's `scheduleSkip` wiring.
 */

/** A school term. Outside every period (summer, and any break added later) weekday lunches
 *  are needed at home again, which is exactly how it worked over the 2026 summer. */
export interface TermPeriod {
  id: string
  label: string
  /** ISO date, inclusive. */
  from: string
  /** ISO date, inclusive; null = open-ended. */
  until: string | null
}

/**
 * Term windows. Mirrors the presence rules' own spring/summer/autumn split in
 * `src/presence/seed.ts` (`mon-weekly` → `mon-weekly-summer` → `mon-weekly-autumn2026`) and
 * uses the same autumn start date, 2026-08-17.
 *
 * Known gap, stated rather than silently assumed: school breaks *inside* a term (höstlov,
 * jullov, sportlov) aren't modelled — on those weekdays the app will still say no lunch is
 * needed. Add them as gaps here (split a period, or add an exclusion list) once the actual
 * dates are known; until then a break week is handled the same way any other exception is,
 * by planning the lunch anyway from the picker.
 */
export const TERM_PERIODS: TermPeriod[] = [
  { id: 'vt2026', label: 'Vårterminen 2026', from: '2026-01-07', until: '2026-06-01' },
  { id: 'ht2026', label: 'Höstterminen 2026', from: '2026-08-17', until: null },
]

/** The school-age children — the eaters whose presence makes a weekday a "school day" here.
 *  Ids match `public/data/eaters.json` / `src/presence/seed.ts`. */
export const SCHOOL_CHILD_IDS = ['sarah', 'annabelle']

/** ISO weekday, 1 = Monday … 7 = Sunday. Parsed as UTC so a local timezone can never shift
 *  a date string onto the neighbouring day. */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

export function isTermDate(date: string, periods: TermPeriod[] = TERM_PERIODS): boolean {
  return periods.some(p => date >= p.from && (p.until === null || date <= p.until))
}

/** A term weekday (Mon–Fri) — i.e. a day the kids are at school and the adults at work. */
export function isSchoolDay(date: string, periods: TermPeriod[] = TERM_PERIODS): boolean {
  return isoWeekday(date) <= 5 && isTermDate(date, periods)
}

/**
 * Whether the schedule says this slot needs no meal at home. `presentIds` is the day's
 * effective attendance (`effectivePresentIds`); `null` means "unknown / assume everyone", in
 * which case nothing is skipped — the safe direction is to keep asking for a meal.
 */
export function scheduleSkipsMeal(
  date: string,
  kind: MealKind,
  presentIds: string[] | null,
  periods: TermPeriod[] = TERM_PERIODS,
): boolean {
  if (kind !== 'lunch') return false
  if (presentIds === null) return false
  if (!isSchoolDay(date, periods)) return false
  return presentIds.some(id => SCHOOL_CHILD_IDS.includes(id))
}

/** Short reason shown on a schedule-skipped slot chip in the assign picker. */
export const SCHEDULE_SKIP_SHORT = 'skoldag'
