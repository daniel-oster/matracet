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

// Custody schedule: real-world handover is Friday-to-Friday — the kids live with
// Daniel from a Friday morning handover through the following Friday morning, then
// the opposite for the alternating "mother week". A subtlety that broke the first
// version of this model: a Fri–Thu custody block SPANS TWO ISO calendar weeks (the
// Fri–Sun part is in one Mon-Sun week, the following Mon–Thu part is in the next),
// so a single BIWEEKLY anchor can't cover a whole block — Fri–Sun and Mon–Thu each
// need their own anchor, one ISO week apart, even though they belong to the same
// real-world custody block. Hence 4 rules instead of 2:
//
//   Dag      Daniel-vecka                 Mor-vecka
//   Mån–Tor  Daniel + barn                Daniel + Erika
//   Fre–Sön  Daniel + barn                Daniel + Erika
//
// NOTE: "Mor-vecka" means the kids are at their (biological) mother's — someone
// who isn't tracked as a Person in this app at all. The 'daniel-erika' group name
// is unrelated to that — it's just who's home eating dinner *at Daniel's* house
// during that week (Daniel + his girlfriend Erika), not who has the kids.
//
// (on top of the above — see mon-weekly*/wed-biweekly* below):
//   Mån/Ons på mor-vecka: barnen ändå hos Daniel.
//   Spring term (through 2026-06-01): skolans logistik, lämn 19:00 (mon-weekly/wed-biweekly).
//   Summer (2026-06-02 – 2026-08-16): samma undantag, men ingen strukturerad
//   lämningstid (mon-weekly-summer/wed-biweekly-summer).
//   Autumn term (from 2026-08-17): lämn 19:00 igen (mon-weekly-autumn2026/
//   wed-biweekly-autumn2026) — assumed same handover time as spring, unconfirmed.
//
// Priority: kids rules (2) win over the Erika-week rules (1), which win over the
// daniel-solo baseline (0). At most one rule of each priority fires on a day.
export const RULES: PresenceRule[] = [
  {
    // Spring-term instance: Monday always has kids, even on a mother-week, because
    // of school pickup logistics — includes a 19:00 structural handover tied to
    // that logistics. Ended 2026-06-01 when spring term ended; superseded by
    // mon-weekly-summer, then mon-weekly-autumn2026, below.
    id: 'mon-weekly',
    groupId: 'daniel-barn',
    cadence: 'WEEKLY',
    weekdays: [1],
    anchorDate: null,
    validFrom: '2026-01-01',
    validUntil: '2026-06-01',
    priority: 2,
    handoverByWeekday: { 1: '19:00' },
  },
  {
    // Spring-term instance: same Wednesday exception on mother-week Wednesdays.
    // Anchor 2026-05-22 puts this on the Wednesday of the ISO week that also
    // contains the May 29 mother-weekend (see comment above on ISO-week offsets).
    // Ended 2026-06-01 — see mon-weekly.
    id: 'wed-biweekly',
    groupId: 'daniel-barn',
    cadence: 'BIWEEKLY',
    weekdays: [3],
    anchorDate: '2026-05-22',
    validFrom: '2026-01-01',
    validUntil: '2026-06-01',
    priority: 2,
    handoverByWeekday: { 3: '19:00' },
  },
  {
    // Summer instance of the same Monday exception, but with NO structural
    // handover time — unlike school term, there's no fixed pickup logistics
    // driving a cutoff over summer. Runs until autumn term starts: Sarah's term
    // starts 2026-08-17, so validUntil is the day before. (Aug 17 and Aug 19
    // themselves are already a Daniel-custody week regardless of this rule, so the
    // exact boundary day doesn't change any actual outcome — confirmed against the
    // real custody calendar on 2026-07-11.)
    id: 'mon-weekly-summer',
    groupId: 'daniel-barn',
    cadence: 'WEEKLY',
    weekdays: [1],
    anchorDate: null,
    validFrom: '2026-06-02',
    validUntil: '2026-08-16',
    priority: 2,
  },
  {
    // Summer instance of the same Wednesday exception — same anchor (so the
    // biweekly parity lines up identically with the custody rotation), no
    // structural handover. See mon-weekly-summer.
    id: 'wed-biweekly-summer',
    groupId: 'daniel-barn',
    cadence: 'BIWEEKLY',
    weekdays: [3],
    anchorDate: '2026-05-22',
    validFrom: '2026-06-02',
    validUntil: '2026-08-16',
    priority: 2,
  },
  {
    // Autumn 2026 instance: resumes the school-term Monday exception with the
    // 19:00 structural handover (assumed unchanged from spring — confirm/adjust
    // once the autumn school logistics are actually known). validFrom the day
    // after mon-weekly-summer ends; validUntil open until spring term dates for
    // 2027 are set.
    id: 'mon-weekly-autumn2026',
    groupId: 'daniel-barn',
    cadence: 'WEEKLY',
    weekdays: [1],
    anchorDate: null,
    validFrom: '2026-08-17',
    validUntil: null,
    priority: 2,
    handoverByWeekday: { 1: '19:00' },
  },
  {
    // Autumn 2026 instance of the Wednesday exception — see mon-weekly-autumn2026.
    id: 'wed-biweekly-autumn2026',
    groupId: 'daniel-barn',
    cadence: 'BIWEEKLY',
    weekdays: [3],
    anchorDate: '2026-05-22',
    validFrom: '2026-08-17',
    validUntil: null,
    priority: 2,
    handoverByWeekday: { 3: '19:00' },
  },
  {
    // Fri–Sun of a Daniel custody block. Anchor: 2026-05-22 is a known instance.
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
    // Mon–Thu of a Daniel custody block (the block that starts the *previous*
    // Friday, e.g. 2026-05-22) — one ISO week later than that Friday, hence the
    // separate anchor 2026-05-25 (the Monday immediately following it).
    id: 'daniel-week-midweek',
    groupId: 'daniel-barn',
    cadence: 'BIWEEKLY',
    weekdays: [1, 2, 3, 4],
    anchorDate: '2026-05-25',
    validFrom: '2026-01-01',
    validUntil: null,
    priority: 2,
  },
  {
    // Fri–Sun of a mother custody block. Anchor: 2026-05-29 is a known instance.
    id: 'erika-week-biweekly',
    groupId: 'daniel-erika',
    cadence: 'BIWEEKLY',
    weekdays: [5, 6, 7],
    anchorDate: '2026-05-29',
    validFrom: '2026-01-01',
    validUntil: null,
    priority: 1,
  },
  {
    // Mon–Thu of a mother custody block — one ISO week after the mother-weekend's
    // week, hence anchor 2026-06-01 (the Monday following 2026-05-29).
    id: 'mother-week-midweek',
    groupId: 'daniel-erika',
    cadence: 'BIWEEKLY',
    weekdays: [1, 2, 3, 4],
    anchorDate: '2026-06-01',
    validFrom: '2026-01-01',
    validUntil: null,
    priority: 1,
  },
  {
    // Baseline: Daniel is always home. Loses to every rule above — with the two
    // midweek rules added, this should no longer surface in practice, but stays
    // as a safety net for any validity-window gap.
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
