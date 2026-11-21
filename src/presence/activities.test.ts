import { describe, it, expect } from 'vitest'
import { resolvePresence, effectiveLeaveBy } from './resolver'
import { TEST_STORE } from './__fixtures__/testStore'
import type { Activity, PresenceStore } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function storeWith(overrides: Partial<PresenceStore>): PresenceStore {
  return { ...TEST_STORE, ...overrides }
}

/** A Monday — kids present every week. */
const MON_KIDS = '2026-06-01'

/** A Wednesday in a mother-week, term-time exception still active (kids present). */
const WED_KIDS = '2026-05-27'

/** A Friday in Vuxen A's custody week. */
const FRI_A = '2026-05-29'

/** A Friday in the Vuxen B-week (kids not present → Vuxen A + Vuxen B). */
const FRI_OFF = '2026-06-05'

/** A Sunday in Vuxen A's custody week. */
const SUN_A = '2026-05-31'

/** A Saturday in Vuxen A's custody week. */
const SAT_A = '2026-05-30'

/** A Tuesday in a mother-week, summer (past the school-term exception) — no kids, Vuxen A + Vuxen B. */
const TUE_MOTHER = '2026-06-09'

// ── 1. Presence gating ────────────────────────────────────────────────────────

describe('Presence gating', () => {
  it("Barn A's Monday Aktivitet E produces no constraint when Barn A is NOT present", () => {
    // Simulate a store where Barn A is not in the active group on a Monday.
    // We can do this by overriding to a group that doesn't include Barn A.
    const store = storeWith({
      overrides: [{
        id: 'ov-solo-only',
        date: MON_KIDS,
        type: 'SET_GROUP',
        groupId: 'grupp-solo',
        appliesToRuleId: null,
      }],
    })
    const plan = resolvePresence(MON_KIDS, store)
    expect(plan.activeGroup?.id).toBe('grupp-solo')

    // Barn A not present → her Aktivitet E should not appear in window-binding activities
    const akt5 = plan.activitiesToday.find(a => a.id === 'barn-a-mon-a5')
    expect(akt5, 'Aktivitet E should not appear in activitiesToday when Barn A is absent').toBeUndefined()

    // No Aktivitet E → no conflict (only handover 19:20 and Vuxen A's own activities, none here)
    // windowStatus should be BOUNDED (handover 19:20, no activity conflict)
    expect(plan.windowStatus).toBe('BOUNDED')
    expect(plan.windowEndsBy).toBe('19:20')
  })

  it("Barn A's Monday Aktivitet E produces a CONFLICT constraint when Barn A IS present", () => {
    const plan = resolvePresence(MON_KIDS, TEST_STORE)
    expect(plan.activeGroup?.id).toBe('grupp-barn')

    const akt5 = plan.activitiesToday.find(a => a.id === 'barn-a-mon-a5')
    expect(akt5).toBeDefined()
    expect(plan.windowStatus).toBe('CONFLICT')
  })
})

// ── 2. Timeless activities ─────────────────────────────────────────────────────

