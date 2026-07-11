import { describe, it, expect } from 'vitest'
import { resolvePresence, resolvePresenceRange, addDays } from './resolver'
import { SEED_STORE } from './seed'
import type { Override, PresenceStore } from './types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function storeWith(overrides: Override[]): PresenceStore {
  return { ...SEED_STORE, overrides }
}

// Real-world custody is Friday-to-Friday, but a Fri–Thu block spans two ISO
// calendar weeks (Fri–Sun is in one Mon-Sun week, Mon–Thu is in the next), so
// each half fires off its own anchor:
//
// Daniel block:  Fri 22 May – Thu 28 May 2026  (Fri-Sun anchor 2026-05-22,
//                                                Mon-Thu anchor 2026-05-25)
// Mother block:  Fri 29 May – Thu  4 Jun 2026  (Fri-Sun anchor 2026-05-29,
//                                                Mon-Thu anchor 2026-06-01)
// Daniel block:  Fri  5 Jun – Thu 11 Jun 2026
// Mother block:  Fri 12 Jun – Thu 18 Jun 2026
//
// Monday/Wednesday exception (kids visit even on a mother week) runs two back
// to back: school-term version (with a 19:00 structural handover) through
// 2026-06-01 inclusive, then a summer version (mon-weekly-summer /
// wed-biweekly-summer, no structural handover) from 2026-06-02 onward.

// ── 1. Daniel-week block: Fri–Thu, kids present throughout ──────────────────

describe('Daniel-week block (Fri–Thu) — kids present every day', () => {
  it('resolves to Daniel + barn for the whole Fri 22 May – Thu 28 May block', () => {
    const block = ['2026-05-22', '2026-05-23', '2026-05-24', '2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28']
    for (const date of block) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} should be Daniel + barn`).toBe('daniel-barn')
      expect(plan.portions, `${date} should have 3 portions`).toBe(3)
    }
  })

  it('resolves to Daniel + barn for the next block, Fri 5 Jun – Thu 11 Jun (past the summer cutoff)', () => {
    const block = ['2026-06-05', '2026-06-06', '2026-06-07', '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11']
    for (const date of block) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} should be Daniel + barn`).toBe('daniel-barn')
      expect(plan.portions).toBe(3)
    }
  })
})

// ── 2. Mother-week block, summer — Monday/Wednesday exception continues ─────

describe('Mother-week block (Fri–Thu), summer — Monday/Wednesday exception continues', () => {
  it('Monday and Wednesday still resolve to Daniel + barn, other days Daniel + Erika, for Fri 12 Jun – Thu 18 Jun', () => {
    const monWed = ['2026-06-15', '2026-06-17']
    for (const date of monWed) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} summer Mon/Wed exception`).toBe('daniel-barn')
      expect(plan.portions).toBe(3)
      expect(plan.windowNotes.some(n => n.startsWith('Överlämning')), `${date} has no structural handover in summer`).toBe(false)
    }
    const rest = ['2026-06-12', '2026-06-13', '2026-06-14', '2026-06-16', '2026-06-18']
    for (const date of rest) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} no exception`).toBe('daniel-erika')
      expect(plan.portions).toBe(2)
    }
  })
})

// ── 3. Mother-week block, term-time — Monday/Wednesday exception ────────────

describe('Mother-week block (Fri–Thu), term-time — Monday/Wednesday exception', () => {
  it('Monday and Wednesday still resolve to Daniel + barn (school logistics), other days Daniel + Erika', () => {
    // Fri 15 May – Thu 21 May 2026 is a mother block, entirely before the
    // 2026-06-01 summer cutoff, so the term-time exception is still active.
    const monWed = ['2026-05-18', '2026-05-20']
    for (const date of monWed) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} Mon/Wed exception`).toBe('daniel-barn')
      expect(plan.portions).toBe(3)
      expect(plan.windowNotes.some(n => n.startsWith('Överlämning 19:00')), `${date} has the term-time 19:00 handover`).toBe(true)
    }
    const rest = ['2026-05-15', '2026-05-16', '2026-05-19', '2026-05-21']
    for (const date of rest) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} no exception`).toBe('daniel-erika')
      expect(plan.portions).toBe(2)
    }
  })
})

