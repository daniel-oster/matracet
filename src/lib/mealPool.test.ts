import { describe, expect, it } from 'vitest'
import {
  buildPoolRows, checkPoolCompleteness, computeBudget, filterEntriesToWindow, reconcilePoolEntries,
  resolveDisplacedOccupant, sortPoolRows, type BudgetSlotFlags, type FilledSlot,
} from './mealPool'
import type { MealPoolEntry } from '../hooks/useMealPool'
import type { WeekPlanStore } from '../hooks/useWeekPlan'

function entry(overrides: Partial<MealPoolEntry> = {}): MealPoolEntry {
  return {
    id: 'a',
    mealSlug: 'tacos',
    receptSlug: null,
    addedAt: '2026-08-01T00:00:00.000Z',
    slot: null,
    ...overrides,
  }
}

describe('reconcilePoolEntries', () => {
  it('leaves an unslotted entry untouched', () => {
    const e = entry()
    expect(reconcilePoolEntries([e], {})).toEqual([e])
  })

  it('leaves a slot pointer that still matches the weekplan', () => {
    const e = entry({ slot: { date: '2026-08-03', kind: 'dinner' } })
    const weekPlan: WeekPlanStore = {
      '2026-08-03': { dinner: { mealSlug: 'tacos', receptSlug: null, updatedAt: 't' } },
    }
    expect(reconcilePoolEntries([e], weekPlan)).toEqual([e])
  })

  it('drops a stale pointer whose slot no longer holds this mealSlug', () => {
    const e = entry({ slot: { date: '2026-08-03', kind: 'dinner' } })
    const weekPlan: WeekPlanStore = {
      '2026-08-03': { dinner: { mealSlug: 'hamburgare', receptSlug: null, updatedAt: 't' } },
    }
    expect(reconcilePoolEntries([e], weekPlan)).toEqual([{ ...e, slot: null }])
  })

  it('drops a pointer whose slot has been cleared entirely', () => {
    const e = entry({ slot: { date: '2026-08-03', kind: 'dinner' } })
    expect(reconcilePoolEntries([e], {})).toEqual([{ ...e, slot: null }])
  })
})

describe('filterEntriesToWindow', () => {
  const windowDates = ['2026-08-24', '2026-08-25', '2026-08-26']

  it('keeps an unslotted entry regardless of how old it is', () => {
    const e = entry({ addedAt: '2026-08-01T00:00:00.000Z' })
    expect(filterEntriesToWindow([e], windowDates)).toEqual([e])
  })

  it('keeps a slotted entry whose date is inside the window', () => {
    const e = entry({ slot: { date: '2026-08-25', kind: 'dinner' } })
    expect(filterEntriesToWindow([e], windowDates)).toEqual([e])
  })

  it('drops a slotted entry whose date has scrolled out of the window (the reported bug)', () => {
    const e = entry({ slot: { date: '2026-08-10', kind: 'dinner' } })
    expect(filterEntriesToWindow([e], windowDates)).toEqual([])
  })
})

describe('buildPoolRows', () => {
  it('marks real entries as not derived', () => {
    const e = entry()
    expect(buildPoolRows([e], [])).toEqual([{ ...e, derived: false }])
  })

  it('synthesizes a derived row for a filled slot with no real pool entry', () => {
    const rows = buildPoolRows([], [{ date: '2026-08-03', kind: 'dinner', mealSlug: 'tacos', receptSlug: 'tacos-slug', label: 'Tacos' }])
    expect(rows).toEqual([{
      id: 'derived:2026-08-03:dinner',
      mealSlug: 'tacos',
      receptSlug: 'tacos-slug',
      mealNamn: 'Tacos',
      addedAt: '',
      slot: { date: '2026-08-03', kind: 'dinner' },
      derived: true,
    }])
  })

  it('does not duplicate a filled slot that already has a real pool entry pointing at it', () => {
    const e = entry({ slot: { date: '2026-08-03', kind: 'dinner' } })
    const rows = buildPoolRows([e], [{ date: '2026-08-03', kind: 'dinner', mealSlug: 'tacos', receptSlug: null, label: 'Tacos' }])
    expect(rows).toEqual([{ ...e, derived: false }])
  })
})

