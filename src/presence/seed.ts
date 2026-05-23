import type { Group, Person, PresenceRule, PresenceStore } from './types'
import { ACTIVITIES } from './activities'

export const PERSONS: Person[] = [
  { id: 'daniel',    name: 'Daniel'    },
  { id: 'sarah',     name: 'Sarah'     },
  { id: 'annabelle', name: 'Annabelle' },
  { id: 'erika',     name: 'Erika'     },
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

export const RULES: PresenceRule[] = [
  {
    // Every Mon and Wed regardless of custody week.
    // Kids handed to mother at 19:00 on both days → structural dinner cutoff.
    id: 'mon-wed-weekly',
    groupId: 'daniel-barn',
    cadence: 'WEEKLY',
    weekdays: [1, 3],
    anchorDate: null,
    validFrom: '2026-01-01',
    validUntil: null,
    priority: 0,
    handoverByWeekday: { 1: '19:00', 3: '19:00' },
  },
  {
    // Fri–Sun on Daniel's custody weeks only
    // Anchor: 2026-05-22 is a known Daniel-week Friday
    id: 'weekend-biweekly',
    groupId: 'daniel-barn',
    cadence: 'BIWEEKLY',
    weekdays: [5, 6, 7],
    anchorDate: '2026-05-22',
    validFrom: '2026-01-01',
    validUntil: null,
    priority: 0,
    // No structural handover on Fri/Sat/Sun — Friday handover time varies;
    // use a per-day Override when needed.
  },
]

export const SEED_STORE: PresenceStore = {
  persons: PERSONS,
  groups: GROUPS,
  rules: RULES,
  overrides: [],
  activities: ACTIVITIES,
}