// ── 4. This week (2026-07-06 onward) — the real motivating case ─────────────

describe('July 2026 — kids present Mon–Thu, gone Friday morning', () => {
  it('Mon 6 Jul – Thu 9 Jul (end of the block starting Fri 3 Jul) → Daniel + barn', () => {
    for (const date of ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09']) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} should be Daniel + barn`).toBe('daniel-barn')
    }
  })

  it('Fri 10 Jul – Thu 16 Jul (the following mother block) → Daniel + Erika, except the Mon/Wed summer exception', () => {
    for (const date of ['2026-07-10', '2026-07-11', '2026-07-12', '2026-07-14', '2026-07-16']) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} should be Daniel + Erika`).toBe('daniel-erika')
    }
    // Mon 13 Jul / Wed 15 Jul: summer Mon/Wed exception → Daniel + barn
    for (const date of ['2026-07-13', '2026-07-15']) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} summer Mon/Wed exception`).toBe('daniel-barn')
    }
  })
})

// ── 4b. Summer → autumn 2026 transition ──────────────────────────────────────

describe('Summer → autumn 2026 transition (2026-08-16/17 boundary)', () => {
  it('Mon 17 Aug / Wed 19 Aug are already a Daniel-custody week regardless of the Mon/Wed rule', () => {
    // Fri 14 Aug – Thu 20 Aug 2026 is a Daniel block, confirmed against the real
    // custody calendar on 2026-07-11 — so the exact summer/autumn boundary date
    // doesn't change the outcome for these two specific days.
    for (const date of ['2026-08-17', '2026-08-19']) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} Daniel block regardless`).toBe('daniel-barn')
    }
  })

  it('Mon 24 Aug / Wed 26 Aug (first mother-week Mon/Wed after the boundary) resolve to Daniel + barn with the 19:00 autumn handover', () => {
    for (const date of ['2026-08-24', '2026-08-26']) {
      const plan = resolvePresence(date, SEED_STORE)
      expect(plan.activeGroup?.id, `${date} autumn Mon/Wed exception`).toBe('daniel-barn')
      expect(plan.portions).toBe(3)
      expect(plan.windowNotes.some(n => n.startsWith('Överlämning 19:00')), `${date} has the autumn 19:00 handover`).toBe(true)
    }
  })
})

// ── 5. Override SET_GROUP ────────────────────────────────────────────────────

describe('Override: SET_GROUP', () => {
  it('forces a different group on the override date only', () => {
    const override: Override = {
      id: 'ov1',
      date: '2026-05-25',  // Daniel-week Monday — would normally be daniel-barn
      type: 'SET_GROUP',
      groupId: 'daniel-erika',
      appliesToRuleId: null,
    }
    const store = storeWith([override])

    const dayBefore = resolvePresence('2026-05-24', store)
    const overrideDay = resolvePresence('2026-05-25', store)
    const dayAfter = resolvePresence('2026-05-26', store)

    expect(dayBefore.activeGroup?.id).toBe('daniel-barn')   // Sunday of Daniel's block
    expect(overrideDay.activeGroup?.id).toBe('daniel-erika') // overridden
    expect(dayAfter.activeGroup?.id).toBe('daniel-barn')    // Daniel-week Tuesday, unaffected
  })
})

// ── 6. Override CLEAR ────────────────────────────────────────────────────────

describe('Override: CLEAR', () => {
  it('empties a day that would otherwise have an active group', () => {
    const override: Override = {
      id: 'ov2',
      date: '2026-06-16',  // Mother-week (summer) Tuesday — normally daniel-erika
      type: 'CLEAR',
      groupId: null,
      appliesToRuleId: null,
    }
    const store = storeWith([override])

    const dayBefore = resolvePresence('2026-06-15', store)  // Mother-week Monday — summer Mon exception fires
    const clearDay  = resolvePresence('2026-06-16', store)  // cleared
    const dayAfter  = resolvePresence('2026-06-08', store)  // Daniel-week Monday

    expect(dayBefore.activeGroup?.id).toBe('daniel-barn')
    expect(clearDay.activeGroup).toBeNull()
    expect(clearDay.portions).toBe(0)
    expect(dayAfter.activeGroup?.id).toBe('daniel-barn')
  })
})

// ── 7. PHASE_FLIP ─────────────────────────────────────────────────────────────

describe('Override: PHASE_FLIP', () => {
  it('swaps weekend parity from the flip date onward, leaving earlier dates unchanged', () => {
    // Flip applied on 2026-05-29 (first mother-weekend Friday).
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
    // flipped, so the mother-weekend rule doesn't claim it either → daniel-solo.
    expect(resolvePresence('2026-06-05', store).activeGroup?.id).toBe('daniel')
    expect(resolvePresence('2026-06-06', store).activeGroup?.id).toBe('daniel')
    expect(resolvePresence('2026-06-07', store).activeGroup?.id).toBe('daniel')

    // Monday 8 Jun still unaffected (daniel-week-midweek is a separate rule,
    // not flipped, and its own parity says Daniel-week for this date anyway)
    expect(resolvePresence('2026-06-08', store).activeGroup?.id).toBe('daniel-barn')
  })
})

// ── 8. validFrom / validUntil ────────────────────────────────────────────────

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

// ── Acceptance table ─────────────────────────────────────────────────────────

describe('Acceptance: 28-day table from 2026-05-22', () => {
  const WEEKDAYS = ['', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

  it('matches the corrected Fri–Thu custody model and prints the visible schedule', () => {
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

    // Daniel block: Fri 22 May – Thu 28 May
    for (const date of ['2026-05-22', '2026-05-23', '2026-05-24', '2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28']) {
      expect(groupAt(date), `${date} Daniel block`).toBe('daniel-barn')
    }

    // Mother block, term-time (Mon/Wed exception active): Fri 29 May – Thu 4 Jun
    expect(groupAt('2026-05-29'), '2026-05-29 mother weekend').toBe('daniel-erika')
    expect(groupAt('2026-05-30'), '2026-05-30 mother weekend').toBe('daniel-erika')
    expect(groupAt('2026-05-31'), '2026-05-31 mother weekend').toBe('daniel-erika')
    expect(groupAt('2026-06-01'), '2026-06-01 Monday exception (term-time, boundary day)').toBe('daniel-barn')
    expect(groupAt('2026-06-02'), '2026-06-02 no exception (Tuesday)').toBe('daniel-erika')
    expect(groupAt('2026-06-03'), '2026-06-03 Wednesday exception (summer version)').toBe('daniel-barn')
    expect(groupAt('2026-06-04'), '2026-06-04 no exception').toBe('daniel-erika')

    // Daniel block: Fri 5 Jun – Thu 11 Jun
    for (const date of ['2026-06-05', '2026-06-06', '2026-06-07', '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11']) {
      expect(groupAt(date), `${date} Daniel block`).toBe('daniel-barn')
    }

    // Mother block, summer: Fri 12 Jun – Thu 18 Jun — Mon/Wed exception still fires
    for (const date of ['2026-06-12', '2026-06-13', '2026-06-14', '2026-06-16', '2026-06-18']) {
      expect(groupAt(date), `${date} mother block, summer`).toBe('daniel-erika')
    }
    for (const date of ['2026-06-15', '2026-06-17']) {
      expect(groupAt(date), `${date} mother block, summer Mon/Wed exception`).toBe('daniel-barn')
    }
  })
})
