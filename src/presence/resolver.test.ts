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
// Erika week:     Fri 29 May → Sun 31 May 2026
// Daniel's week:  Fri  5 Jun → Sun  7 Jun 2026
// Erika week:     Fri 12 Jun → Sun 14 Jun 2026

// ── 1. Monday + Daniel-week Wednesday — kids present ─────────────────────────

describe('Monday every week + Wednesday on Daniel-weeks — kids present', () => {
  it('resolves to Daniel + barn on every Monday', () => {
    // 4 Mondays across 2 Daniel-weeks and 2 Erika-weeks — Monday is always kids.
    const mondays = ['2026-05-25', '2026-06-01', '2026-06-08', '2026-06-15']
    for (const date of mondays) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} should be Daniel + barn`).toBe('daniel-barn')
      expect(plan.portions, `${date} should have 3 portions`).toBe(3)
    }
  })

  it('resolves to Daniel + barn on Daniel-week Wednesdays, Daniel + Erika on Erika-week Wednesdays', () => {
    const danielWeekWeds = ['2026-06-03', '2026-06-17']  // weeks of Jun 1 and Jun 15
    const erikaWeekWeds  = ['2026-05-27', '2026-06-10']  // weeks of May 25 and Jun 8
    for (const date of danielWeekWeds) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} Daniel-week Wed`).toBe('daniel-barn')
      expect(plan.portions).toBe(3)
    }
    for (const date of erikaWeekWeds) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} Erika-week Wed`).toBe('daniel-erika')
      expect(plan.portions).toBe(2)
    }
  })
})

// ── 2. Tue/Thu — Daniel alone on Daniel-weeks, Daniel + Erika on Erika-weeks ──

describe('Tue and Thu — never the kids', () => {
  it('Daniel alone on Daniel-week Tue/Thu', () => {
    const danielWeek = ['2026-06-02', '2026-06-04', '2026-06-16', '2026-06-18']
    for (const date of danielWeek) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} should be Daniel alone`).toBe('daniel')
      expect(plan.portions, `${date} should have 1 portion`).toBe(1)
    }
  })

  it('Daniel + Erika on Erika-week Tue/Thu', () => {
    const erikaWeek = ['2026-05-26', '2026-05-28', '2026-06-09', '2026-06-11']
    for (const date of erikaWeek) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} should be Daniel + Erika`).toBe('daniel-erika')
      expect(plan.portions, `${date} should have 2 portions`).toBe(2)
    }
  })
})

// ── 3. Biweekly weekend ───────────────────────────────────────────────────────

describe('Fri/Sat/Sun — biweekly pattern', () => {
  const danielWeekends = [
    '2026-05-22', '2026-05-23', '2026-05-24',  // week 1 (anchor week)
    '2026-06-05', '2026-06-06', '2026-06-07',  // week 3
  ]
  const erikaWeekends = [
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

  it('resolves to Daniel + Erika on Erika-week weekends', () => {
    for (const date of erikaWeekends) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} should be Daniel + Erika`).toBe('daniel-erika')
      expect(plan.portions).toBe(2)
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
    const dayAfter = resolvePresence('2026-05-26', store)  // Erika-week Tuesday

    expect(dayBefore.activeGroup?.id).toBe('daniel-barn')   // Sunday of Daniel's week
    expect(overrideDay.activeGroup?.id).toBe('daniel-erika') // overridden
    expect(dayAfter.activeGroup?.id).toBe('daniel-erika')   // Erika-week Tuesday
  })
})

// ── 5. Override CLEAR ────────────────────────────────────────────────────────

describe('Override: CLEAR', () => {
  it('empties a day that would otherwise have an active group', () => {
    const override: Override = {
      id: 'ov2',
      date: '2026-05-27',  // Erika-week Wednesday — normally daniel-erika
      type: 'CLEAR',
      groupId: null,
      appliesToRuleId: null,
    }
    const store = storeWith([override])

    const dayBefore = resolvePresence('2026-05-25', store)  // Monday
    const clearDay  = resolvePresence('2026-05-27', store)  // Wednesday (cleared)
    const dayAfter  = resolvePresence('2026-06-03', store)  // Daniel-week Wednesday

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

    // What was Daniel's kids-weekend now has no kids. Only weekend-biweekly was
    // flipped, so the Erika-week rule no longer claims it either → daniel-solo.
    expect(resolvePresence('2026-06-05', store).activeGroup?.id).toBe('daniel')
    expect(resolvePresence('2026-06-06', store).activeGroup?.id).toBe('daniel')
    expect(resolvePresence('2026-06-07', store).activeGroup?.id).toBe('daniel')

    // Monday still unaffected (WEEKLY rule, not BIWEEKLY)
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

    const groupAt = (date: string) => plans.find(p => p.date === date)!.activeGroup?.id ?? null

    // Monday: kids every week
    for (const date of ['2026-05-25', '2026-06-01', '2026-06-08', '2026-06-15']) {
      expect(groupAt(date), `${date} Monday`).toBe('daniel-barn')
    }

    // Wednesday: kids on Daniel-weeks, Daniel + Erika on Erika-weeks
    expect(groupAt('2026-06-03'), '2026-06-03 Daniel-week Wed').toBe('daniel-barn')
    expect(groupAt('2026-06-17'), '2026-06-17 Daniel-week Wed').toBe('daniel-barn')
    expect(groupAt('2026-05-27'), '2026-05-27 Erika-week Wed').toBe('daniel-erika')
    expect(groupAt('2026-06-10'), '2026-06-10 Erika-week Wed').toBe('daniel-erika')

    // Tue/Thu: Daniel alone on Daniel-weeks, Daniel + Erika on Erika-weeks
    for (const date of ['2026-06-02', '2026-06-04', '2026-06-16', '2026-06-18']) {
      expect(groupAt(date), `${date} Daniel-week Tue/Thu`).toBe('daniel')
    }
    for (const date of ['2026-05-26', '2026-05-28', '2026-06-09', '2026-06-11']) {
      expect(groupAt(date), `${date} Erika-week Tue/Thu`).toBe('daniel-erika')
    }

    // Weekends: Daniel + barn on Daniel-weeks, Daniel + Erika on Erika-weeks
    const danielWeekends = ['2026-05-22', '2026-05-23', '2026-05-24',
                            '2026-06-05', '2026-06-06', '2026-06-07']
    const erikaWeekends  = ['2026-05-29', '2026-05-30', '2026-05-31',
                            '2026-06-12', '2026-06-13', '2026-06-14']

    for (const date of danielWeekends) {
      expect(groupAt(date), `${date} Daniel-weekend`).toBe('daniel-barn')
    }
    for (const date of erikaWeekends) {
      expect(groupAt(date), `${date} Erika-weekend`).toBe('daniel-erika')
    }
  })
})
