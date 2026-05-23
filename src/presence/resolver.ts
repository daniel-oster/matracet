import type { DayPlan, Group, Override, PresenceRule, PresenceStore, Weekday } from './types'

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

// ── Public API ─────────────────────────────────────────────────────────────────

export function resolvePresence(date: string, store: PresenceStore): DayPlan {
  const { persons, groups, rules, overrides } = store

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

  return {
    date,
    activeGroup: resolvedGroup,
    presentPersons,
    portions: presentPersons.length,
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
