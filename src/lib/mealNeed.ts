import type { MealKind } from '../types'
import type { Period } from '../presence/types'

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
 * på vardagar"): it fires only when a school-age child (a person with a `termin` period, see below) is among the day's eaters. A weekday
 * lunch on a mother-week (Vuxen A, or Vuxen A + Vuxen B) is left alone — nobody has said those
 * aren't wanted, and silently widening the rule would hide slots the household may well use.
 *
 * This is a *default*, never a lock: a slot that already has a dish still counts, the slot
 * stays pickable in the assign picker (marked "skoldag", sorted last), and nothing here ever
 * clears an assignment. See VeckanPlanner's `scheduleSkip` wiring.
 */

/** ISO weekday, 1 = Monday … 7 = Sunday. Parsed as UTC so a local timezone can never shift
 *  a date string onto the neighbouring day. */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

function covers(p: Period, date: string): boolean {
  return date >= p.from && (p.to === null || date <= p.to)
}

/**
 * Whether `personId` has school on `date`: a Mon–Fri date inside one of their `termin`
 * periods and not inside one of their `lov` periods. The periods come from the private repo
 * (`data/perioder.json`) — which children go to school, and when, is not something this
 * public code knows. A break inside a term (höstlov, jullov) therefore gives lunch at home
 * again without splitting the term in two.
 */
export function isSchoolDayFor(date: string, personId: string, periods: Period[]): boolean {
  if (isoWeekday(date) > 5) return false
  const mine = periods.filter(p => p.personIds.includes(personId) && covers(p, date))
  return mine.some(p => p.kind === 'termin') && !mine.some(p => p.kind === 'lov')
}

/**
 * Whether the schedule says this slot needs no meal at home. `presentIds` is the day's
 * effective attendance (`effectivePresentIds`); `null` means "unknown / assume everyone", in
 * which case nothing is skipped — the safe direction is to keep asking for a meal. So does a
 * missing `periods` (no token, not loaded yet).
 */
export function scheduleSkipsMeal(
  date: string,
  kind: MealKind,
  presentIds: string[] | null,
  periods: Period[] | null,
): boolean {
  if (kind !== 'lunch') return false
  if (presentIds === null || !periods) return false
  return presentIds.some(id => isSchoolDayFor(date, id, periods))
}

/** Short reason shown on a schedule-skipped slot chip in the assign picker. */
export const SCHEDULE_SKIP_SHORT = 'skoldag'
