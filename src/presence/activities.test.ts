import { describe, it, expect } from 'vitest'
import { resolvePresence, effectiveLeaveBy } from './resolver'
import { SEED_STORE, PERSONS, GROUPS, RULES } from './seed'
import { ACTIVITIES } from './activities'
import type { Activity, PresenceStore } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function storeWith(overrides: Partial<PresenceStore>): PresenceStore {
  return { ...SEED_STORE, ...overrides }
}

/** A Monday — kids present every week. */
const MON_KIDS = '2026-05-25'

/** A Wednesday in a Daniel-week (kids present). On Erika-weeks Wednesday has no kids. */
const WED_KIDS = '2026-06-03'

/** A Friday in Daniel's custody week. */
const FRI_DANIEL = '2026-05-22'

/** A Friday in the Erika-week (kids not present → Daniel + Erika). */
const FRI_OFF = '2026-05-29'

/** A Sunday in Daniel's custody week. */
const SUN_DANIEL = '2026-05-24'

/** A Saturday in Daniel's custody week. */
const SAT_DANIEL = '2026-05-23'

/** A Tuesday in a Daniel-week — Daniel eats alone (no kids, no Erika). */
const TUE_SOLO = '2026-06-02'

// ── 1. Presence gating ────────────────────────────────────────────────────────

describe('Presence gating', () => {
  it("Sarah's Monday Teater produces no constraint when Sarah is NOT present", () => {
    // Simulate a store where Sarah is not in the active group on a Monday.
    // We can do this by overriding to a group that doesn't include Sarah.
    const store = storeWith({
      overrides: [{
        id: 'ov-daniel-only',
        date: MON_KIDS,
        type: 'SET_GROUP',
        groupId: 'daniel',
        appliesToRuleId: null,
      }],
    })
    const plan = resolvePresence(MON_KIDS, store)
    expect(plan.activeGroup?.id).toBe('daniel')

    // Sarah not present → her Teater should not appear in window-binding activities
    const teater = plan.activitiesToday.find(a => a.id === 'sarah-mon-teater')
    expect(teater, 'Teater should not appear in activitiesToday when Sarah is absent').toBeUndefined()

    // No Teater → no conflict (only handover 19:00 and Daniel's own activities, none here)
    // windowStatus should be BOUNDED (handover 19:00, no activity conflict)
    expect(plan.windowStatus).toBe('BOUNDED')
    expect(plan.windowEndsBy).toBe('19:00')
  })

  it("Sarah's Monday Teater produces a CONFLICT constraint when Sarah IS present", () => {
    const plan = resolvePresence(MON_KIDS, SEED_STORE)
    expect(plan.activeGroup?.id).toBe('daniel-barn')

    const teater = plan.activitiesToday.find(a => a.id === 'sarah-mon-teater')
    expect(teater).toBeDefined()
    expect(plan.windowStatus).toBe('CONFLICT')
  })
})

// ── 2. Timeless activities ─────────────────────────────────────────────────────

describe('Timeless / affectsWindow=false entries', () => {
  it('appear in activitiesToday but do not affect windowStatus or windowEndsBy', () => {
    const plan = resolvePresence(MON_KIDS, SEED_STORE)

    // Timeless activities for Mon: Sarah Skola: Idrott, Annabelle Skola: Klarinett, Annabelle Skola: Idrott
    const timeless = plan.activitiesToday.filter(a => !a.affectsWindow)
    expect(timeless.length).toBeGreaterThan(0)
    expect(timeless.some(a => a.label === 'Skola: Idrott')).toBe(true)
    expect(timeless.some(a => a.label === 'Skola: Klarinett')).toBe(true)

    // Window is CONFLICT due to Teater — timeless activities didn't contribute
    // (Verify none of the timeless activities appear in windowNotes as window drivers)
    for (const t of timeless) {
      // Timeless don't produce a "avgång" note
      const note = plan.windowNotes.find(n => n.includes(t.label) && n.includes('avgång'))
      expect(note, `Timeless activity "${t.label}" should not be in window notes`).toBeUndefined()
    }
  })
})

// ── 3. Fallback chain for effective leaveBy ────────────────────────────────────