describe('sortPoolRows', () => {
  it('puts unslotted rows before slotted rows (the "list-first" redesign\'s deliberate reversal of #93)', () => {
    const unslotted = entry({ id: 'u', addedAt: '2026-08-01T00:00:00.000Z' })
    const slotted = entry({ id: 's', slot: { date: '2026-08-05', kind: 'dinner' } })
    expect(sortPoolRows([unslotted, slotted].map(e => ({ ...e, derived: false }))).map(r => r.id)).toEqual(['u', 's'])
  })

  it('orders slotted rows chronologically, lunch before dinner on the same day', () => {
    const rows = [
      entry({ id: 'a', slot: { date: '2026-08-05', kind: 'dinner' } }),
      entry({ id: 'b', slot: { date: '2026-08-03', kind: 'lunch' } }),
      entry({ id: 'c', slot: { date: '2026-08-03', kind: 'dinner' } }),
    ].map(e => ({ ...e, derived: false }))
    expect(sortPoolRows(rows).map(r => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('orders unslotted rows oldest-added first', () => {
    const rows = [
      entry({ id: 'newer', addedAt: '2026-08-02T00:00:00.000Z' }),
      entry({ id: 'older', addedAt: '2026-08-01T00:00:00.000Z' }),
    ].map(e => ({ ...e, derived: false }))
    expect(sortPoolRows(rows).map(r => r.id)).toEqual(['older', 'newer'])
  })
})

function slot(overrides: Partial<BudgetSlotFlags> = {}): BudgetSlotFlags {
  return {
    needsMeal: true,
    filled: false,
    veganRequired: false,
    veganSatisfied: false,
    fastFlag: false,
    fastSatisfied: false,
    isLeftover: false,
    ...overrides,
  }
}

describe('computeBudget', () => {
  it('counts only slots that need a meal toward total/filled', () => {
    const slots = [slot({ filled: true }), slot({ needsMeal: false }), slot({ filled: false })]
    expect(computeBudget(slots)).toMatchObject({ total: 2, filled: 1 })
  })

  it('counts a vegan-required slot as missing unless satisfied', () => {
    const slots = [
      slot({ veganRequired: true, veganSatisfied: false }),
      slot({ veganRequired: true, veganSatisfied: true }),
      slot({ veganRequired: false }),
    ]
    expect(computeBudget(slots).veganMissing).toBe(1)
  })

  it('counts a fast-flagged slot as missing unless satisfied', () => {
    const slots = [slot({ fastFlag: true, fastSatisfied: false }), slot({ fastFlag: true, fastSatisfied: true })]
    expect(computeBudget(slots).fastMissing).toBe(1)
  })

  it('a slot that does not need a meal is never counted as vegan/fast-missing even if flagged', () => {
    const slots = [slot({ needsMeal: false, veganRequired: true, fastFlag: true })]
    const budget = computeBudget(slots)
    expect(budget.veganMissing).toBe(0)
    expect(budget.fastMissing).toBe(0)
  })

  it('counts leftover-planned slots regardless of needsMeal', () => {
    const slots = [slot({ isLeftover: true }), slot({ isLeftover: false })]
    expect(computeBudget(slots).leftoverPlanned).toBe(1)
  })
})

// The design's enforced invariant (docs/planera-list-first-2026-08.md): every non-skipped
// slot with a dish must produce exactly one pool row. filledSlots is built by the caller
// (VeckanPlanner) as flatSlots.filter(s => s.mealSlug) — a note-only day or a skipped slot
// never has a mealSlug, so they never appear here at all; this predicate only ever has to
// reason about slots that already cleared that bar.
describe('checkPoolCompleteness', () => {
  const REAL_UNMATCHED_DISH_DAYS: FilledSlot[] = [
    { date: '2026-05-21', kind: 'dinner', mealSlug: 'ugnsbakad-lax-rotsaker', receptSlug: null, label: 'Ugnsbakad lax & rotsaker' },
    { date: '2026-05-23', kind: 'dinner', mealSlug: 'stekt-flask-rodbetssallad', receptSlug: null, label: 'Stekt fläsk & rödbetssallad' },
    { date: '2026-05-24', kind: 'dinner', mealSlug: 'coq-au-vin', receptSlug: null, label: 'Coq au vin' },
    { date: '2026-07-06', kind: 'lunch', mealSlug: 'fylld-pasta-tortellini-ravioli-med-smorsas-och-parmesan', receptSlug: null, label: 'Fylld pasta (tortellini/ravioli) med smörsås och parmesan' },
  ]

  it('holds for the four real week-file dish-days once withMealSlug gives each a mealSlug — no pool entries needed', () => {
    expect(checkPoolCompleteness([], REAL_UNMATCHED_DISH_DAYS)).toEqual([])
  })

  it('holds for a recipe-linked day', () => {
    const slots: FilledSlot[] = [{ date: '2026-06-23', kind: 'dinner', mealSlug: 'laxfile-soja-ingefara', receptSlug: 'laxfile-soja-ingefara', label: 'Ugnsbakad lax med soja och ingefära' }]
    expect(checkPoolCompleteness([], slots)).toEqual([])
  })

  it('holds for a locally-assigned day with a real pool entry', () => {
    const e = entry({ slot: { date: '2026-08-03', kind: 'dinner' } })
    const slots: FilledSlot[] = [{ date: '2026-08-03', kind: 'dinner', mealSlug: e.mealSlug, receptSlug: null, label: 'Tacos' }]
    expect(checkPoolCompleteness([e], slots)).toEqual([])
  })

  it('produces no row and no violation for a note-only day or a skipped slot (never in filledSlots)', () => {
    expect(checkPoolCompleteness([], [])).toEqual([])
  })

  it('flags a duplicate: two real pool entries pointing at the same slot', () => {
    const a = entry({ id: 'a', slot: { date: '2026-08-03', kind: 'dinner' } })
    const b = entry({ id: 'b', slot: { date: '2026-08-03', kind: 'dinner' } })
    const slots: FilledSlot[] = [{ date: '2026-08-03', kind: 'dinner', mealSlug: a.mealSlug, receptSlug: null, label: 'Tacos' }]
    expect(checkPoolCompleteness([a, b], slots)).toEqual([{ date: '2026-08-03', kind: 'dinner', count: 2 }])
  })
})

describe('resolveDisplacedOccupant', () => {
  it('unslots a real pool entry already pointing at the slot', () => {
    const occupant = entry({ id: 'occupant-1', slot: { date: '2026-08-03', kind: 'dinner' } })
    const action = resolveDisplacedOccupant(occupant, { mealSlug: 'tacos', receptSlug: null, filled: true })
    expect(action).toEqual({ type: 'unslot-pool-entry', entryId: 'occupant-1' })
  })

  it('creates a pool entry for a filled slot with no real pool entry — e.g. a git-planned week day', () => {
    // Regression: the first implementation keyed this off whether a local WeekPlanOverride
    // existed, which a static-week day never has — silently dropping the displaced meal
    // instead of returning it to the pool. This is exactly that case: no pool entry, but the
    // slot is filled.
    const action = resolveDisplacedOccupant(undefined, { mealSlug: 'korvstroganoff', receptSlug: 'korvstroganoff-slug', filled: true })
    expect(action).toEqual({ type: 'create-pool-entry', mealSlug: 'korvstroganoff', receptSlug: 'korvstroganoff-slug' })
  })

  it('does nothing for a genuinely empty slot', () => {
    const action = resolveDisplacedOccupant(undefined, { mealSlug: undefined, receptSlug: null, filled: false })
    expect(action).toEqual({ type: 'none' })
  })

  it('prefers unslotting the real pool entry over creating a duplicate, even if the slot also looks filled', () => {
    const occupant = entry({ id: 'occupant-2', slot: { date: '2026-08-03', kind: 'lunch' } })
    const action = resolveDisplacedOccupant(occupant, { mealSlug: occupant.mealSlug, receptSlug: null, filled: true })
    expect(action).toEqual({ type: 'unslot-pool-entry', entryId: 'occupant-2' })
  })
})
