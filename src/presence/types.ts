// 1 = Monday … 7 = Sunday (ISO weekday numbering)
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type Cadence = 'WEEKLY' | 'BIWEEKLY'

export type OverrideType = 'SET_GROUP' | 'CLEAR' | 'PHASE_FLIP'

export type WindowStatus = 'OPEN' | 'BOUNDED' | 'CONFLICT'

export interface Person {
  id: string
  name: string
  /** Minimum days that must be skipped between two servings of the same dish for this
   *  person to be comfortable. 0 = no gap needed (e.g. Daniel). 1 = skip at least 1 day.
   *  Used by the Side B spacing check; undefined treated as 0. */
  minRepeatGapDays?: number
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
  /** Per-weekday structural handover times (HH:MM). When the rule fires, the given
   *  weekday inherits a "dinner must end by X" constraint from the custody handover. */
  handoverByWeekday?: Partial<Record<Weekday, string>>
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

/** A recurring activity owned by a person. Only constrains a day when the owner
 *  is present (as determined by the presence resolver). */
export interface Activity {
  id: string
  personId: string
  label: string
  weekday: Weekday
  /** When the activity begins. The only required timing field; drives the fallback
   *  chain for the effective departure cutoff. null for timeless/daytime entries. */
  startTime: string | null    // HH:MM
  /** Optional: when you must arrive. Narrows the cutoff below startTime. */
  arriveBy: string | null     // HH:MM
  /** Optional: when you must leave home. Narrows the cutoff below arriveBy. */
  leaveBy: string | null      // HH:MM
  /** Optional: when they return. Stored for future late-eating logic (Prompt 3). */
  endTime: string | null      // HH:MM
  /** false for timeless/daytime entries — stored for display but never affect the
   *  eating-window math. */
  affectsWindow: boolean
  validFrom: string           // ISO date, inclusive
  validUntil: string | null   // ISO date, inclusive; null = open-ended
  notes: string | null
}

/** Derived result — never persisted. Computed on demand by the resolver. */
export interface DayPlan {
  date: string
  activeGroup: Group | null
  presentPersons: Person[]
  portions: number
  /** All activities for present persons today (incl. timeless, for display). */
  activitiesToday: Activity[]
  /** Whether a coherent dinner window exists. */
  windowStatus: WindowStatus
  /** Binding cutoff (HH:MM) for a BOUNDED day, e.g. "19:00". */
  windowEndsBy: string | null
  /** Suggested eat-early time (HH:MM) for a CONFLICT day. */
  eatEarlyBy: string | null
  /** Human-readable explanation of each contributing constraint. */
  windowNotes: string[]
}

export interface PresenceStore {
  persons: Person[]
  groups: Group[]
  rules: PresenceRule[]
  overrides: Override[]
  /** Optional; if omitted, no activity constraints are applied. */
  activities?: Activity[]
}
