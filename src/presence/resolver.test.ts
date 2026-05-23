import { describe, it, expect } from 'vitest'
import { resolvePresence, resolvePresenceRange, addDays } from './resolver'
import { SEED_STORE } from './seed'
import type { Override, PresenceStore } from './types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function storeWith(overrides: Override[]): PresenceStore {
  return { ...SEED_STORE, overrides }
}

// Daniel's week anchor: 2026-05-22 (Fri)
// Daniel's week:  Fri 22 May → Sun 24 May 2026
// Off week:       Fri 29 May → Sun 31 May 2026
// Daniel's week:  Fri  5 Jun → Sun  7 Jun 2026
// Off week:       Fri 12 Jun → Sun 14 Jun 2026

// ── 1. Mon/Wed every week ────────────────────────────────────────────────────

describe('Mon and Wed — children every week', () => {
  it('resolves to Daniel + barn on every Monday and Wednesday for 4 consecutive weeks', () => {
    // 4 Mondays and 4 Wednesdays across 2 Daniel-weeks and 2 off-weeks
    const mondays = ['2026-05-25', '2026-06-01', '2026-06-08', '2026-06-15']
    const wednesdays = ['2026-05-27', '2026-06-03', '2026-06-10', '2026-06-17']

    for (const date of [...mondays, ...wednesdays]) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} should be Daniel + barn`).toBe('daniel-barn')
      expect(plan.portions, `${date} should have 3 portions`).toBe(3)
    }
  })
})

// ── 2. Tue/Thu never ─────────────────────────────────────────────────────────

describe('Tue and Thu — never Daniel dinner', () => {
  it('resolves to null on every Tuesday and Thursday for 4 weeks', () => {
    const tuesdays  = ['2026-05-26', '2026-06-02', '2026-06-09', '2026-06-16']
    const thursdays = ['2026-05-28', '2026-06-04', '2026-06-11', '2026-06-18']

    for (const date of [...tuesdays, ...thursdays]) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup, `${date} should have no group`).toBeNull()
      expect(plan.portions, `${date} should have 0 portions`).toBe(0)
    }
  })
})

// ── 3. Biweekly weekend ───────────────────────────────────────────────────────

describe('Fri/Sat/Sun — biweekly pattern', () => {
  const danielWeekends = [
    '2026-05-22', '2026-05-23', '2026-05-24',  // week 1 (anchor week)
    '2026-06-05', '2026-06-06', '2026-06-07',  // week 3
  ]
  const offWeekends = [
    '2026-05-29', '2026-05-30', '2026-05-31',  // week 2
    '2026-06-12', '2026-06-13', '2026-06-14',  // week 4
  ]

  it('resolves to Daniel + barn on Daniel-week weekends', () => {
    for (const date of danielWeekends) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} should be Daniel + barn`).toBe('daniel-barn')
      expect(plan.portions).toBe(3)
    }
  })

  it('resolves to null on off-week weekends', () => {
    for (const date of offWeekends) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup, `${date} should have no group`).toBeNull()
    }
  })
})

// ── 4. Override SET_GROUP ────────────────────────────────────────────────────

describe('Override: SET_GROUP', () => {
  it('forces a different group on the override date only', () => {
    const override: Override = {
      id: 'ov1',
      date: '2026-05-25',  // Monday — would normally be daniel-barn
      type: 'SET_GROUP',
      groupId: 'daniel-erika',
      appliesToRuleId: null,
    }
    const store = storeWith([override])

    const dayBefore = resolvePresence('2026-05-24', store)
    const overrideDay = resolvePresence('2026-05-25', store)
    const dayAfter = resolvePresence('2026-05-26', store)  // Tuesday → always null

    expect(dayBefore.activeGroup?.id).toBe('daniel-barn')   // Sunday of Daniel's week
    expect(overrideDay.activeGroup?.id).toBe('daniel-erika') // overridden
    expect(dayAfter.activeGroup).toBeNull()                  // Tuesday — no rule
  })
})

// ── 5. Override CLEAR ────────────────────────────────────────────────────────

describe('Override: CLEAR', () => {
  it('empties a day that would otherwise have an active group', () => {
    const override: Override = {
      id: 'ov2',
      date: '2026-05-27',  // Wednesday — normally daniel-barn
      type: 'CLEAR',
      groupId: null,
      appliesToRuleId: null,
    }
    const store = storeWith([override])

    const dayBefore = resolvePresence('2026-05-25', store)  // Monday
    const clearDay  = resolvePresence('2026-05-27', store)  // Wednesday (cleared)
    const dayAfter  = resolvePresence('2026-06-03', store)  // Next Wednesday

    expect(dayBefore.activeGroup?.id).toBe('daniel-barn')
    expect(clearDay.activeGroup).toBeNull()
    expect(clearDay.portions).toBe(0)
    expect(dayAfter.activeGroup?.id).toBe('daniel-barn')
  })
})

// ── 6. PHASE_FLIP ─────────────────────────────────────────────────────────────

