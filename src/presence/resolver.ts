import type {
  Activity,
  DayPlan,
  Group,
  Override,
  PresenceRule,
  PresenceStore,
  Weekday,
  WindowStatus,
} from './types'

// ── Date helpers ──────────────────────────────────────────────────────────────

function getUTCDate(isoDate: string): Date {
  return new Date(isoDate + 'T00:00:00Z')
}

/** ISO weekday of a date: 1=Mon … 7=Sun */
function isoWeekday(isoDate: string): Weekday {
  const d = getUTCDate(isoDate)
  const dow = d.getUTCDay()  // 0=Sun…6=Sat
  return (dow === 0 ? 7 : dow) as Weekday
}

/** Date of the Monday that starts the ISO week containing isoDate. */
function isoWeekMonday(isoDate: string): Date {
  const d = getUTCDate(isoDate)
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() - (dow - 1))
  return monday
}

/**
 * Number of complete ISO weeks from anchor to target, measured
 * Monday-to-Monday so parity is independent of which weekday the anchor
 * falls on.
 */
function weeksBetween(anchorDate: string, targetDate: string): number {
  const anchorMs = isoWeekMonday(anchorDate).getTime()
  const targetMs = isoWeekMonday(targetDate).getTime()
  return Math.round((targetMs - anchorMs) / (7 * 24 * 60 * 60 * 1000))
}

