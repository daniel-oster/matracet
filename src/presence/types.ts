// 1 = Monday … 7 = Sunday (ISO weekday numbering)
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type Cadence = 'WEEKLY' | 'BIWEEKLY'

export type OverrideType = 'SET_GROUP' | 'CLEAR' | 'PHASE_FLIP'

export interface Person {
  id: string
  name: string
}

export interface Group {
  id: string
  name: string
  memberPersonIds: string[]
}

export interface PresenceRule {
  id: string
  groupId: string
  cadence: Cadence
  weekdays: Weekday[]
  /** Reference date for biweekly parity (ISO YYYY-MM-DD). Ignored for WEEKLY. */
  anchorDate: string | null
  validFrom: string   // ISO date, inclusive
  validUntil: string | null  // ISO date, inclusive; null = open-ended
  priority: number
}

export interface Override {
  id: string
  date: string  // ISO date
  type: OverrideType
  /** Used by SET_GROUP */
  groupId: string | null
  /** Used by PHASE_FLIP — which biweekly rule to flip */
  appliesToRuleId: string | null
}

/** Derived result — never persisted. Computed on demand by the resolver. */
export interface DayPlan {
  date: string
  activeGroup: Group | null
  presentPersons: Person[]
  portions: number
}

export interface PresenceStore {
  persons: Person[]
  groups: Group[]
  rules: PresenceRule[]
  overrides: Override[]
}