describe('effectiveLeaveBy fallback chain', () => {
  it("Annabelle Ridning (startTime 16:00, arriveBy 15:30): cutoff is 15:30 not 16:00", () => {
    const ridning = ACTIVITIES.find(a => a.id === 'annabelle-fri-ridning')!
    expect(ridning).toBeDefined()
    expect(effectiveLeaveBy(ridning)).toBe('15:30')  // arriveBy wins over startTime
  })

  it("Sarah Teater (only startTime 18:00, no arriveBy/leaveBy): cutoff is 18:00", () => {
    const teater = ACTIVITIES.find(a => a.id === 'sarah-mon-teater')!
    expect(teater).toBeDefined()
    expect(teater.arriveBy).toBeNull()
    expect(teater.leaveBy).toBeNull()
    expect(effectiveLeaveBy(teater)).toBe('18:00')   // startTime is the fallback
  })

  it('leaveBy overrides arriveBy and startTime when all three are set', () => {
    const act: Activity = {
      id: 'test',
      personId: 'sarah',
      label: 'Test',
      weekday: 1,
      startTime: '18:00',
      arriveBy: '17:45',
      leaveBy: '17:30',
      endTime: null,
      affectsWindow: true,
      validFrom: '2026-01-01',
      validUntil: null,
      notes: null,
    }
    expect(effectiveLeaveBy(act)).toBe('17:30')
  })

  it('returns null for a timeless activity with no startTime', () => {
    const idrott = ACTIVITIES.find(a => a.id === 'sarah-mon-idrott')!
    expect(effectiveLeaveBy(idrott)).toBeNull()
  })
})

// ── 4. BOUNDED day ────────────────────────────────────────────────────────────

describe('BOUNDED day', () => {
  it('Monday with only the 19:00 handover (no activities in store) → BOUNDED 19:00', () => {
    const store = storeWith({ activities: [] })
    const plan = resolvePresence(MON_KIDS, store)
    expect(plan.activeGroup?.id).toBe('daniel-barn')
    expect(plan.windowStatus).toBe('BOUNDED')
    expect(plan.windowEndsBy).toBe('19:00')
    expect(plan.eatEarlyBy).toBeNull()
    expect(plan.windowNotes).toContain('Överlämning 19:00')
  })

  it('Daniel-week Friday with activity cutoffs and no handover → BOUNDED, earliest cutoff wins', () => {
    // Ridning effective leaveBy 15:30, Hiphop effective leaveBy 17:15 → min = 15:30
    const plan = resolvePresence(FRI_DANIEL, SEED_STORE)
    expect(plan.activeGroup?.id).toBe('daniel-barn')
    expect(plan.windowStatus).toBe('BOUNDED')
    expect(plan.windowEndsBy).toBe('15:30')
    expect(plan.eatEarlyBy).toBeNull()
  })
})

// ── 5. CONFLICT — Monday Teater ───────────────────────────────────────────────

describe('CONFLICT day — Monday Teater', () => {
  it('yields CONFLICT with eatEarlyBy before 18:00 and notes naming both handover and Teater', () => {
    const plan = resolvePresence(MON_KIDS, SEED_STORE)
    expect(plan.windowStatus).toBe('CONFLICT')
    expect(plan.windowEndsBy).toBeNull()

    // eatEarlyBy is before Sarah must leave (18:00 for Teater), earliest departure wins
    // Annabelle's Modern has effectiveLeaveBy 17:15, which is earlier
    expect(plan.eatEarlyBy).toBe('17:15')

    // Notes must mention handover and Teater
    const handoverNote = plan.windowNotes.find(n => n.includes('Överlämning'))
    expect(handoverNote, 'windowNotes must mention handover').toBeDefined()
    const teaterNote = plan.windowNotes.find(n => n.includes('Teater'))
    expect(teaterNote, 'windowNotes must mention Teater').toBeDefined()
  })
})

// ── 6. CONFLICT — Wednesday Twerk ─────────────────────────────────────────────