export function addDays(isoDate: string, n: number): string {
  const d = getUTCDate(isoDate)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// ── Rule firing ───────────────────────────────────────────────────────────────

function phaseFlipCount(ruleId: string, date: string, overrides: Override[]): number {
  return overrides.filter(
    o => o.type === 'PHASE_FLIP' && o.appliesToRuleId === ruleId && o.date <= date,
  ).length
}

function ruleFires(rule: PresenceRule, date: string, overrides: Override[]): boolean {
  const wd = isoWeekday(date)
  if (!(rule.weekdays as number[]).includes(wd)) return false

  if (rule.cadence === 'WEEKLY') return true

  // BIWEEKLY: fire only when ISO-week parity matches the anchor week
  if (!rule.anchorDate) return false
  const weeks = weeksBetween(rule.anchorDate, date)
  const flips = phaseFlipCount(rule.id, date, overrides)
  return (weeks + flips) % 2 === 0
}

function isInWindow(date: string, validFrom: string, validUntil: string | null): boolean {
  if (date < validFrom) return false
  if (validUntil !== null && date > validUntil) return false
  return true
}

// ── Window helpers ─────────────────────────────────────────────────────────────

/**
 * Effective departure cutoff for an activity, via the fallback chain:
 *   leaveBy → arriveBy → startTime
 * Returns null when no startTime is set (timeless entry).
 */
export function effectiveLeaveBy(act: Activity): string | null {
  if (!act.startTime) return null
  return act.leaveBy ?? act.arriveBy ?? act.startTime
}

/** Lexicographic minimum of a non-empty array of HH:MM strings. */
function minTime(times: string[]): string {
  return times.reduce((a, b) => (a <= b ? a : b))
}

/**
 * Activities are considered to plausibly overlap the dinner window only when
 * their effective departure is at or after this threshold. Earlier departures
 * (daytime excursions like Trav at 14:15) are shown in activitiesToday for
 * context but do not constrain the evening window.
 *
 * Rule: effective leaveBy >= 15:00 → may bind dinner.
 *       effective leaveBy <  15:00 → daytime, displayed only.
 */
const DINNER_WINDOW_START = '15:00'

interface WindowResult {
  activitiesToday: Activity[]
  windowStatus: WindowStatus
  windowEndsBy: string | null
  eatEarlyBy: string | null
  windowNotes: string[]
}

function computeWindow(
  date: string,
  weekday: Weekday,
  presentPersonIds: Set<string>,
  handoverBy: string | null,
  activities: Activity[],
  personNameById: Map<string, string>,
): WindowResult {
  // Gather activities for present persons on this weekday within their validity window
  const activitiesToday = activities.filter(a =>
    presentPersonIds.has(a.personId) &&
    a.weekday === weekday &&
    isInWindow(date, a.validFrom, a.validUntil),
  )

  if (presentPersonIds.size === 0) {
    return { activitiesToday: [], windowStatus: 'OPEN', windowEndsBy: null, eatEarlyBy: null, windowNotes: [] }
  }

  // Window-binding activities: affectsWindow=true AND effective leaveBy >= DINNER_WINDOW_START
  const windowBinding = activitiesToday.filter(a => {
    if (!a.affectsWindow) return false
    const eff = effectiveLeaveBy(a)
    return eff !== null && eff >= DINNER_WINDOW_START
  })

  // Build notes
  const notes: string[] = []
  if (handoverBy) {
    notes.push(`Överlämning ${handoverBy}`)
  }
  for (const a of windowBinding) {
    const eff = effectiveLeaveBy(a)!
    const name = personNameById.get(a.personId) ?? a.personId
    const endStr = a.endTime ? ` (klar ${a.endTime})` : ''
    notes.push(`${name}: ${a.label} → avgång ${eff}${endStr}`)
  }

  // Collect cutoffs
  const actCutoffs = windowBinding.map(a => effectiveLeaveBy(a)!)
  const allCutoffs = handoverBy ? [...actCutoffs, handoverBy] : actCutoffs

  if (allCutoffs.length === 0) {
    return { activitiesToday, windowStatus: 'OPEN', windowEndsBy: null, eatEarlyBy: null, windowNotes: notes }
  }

  const bindingCutoff = minTime(allCutoffs)

  // CONFLICT: at least one activity keeps the person out past the handover
  // Criterion: effectiveLeaveBy < handoverBy AND (endTime ?? '23:59') > handoverBy
  let hasConflict = false
  if (handoverBy) {
    hasConflict = windowBinding.some(a => {
      const eff = effectiveLeaveBy(a)!
      const end = a.endTime ?? '23:59'
      return eff < handoverBy && end > handoverBy
    })
  }

  if (hasConflict) {
    // eatEarlyBy = earliest activity departure (the last moment everyone can eat together)
    const eatEarlyBy = actCutoffs.length > 0 ? minTime(actCutoffs) : handoverBy
    return { activitiesToday, windowStatus: 'CONFLICT', windowEndsBy: null, eatEarlyBy, windowNotes: notes }
  }

  return { activitiesToday, windowStatus: 'BOUNDED', windowEndsBy: bindingCutoff, eatEarlyBy: null, windowNotes: notes }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function resolvePresence(date: string, store: PresenceStore): DayPlan {
  const { persons, groups, rules, overrides, activities = [] } = store

  const groupById = (id: string): Group | null =>
    groups.find(g => g.id === id) ?? null

  // 1. Rules valid on this date
  const activeRules = rules.filter(r => isInWindow(date, r.validFrom, r.validUntil))

  // 2. Rules that fire today
  const firingRules = activeRules.filter(r => ruleFires(r, date, overrides))

  // 3. Pick winner: highest priority; ties broken by lowest id (lexicographic)
  let resolvedGroup: Group | null = null
  if (firingRules.length > 0) {
    const winner = [...firingRules].sort((a, b) =>
      b.priority !== a.priority
        ? b.priority - a.priority
        : a.id < b.id ? -1 : 1,
    )[0]
    resolvedGroup = groupById(winner.groupId)
  }

  // 4. Overrides always win (PHASE_FLIP is already consumed in step 2)
  for (const ov of overrides.filter(o => o.date === date && o.type !== 'PHASE_FLIP')) {
    if (ov.type === 'SET_GROUP') {
      resolvedGroup = ov.groupId ? groupById(ov.groupId) : null
    } else if (ov.type === 'CLEAR') {
      resolvedGroup = null
    }
  }

  const presentPersons = resolvedGroup
    ? resolvedGroup.memberPersonIds
        .map(id => persons.find(p => p.id === id))
        .filter((p): p is (typeof persons)[0] => p !== undefined)
    : []

  // 5. Handover constraint: taken from any firing rule that declares one for this weekday.
  //    Independent of overrides — the custody handover time is a real-world fact.
  const wd = isoWeekday(date)
  let handoverBy: string | null = null
  for (const r of firingRules) {
    const t = r.handoverByWeekday?.[wd]
    if (t !== undefined) { handoverBy = t; break }
  }

  // 6. Compute eating window
  const presentPersonIds = new Set(presentPersons.map(p => p.id))
  const personNameById = new Map(persons.map(p => [p.id, p.name]))
  const windowResult = computeWindow(date, wd, presentPersonIds, handoverBy, activities, personNameById)

  return {
    date,
    activeGroup: resolvedGroup,
    presentPersons,
    portions: presentPersons.length,
    ...windowResult,
  }
}

export function resolvePresenceRange(
  startDate: string,
  endDate: string,
  store: PresenceStore,
): DayPlan[] {
  const plans: DayPlan[] = []
  let current = startDate
  while (current <= endDate) {
    plans.push(resolvePresence(current, store))
    current = addDays(current, 1)
  }
  return plans
}
