import type { Group, Person, PresenceRule, PresenceStore } from './types'
import { ACTIVITIES } from './activities'

export const PERSONS: Person[] = [
  { id: 'daniel',    name: 'Daniel',    minRepeatGapDays: 0 },
  { id: 'sarah',     name: 'Sarah',     minRepeatGapDays: 1 },
  { id: 'annabelle', name: 'Annabelle', minRepeatGapDays: 1 },
  { id: 'erika',     name: 'Erika',     minRepeatGapDays: 0 },
]

export const GROUPS: Group[] = [
  {
    id: 'daniel-barn',
    name: 'Daniel + barn',
    memberPersonIds: ['daniel', 'sarah', 'annabelle'],
  },
  {
    id: 'daniel-erika',
    name: 'Daniel + Erika',
    memberPersonIds: ['daniel', 'erika'],
  },
  {
    id: 'daniel',
    name: 'Daniel',
    memberPersonIds: ['daniel'],
  },
]

// Custody schedule (biweekly, anchored to the known Daniel-week Friday 2026-05-22).
// Two complementary week types, so every day resolves to a concrete household —
// there are no "unknown" days in the seed:
//
//   Dag      Daniel-vecka (t.ex. v25)      Erika-vecka (t.ex. v26)
//   Mån      Daniel + barn (lämn 19:00)    Daniel + barn (lämn 19:00)
//   Tis      Daniel (ensam)                Daniel + Erika
//   Ons      Daniel + barn (lämn 19:00)    Daniel + Erika
//   Tor      Daniel (ensam)                Daniel + Erika
//   Fre–Sön  Daniel + barn                 Daniel + Erika
//
// Priority: kids rules (2) win over the Erika-week rule (1), which wins over the
// daniel-solo baseline (0). At most one rule of each priority fires on a day.
export const RULES: PresenceRule[] = [
  {
    // Monday every week: kids for dinner, handed to mother at 19:00.
    id: 'mon-weekly',
    groupId: 'daniel-barn',
    cadence: 'WEEKLY',
    weekdays: [1],
    anchorDate: null,
    validFrom: '2026-01-01',
    validUntil: null,
    priority: 2,
    handoverByWeekday: { 1: '19:00' },
  },
  {
    // Wednesday on Daniel-weeks only: kids for dinner, handover 19:00.
    // (On Erika-weeks Wednesday has no kids — see erika-week-biweekly.)
    id: 'wed-biweekly',
    groupId: 'daniel-barn',
    cadence: 'BIWEEKLY',
    weekdays: [3],
    anchorDate: '2026-05-22',
    validFrom: '2026-01-01',
    validUntil: null,
    priority: 2,
    handoverByWeekday: { 3: '19:00' },
  },
  {
    // Fri–Sun on Daniel's custody weeks only.
    // Anchor: 2026-05-22 is a known Daniel-week Friday.
    id: 'weekend-biweekly',
    groupId: 'daniel-barn',
    cadence: 'BIWEEKLY',
    weekdays: [5, 6, 7],
    anchorDate: '2026-05-22',
    validFrom: '2026-01-01',
    validUntil: null,
    priority: 2,
    // No structural handover on Fri/Sat/Sun — Friday handover time varies;
    // use a per-day Override when needed.
  },
  {
    // Erika-weeks: Daniel + Erika every day the kids are away (Tue–Sun).
    // Monday is excluded because the kids are here for Monday dinner every week.
    // Anchor: 2026-05-29 is a known Erika-week (off-week) Friday.
    id: 'erika-week-biweekly',
    groupId: 'daniel-erika',
    cadence: 'BIWEEKLY',
    weekdays: [2, 3, 4, 5, 6, 7],
    anchorDate: '2026-05-29',
    validFrom: '2026-01-01',
    validUntil: null,
    priority: 1,
  },
  {
    // Baseline: Daniel is always home. Loses to every rule above, so it only
    // surfaces on the days nothing else claims — Daniel-week Tue/Thu (eats alone).
    id: 'daniel-solo',
    groupId: 'daniel',
    cadence: 'WEEKLY',
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    anchorDate: null,
    validFrom: '2026-01-01',
    validUntil: null,
    priority: 0,
  },
]

export const SEED_STORE: PresenceStore = {
  persons: PERSONS,
  groups: GROUPS,
  rules: RULES,
  overrides: [],
  activities: ACTIVITIES,
}