describe('CONFLICT day — Wednesday Twerk', () => {
  it('arriveBy 18:30 against handoverBy 19:00 → CONFLICT, eatEarlyBy 18:30', () => {
    const plan = resolvePresence(WED_KIDS, SEED_STORE)
    expect(plan.windowStatus).toBe('CONFLICT')
    expect(plan.windowEndsBy).toBeNull()
    expect(plan.eatEarlyBy).toBe('18:30')

    const tworkNote = plan.windowNotes.find(n => n.includes('Twerk') || n.includes('Dancehall'))
    expect(tworkNote, 'windowNotes must mention the Twerk activity').toBeDefined()
    expect(plan.windowNotes.some(n => n.includes('Överlämning 19:00'))).toBe(true)
  })
})

// ── 7. OPEN day ───────────────────────────────────────────────────────────────

describe('OPEN day', () => {
  it('Daniel-week Saturday with no activities → OPEN, no cutoffs', () => {
    const plan = resolvePresence(SAT_DANIEL, SEED_STORE)
    expect(plan.activeGroup?.id).toBe('daniel-barn')
    expect(plan.windowStatus).toBe('OPEN')
    expect(plan.windowEndsBy).toBeNull()
    expect(plan.eatEarlyBy).toBeNull()
    expect(plan.activitiesToday).toHaveLength(0)
  })

  it('Daniel-week Tuesday (Daniel alone) → OPEN regardless of activities', () => {
    const plan = resolvePresence(TUE_SOLO, SEED_STORE)
    expect(plan.activeGroup?.id).toBe('daniel')
    expect(plan.windowStatus).toBe('OPEN')
  })
})

// ── 8. Multiple activities same day (Sunday) ──────────────────────────────────

describe('Multiple activities same day — Sunday', () => {
  it('Trav (14:15, daytime) does NOT bound the dinner window; Jazz (17:30) does', () => {
    const plan = resolvePresence(SUN_DANIEL, SEED_STORE)
    expect(plan.activeGroup?.id).toBe('daniel-barn')

    // Both Trav and Jazz (and Feminine Vibe) should appear in activitiesToday
    const trav = plan.activitiesToday.find(a => a.id === 'annabelle-sun-trav')
    expect(trav, 'Trav should appear in activitiesToday for display').toBeDefined()
    const jazz = plan.activitiesToday.find(a => a.id === 'sarah-sun-jazz')
    expect(jazz).toBeDefined()
    const feminine = plan.activitiesToday.find(a => a.id === 'sarah-sun-feminine')
    expect(feminine).toBeDefined()

    // Trav (effective leaveBy 14:15) is below DINNER_WINDOW_START (15:00) → does not bound
    // Feminine Vibe (effective leaveBy 11:45) is also below → does not bound
    // Jazz (effective leaveBy 17:30) is >= 15:00 → bounds the window
    expect(plan.windowStatus).toBe('BOUNDED')
    expect(plan.windowEndsBy).toBe('17:30')

    // Trav should NOT appear in windowNotes as a dinner constraint
    const travNote = plan.windowNotes.find(n => n.includes('Trav') && n.includes('avgång'))
    expect(travNote, 'Trav should not bind the dinner window').toBeUndefined()

    // Jazz should appear in windowNotes
    const jazzNote = plan.windowNotes.find(n => n.includes('Jazz'))
    expect(jazzNote, 'Jazz should be in windowNotes').toBeDefined()
  })

  it('Erika-week Sunday (kids not present) → Daniel + Erika, no kid activities, OPEN', () => {
    // 2026-05-31 is an Erika-week Sunday
    const plan = resolvePresence('2026-05-31', SEED_STORE)
    expect(plan.activeGroup?.id).toBe('daniel-erika')
    expect(plan.windowStatus).toBe('OPEN')
    expect(plan.activitiesToday).toHaveLength(0)
  })
})

// ── 9. Off-week Friday — presence gating ──────────────────────────────────────

describe('Erika-week Friday — kid activities do not appear', () => {
  it('kids not present on Erika-week Friday → Daniel + Erika, no kid activities', () => {
    const plan = resolvePresence(FRI_OFF, SEED_STORE)
    expect(plan.activeGroup?.id).toBe('daniel-erika')
    expect(plan.activitiesToday).toHaveLength(0)
    expect(plan.windowStatus).toBe('OPEN')
  })
})