describe('Override: PHASE_FLIP', () => {
  it('swaps weekend parity from the flip date onward, leaving earlier dates unchanged', () => {
    // Flip applied on 2026-05-29 (first off-week Friday).
    // Before the flip: anchor week = Daniel's → Fri 22 May fires, Fri 29 May does not.
    // After the flip:  parity inverted → Fri 29 May fires, Fri 5 Jun does not.
    const flip: Override = {
      id: 'flip1',
      date: '2026-05-29',
      type: 'PHASE_FLIP',
      groupId: null,
      appliesToRuleId: 'weekend-biweekly',
    }
    const store = storeWith([flip])

    // Dates before the flip — unaffected
    expect(resolvePresence('2026-05-22', store).activeGroup?.id).toBe('daniel-barn')
    expect(resolvePresence('2026-05-23', store).activeGroup?.id).toBe('daniel-barn')

    // First off-weekend becomes active (flip date itself)
    expect(resolvePresence('2026-05-29', store).activeGroup?.id).toBe('daniel-barn')
    expect(resolvePresence('2026-05-30', store).activeGroup?.id).toBe('daniel-barn')
    expect(resolvePresence('2026-05-31', store).activeGroup?.id).toBe('daniel-barn')

    // What was Daniel's week is now off
    expect(resolvePresence('2026-06-05', store).activeGroup).toBeNull()
    expect(resolvePresence('2026-06-06', store).activeGroup).toBeNull()
    expect(resolvePresence('2026-06-07', store).activeGroup).toBeNull()

    // Mon/Wed still unaffected (WEEKLY rule, not BIWEEKLY)
    expect(resolvePresence('2026-06-08', store).activeGroup?.id).toBe('daniel-barn')
  })
})

// ── 7. validFrom / validUntil ────────────────────────────────────────────────

describe('PresenceRule validity window', () => {
  it('does not fire before validFrom or after validUntil', () => {
    const limitedStore: PresenceStore = {
      ...SEED_STORE,
      rules: [
        {
          id: 'limited-mon-wed',
          groupId: 'daniel-barn',
          cadence: 'WEEKLY',
          weekdays: [1, 3],
          anchorDate: null,
          validFrom: '2026-06-01',
          validUntil: '2026-06-10',
          priority: 0,
        },
      ],
      overrides: [],
    }

    // Before window
    expect(resolvePresence('2026-05-25', limitedStore).activeGroup).toBeNull()  // Mon before window

    // Inside window
    expect(resolvePresence('2026-06-01', limitedStore).activeGroup?.id).toBe('daniel-barn')
    expect(resolvePresence('2026-06-03', limitedStore).activeGroup?.id).toBe('daniel-barn')
    expect(resolvePresence('2026-06-08', limitedStore).activeGroup?.id).toBe('daniel-barn')
    expect(resolvePresence('2026-06-10', limitedStore).activeGroup?.id).toBe('daniel-barn')

    // After window
    expect(resolvePresence('2026-06-15', limitedStore).activeGroup).toBeNull()  // Mon after window
  })
})

// ── Acceptance table (§6) ────────────────────────────────────────────────────

describe('Acceptance: 28-day table from 2026-05-22', () => {
  const WEEKDAYS = ['', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

  it('matches the §3 custody table and prints the visible schedule', () => {
    const plans = resolvePresenceRange('2026-05-22', addDays('2026-05-22', 27), SEED_STORE)

    console.log('\n  Veckodag  Datum        Grupp              Portioner')
    console.log('  ──────────────────────────────────────────────────')
    for (const p of plans) {
      const wd = p.date
      const d = new Date(wd + 'T00:00:00Z')
      const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
      const wdName = WEEKDAYS[dow].padEnd(8)
      const groupName = (p.activeGroup?.name ?? '—').padEnd(18)
      console.log(`  ${wdName}  ${p.date}   ${groupName} ${p.portions}`)
    }

    // Mon and Wed: always Daniel + barn (3)
    const monwed = plans.filter(p => {
      const d = new Date(p.date + 'T00:00:00Z')
      const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
      return dow === 1 || dow === 3
    })
    for (const p of monwed) {
      expect(p.activeGroup?.id, `${p.date} Mon/Wed`).toBe('daniel-barn')
    }

    // Tue and Thu: always null
    const tuesthu = plans.filter(p => {
      const d = new Date(p.date + 'T00:00:00Z')
      const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
      return dow === 2 || dow === 4
    })
    for (const p of tuesthu) {
      expect(p.activeGroup, `${p.date} Tue/Thu`).toBeNull()
    }

    // Daniel-week weekends fire; off-week weekends don't
    const danielWeekends = ['2026-05-22', '2026-05-23', '2026-05-24',
                            '2026-06-05', '2026-06-06', '2026-06-07']
    const offWeekends    = ['2026-05-29', '2026-05-30', '2026-05-31',
                            '2026-06-12', '2026-06-13', '2026-06-14']

    for (const date of danielWeekends) {
      const p = plans.find(x => x.date === date)!
      expect(p.activeGroup?.id, `${date} Daniel-weekend`).toBe('daniel-barn')
    }
    for (const date of offWeekends) {
      const p = plans.find(x => x.date === date)!
      expect(p.activeGroup, `${date} off-weekend`).toBeNull()
    }
  })
})