describe('Timeless / affectsWindow=false entries', () => {
  it('appear in activitiesToday but do not affect windowStatus or windowEndsBy', () => {
    const plan = resolvePresence(MON_KIDS, TEST_STORE)

    // Timeless activities for Mon: Barn A Skola: Ämne 1, Barn B Skola: Ämne 2, Barn B Skola: Ämne 1
    const timeless = plan.activitiesToday.filter(a => !a.affectsWindow)
    expect(timeless.length).toBeGreaterThan(0)
    expect(timeless.some(a => a.label === 'Skola: Ämne 1')).toBe(true)
    expect(timeless.some(a => a.label === 'Skola: Ämne 2')).toBe(true)

    // Window is CONFLICT due to Aktivitet E — timeless activities didn't contribute
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
  it("Barn B Aktivitet G (startTime 16:20, arriveBy 15:50): cutoff is 15:50 not 16:20", () => {
    const akt7 = TEST_STORE.activities!.find(a => a.id === 'barn-b-fri-a7')!
    expect(akt7).toBeDefined()
    expect(effectiveLeaveBy(akt7)).toBe('15:50')  // arriveBy wins over startTime
  })

  it("Barn A Aktivitet E (only startTime 18:20, no arriveBy/leaveBy): cutoff is 18:20", () => {
    const akt5 = TEST_STORE.activities!.find(a => a.id === 'barn-a-mon-a5')!
    expect(akt5).toBeDefined()
    expect(akt5.arriveBy).toBeNull()
    expect(akt5.leaveBy).toBeNull()
    expect(effectiveLeaveBy(akt5)).toBe('18:20')   // startTime is the fallback
  })

  it('leaveBy overrides arriveBy and startTime when all three are set', () => {
    const act: Activity = {
      id: 'test',
      personId: 'barn-a',
      label: 'Test',
      weekday: 1,
      startTime: '18:20',
      arriveBy: '18:05',
      leaveBy: '17:50',
      endTime: null,
      affectsWindow: true,
      validFrom: '2026-01-08',
      validUntil: null,
      notes: null,
    }
    expect(effectiveLeaveBy(act)).toBe('17:50')
  })

  it('returns null for a timeless activity with no startTime', () => {
    const akt1 = TEST_STORE.activities!.find(a => a.id === 'barn-a-mon-a1')!
    expect(effectiveLeaveBy(akt1)).toBeNull()
  })
})

// ── 4. BOUNDED day ────────────────────────────────────────────────────────────

describe('BOUNDED day', () => {
  it('Monday with only the 19:20 handover (no activities in store) → BOUNDED 19:20', () => {
    const store = storeWith({ activities: [] })
    const plan = resolvePresence(MON_KIDS, store)
    expect(plan.activeGroup?.id).toBe('grupp-barn')
    expect(plan.windowStatus).toBe('BOUNDED')
    expect(plan.windowEndsBy).toBe('19:20')
    expect(plan.eatEarlyBy).toBeNull()
    expect(plan.windowNotes).toContain('Överlämning 19:20')
  })

  it('Vuxen A-week Friday with activity cutoffs and no handover → BOUNDED, earliest cutoff wins', () => {
    // Aktivitet G effective leaveBy 15:50, Hiphop effective leaveBy 17:35 → min = 15:50
    const plan = resolvePresence(FRI_A, TEST_STORE)
    expect(plan.activeGroup?.id).toBe('grupp-barn')
    expect(plan.windowStatus).toBe('BOUNDED')
    expect(plan.windowEndsBy).toBe('15:50')
    expect(plan.eatEarlyBy).toBeNull()
  })
})

// ── 5. CONFLICT — Monday Aktivitet E ───────────────────────────────────────────────

describe('CONFLICT day — Monday Aktivitet E', () => {
  it('yields CONFLICT with eatEarlyBy before 18:20 and notes naming both handover and Aktivitet E', () => {
    const plan = resolvePresence(MON_KIDS, TEST_STORE)
    expect(plan.windowStatus).toBe('CONFLICT')
    expect(plan.windowEndsBy).toBeNull()

    // eatEarlyBy is before Barn A must leave (18:20 for Aktivitet E), earliest departure wins
    // Barn B's Aktivitet I has effectiveLeaveBy 17:35, which is earlier
    expect(plan.eatEarlyBy).toBe('17:35')

    // Notes must mention handover and Aktivitet E
    const handoverNote = plan.windowNotes.find(n => n.includes('Överlämning'))
    expect(handoverNote, 'windowNotes must mention handover').toBeDefined()
    const akt5Note = plan.windowNotes.find(n => n.includes('Aktivitet E'))
    expect(akt5Note, 'windowNotes must mention Aktivitet E').toBeDefined()
  })
})

// ── 6. CONFLICT — Wednesday Aktivitet F ─────────────────────────────────────────────

describe('CONFLICT day — Wednesday Aktivitet F', () => {
  it('arriveBy 18:50 against handoverBy 19:20 → CONFLICT, eatEarlyBy 18:50', () => {
    const plan = resolvePresence(WED_KIDS, TEST_STORE)
    expect(plan.windowStatus).toBe('CONFLICT')
    expect(plan.windowEndsBy).toBeNull()
    expect(plan.eatEarlyBy).toBe('18:50')

    const akt6Note = plan.windowNotes.find(n => n.includes('Aktivitet F'))
    expect(akt6Note, 'windowNotes must mention the Aktivitet F activity').toBeDefined()
    expect(plan.windowNotes.some(n => n.includes('Överlämning 19:20'))).toBe(true)
  })
})

// ── 7. OPEN day ───────────────────────────────────────────────────────────────

describe('OPEN day', () => {
  it('Vuxen A-week Saturday with no activities → OPEN, no cutoffs', () => {
    const plan = resolvePresence(SAT_A, TEST_STORE)
    expect(plan.activeGroup?.id).toBe('grupp-barn')
    expect(plan.windowStatus).toBe('OPEN')
    expect(plan.windowEndsBy).toBeNull()
    expect(plan.eatEarlyBy).toBeNull()
    expect(plan.activitiesToday).toHaveLength(0)
  })

  it('Mother-week Tuesday, summer (no kids) → Vuxen A + Vuxen B, OPEN regardless of activities', () => {
    const plan = resolvePresence(TUE_MOTHER, TEST_STORE)
    expect(plan.activeGroup?.id).toBe('grupp-vuxen-b')
    expect(plan.windowStatus).toBe('OPEN')
  })
})

// ── 8. Multiple activities same day (Sunday) ──────────────────────────────────

describe('Multiple activities same day — Sunday', () => {
  it('Aktivitet H (14:35, daytime) does NOT bound the dinner window; Aktivitet D (17:50) does', () => {
    const plan = resolvePresence(SUN_A, TEST_STORE)
    expect(plan.activeGroup?.id).toBe('grupp-barn')

    // Both Aktivitet H and Aktivitet D (and Aktivitet C) should appear in activitiesToday
    const akt8 = plan.activitiesToday.find(a => a.id === 'barn-b-sun-a8')
    expect(akt8, 'Aktivitet H should appear in activitiesToday for display').toBeDefined()
    const akt4 = plan.activitiesToday.find(a => a.id === 'barn-a-sun-a4')
    expect(akt4).toBeDefined()
    const akt3 = plan.activitiesToday.find(a => a.id === 'barn-a-sun-a3')
    expect(akt3).toBeDefined()

    // Aktivitet H (effective leaveBy 14:35) is below DINNER_WINDOW_START (15:00) → does not bound
    // Aktivitet C (effective leaveBy 12:05) is also below → does not bound
    // Aktivitet D (effective leaveBy 17:50) is >= 15:00 → bounds the window
    expect(plan.windowStatus).toBe('BOUNDED')
    expect(plan.windowEndsBy).toBe('17:50')

    // Aktivitet H should NOT appear in windowNotes as a dinner constraint
    const akt8Note = plan.windowNotes.find(n => n.includes('Aktivitet H') && n.includes('avgång'))
    expect(akt8Note, 'Aktivitet H should not bind the dinner window').toBeUndefined()

    // Aktivitet D should appear in windowNotes
    const akt4Note = plan.windowNotes.find(n => n.includes('Aktivitet D'))
    expect(akt4Note, 'Aktivitet D should be in windowNotes').toBeDefined()
  })

  it('Vuxen B-week Sunday (kids not present) → Vuxen A + Vuxen B, no kid activities, OPEN', () => {
    // 2026-06-07 is an Vuxen B-week Sunday
    const plan = resolvePresence('2026-06-07', TEST_STORE)
    expect(plan.activeGroup?.id).toBe('grupp-vuxen-b')
    expect(plan.windowStatus).toBe('OPEN')
    expect(plan.activitiesToday).toHaveLength(0)
  })
})

// ── 9. Off-week Friday — presence gating ──────────────────────────────────────

describe('Vuxen B-week Friday — kid activities do not appear', () => {
  it('kids not present on Vuxen B-week Friday → Vuxen A + Vuxen B, no kid activities', () => {
    const plan = resolvePresence(FRI_OFF, TEST_STORE)
    expect(plan.activeGroup?.id).toBe('grupp-vuxen-b')
    expect(plan.activitiesToday).toHaveLength(0)
    expect(plan.windowStatus).toBe('OPEN')
  })
})
