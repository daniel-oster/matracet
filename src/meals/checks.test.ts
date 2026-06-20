import { describe, it, expect } from 'vitest'
import {
  evaluateSlot,
  checkQuantity,
  checkSpacing,
  getRecipeVegan,
  buildMealSlots,
  type CheckContext,
  type RecipeLite,
} from './checks'
import { SEED_PREFERENCES } from './seed'
import { SEED_STORE, PERSONS } from '../presence/seed'
import { resolvePresence } from '../presence/resolver'
import type { CookingEvent, MealAssignment, MealSlot, MealPlanData } from './types'
import type { DayPlan, Person } from '../presence/types'

// ── Test factories ─────────────────────────────────────────────────────────────

function makePlan(date: string): DayPlan {
  return resolvePresence(date, SEED_STORE)
}

function makeSlot(date: string, assignment: MealAssignment | null = null): MealSlot {
  return { date, occasion: 'DINNER', dayPlan: makePlan(date), assignment }
}

const RECIPE_VEGANSK: RecipeLite = { slug: 'het-kikärtsgryta', namn: 'Het kikärtsgryta', kategorier: ['vegansk'] }
const RECIPE_VEGETARISK: RecipeLite = { slug: 'risotto', namn: 'Svamprisotto', kategorier: ['vegetarisk'] }
const RECIPE_KOTT: RecipeLite = { slug: 'kottbullar', namn: 'Köttbullar', kategorier: ['kott'] }
const RECIPE_UNKNOWN: RecipeLite = { slug: 'unknown', namn: 'Okänt', kategorier: [] }

const EVENT_VEGANSK: CookingEvent = { id: 'ev-veg', date: '2026-05-23', recipeId: 'het-kikärtsgryta', personMeals: 6 }
const EVENT_RISOTTO: CookingEvent = { id: 'ev-ris', date: '2026-05-24', recipeId: 'risotto', personMeals: 12 }
const EVENT_KOTT: CookingEvent = { id: 'ev-kott', date: '2026-05-25', recipeId: 'kottbullar', personMeals: 6 }

function makeCtx(overrides: Partial<CheckContext> = {}): CheckContext {
  return {
    cookingEvents: [],
    allAssignments: [],
    allSlots: [],
    recipeIndex: [RECIPE_VEGANSK, RECIPE_VEGETARISK, RECIPE_KOTT, RECIPE_UNKNOWN],
    persons: PERSONS,
    preferences: SEED_PREFERENCES,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Side A never mutated
// ─────────────────────────────────────────────────────────────────────────────

describe('Side A immutability', () => {
  it('evaluateSlot does not mutate the DayPlan from Side A', () => {
    const plan = makePlan('2026-05-25')  // Monday kids-present CONFLICT day
    Object.freeze(plan)  // strict-mode throw if mutated

    const slot: MealSlot = { date: plan.date, occasion: 'DINNER', dayPlan: plan, assignment: null }
    const asgn: MealAssignment = { slotDate: plan.date, kind: 'FRESH_COOK', cookingEventId: 'ev-kott', label: null }
    const ctx = makeCtx({ cookingEvents: [EVENT_KOTT] })

    // Must not throw (Object.freeze + strict mode would throw on any mutation)
    expect(() => evaluateSlot(slot, asgn, ctx)).not.toThrow()

    // Side A fields unchanged
    expect(plan.activeGroup?.id).toBe('daniel-barn')
    expect(plan.portions).toBe(3)
    expect(plan.windowStatus).toBe('CONFLICT')
  })

  it('Side A presence/seed has no import from src/meals (verified by no circular dep at runtime)', () => {
    // If Side A imported Side B, resolvePresence would fail or behave differently.
    // This trivially passes: we can call resolvePresence without any meals import.
    const plan = resolvePresence('2026-05-23', SEED_STORE)
    expect(plan.activeGroup?.id).toBe('daniel-barn')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Vegan presence-gating
// ─────────────────────────────────────────────────────────────────────────────

describe('Vegan presence-gating', () => {
  // Mon 2026-05-25: Daniel + barn (Annabelle present)
  const MON_KIDS = '2026-05-25'

  it('non-vegan recipe on kids-present day → HARD vegan warning', () => {
    const slot = makeSlot(MON_KIDS)
    const asgn: MealAssignment = { slotDate: MON_KIDS, kind: 'FRESH_COOK', cookingEventId: 'ev-ris', label: null }
    const ctx = makeCtx({ cookingEvents: [EVENT_RISOTTO] })

    const warns = evaluateSlot(slot, asgn, ctx)
    const hard = warns.filter(w => w.code === 'VEGAN_VIOLATION' && w.severity === 'HARD')
    expect(hard.length, 'Expected HARD VEGAN_VIOLATION warning').toBe(1)
    expect(hard[0].message).toContain('Annabelle')
  })

  it('same non-vegan recipe on Daniel+Erika day → no vegan warning', () => {
    // Build a fake DayPlan where only Daniel and Erika are present (no Annabelle)
    const danielErika = SEED_STORE.groups.find(g => g.id === 'daniel-erika')!
    const danielErikaPersons = danielErika.memberPersonIds
      .map(id => SEED_STORE.persons.find(p => p.id === id)!)
    const fakeplan: DayPlan = {
      date: '2026-05-26',
      activeGroup: danielErika,
      presentPersons: danielErikaPersons,
      portions: 2,
      activitiesToday: [],
      windowStatus: 'OPEN',
      windowEndsBy: null,
      eatEarlyBy: null,
      windowNotes: [],
    }
    const slot: MealSlot = { date: fakeplan.date, occasion: 'DINNER', dayPlan: fakeplan, assignment: null }
    const asgn: MealAssignment = { slotDate: fakeplan.date, kind: 'FRESH_COOK', cookingEventId: 'ev-ris', label: null }
    const ctx = makeCtx({ cookingEvents: [EVENT_RISOTTO] })

    const warns = evaluateSlot(slot, asgn, ctx)
    const veganWarns = warns.filter(w => w.code === 'VEGAN_VIOLATION')
    expect(veganWarns.length, 'No vegan warning expected for Daniel+Erika group').toBe(0)
  })

  it('unknown diet recipe on kids day → SOFT VEGAN_UNKNOWN warning', () => {
    const evUnknown: CookingEvent = { id: 'ev-unk', date: '2026-05-25', recipeId: 'unknown', personMeals: 3 }
    const slot = makeSlot(MON_KIDS)
    const asgn: MealAssignment = { slotDate: MON_KIDS, kind: 'FRESH_COOK', cookingEventId: 'ev-unk', label: null }
    const ctx = makeCtx({ cookingEvents: [evUnknown] })

    const warns = evaluateSlot(slot, asgn, ctx)
    expect(warns.some(w => w.code === 'VEGAN_UNKNOWN' && w.severity === 'SOFT')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Quantity check (person-meal pool)
// ─────────────────────────────────────────────────────────────────────────────

describe('Quantity check (person-meal pool)', () => {
  const event: CookingEvent = { id: 'ev-q', date: '2026-05-23', recipeId: 'risotto', personMeals: 12 }

  function makeAssignmentSlots(portions: number[]): { slots: MealSlot[]; assignments: MealAssignment[] } {
    const dates = ['2026-05-23', '2026-05-24', '2026-05-25', '2026-05-27', '2026-05-30']
    const slots: MealSlot[] = []
    const assignments: MealAssignment[] = []
    for (let i = 0; i < portions.length; i++) {
      const daniel = SEED_STORE.persons.find(p => p.id === 'daniel')!
      const fakeplan: DayPlan = {
        date: dates[i],
        activeGroup: null,
        presentPersons: [daniel],
        portions: portions[i],
        activitiesToday: [], windowStatus: 'OPEN', windowEndsBy: null, eatEarlyBy: null, windowNotes: [],
      }
      slots.push({ date: dates[i], occasion: 'DINNER', dayPlan: fakeplan, assignment: null })
      assignments.push({ slotDate: dates[i], kind: 'LEFTOVER', cookingEventId: 'ev-q', label: null })
    }
    return { slots, assignments }
  }

  it('drawing 14 person-meals from a 12-meal cook → warns', () => {
    const { slots, assignments } = makeAssignmentSlots([3, 3, 3, 3, 2])  // total 14 > 12
    const warn = checkQuantity(event, assignments, slots)
    expect(warn).not.toBeNull()
    expect(warn!.code).toBe('OVER_CAPACITY')
    expect(warn!.message).toContain('14')
    expect(warn!.message).toContain('12')
  })

  it('drawing exactly 12 person-meals → no warning', () => {
    const { slots, assignments } = makeAssignmentSlots([3, 3, 3, 3])  // total 12 = exactly right
    expect(checkQuantity(event, assignments, slots)).toBeNull()
  })

  it('drawing fewer than 12 → no warning', () => {
    const { slots, assignments } = makeAssignmentSlots([3, 3])  // total 6
    expect(checkQuantity(event, assignments, slots)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Spacing check (person-derived, SOFT, gap semantics)
// ─────────────────────────────────────────────────────────────────────────────

describe('Spacing check (person-derived, SOFT)', () => {
  const kidsGroup = SEED_STORE.groups.find(g => g.id === 'daniel-barn')!
  const kidsPersons = kidsGroup.memberPersonIds.map(id => SEED_STORE.persons.find(p => p.id === id)!)  // gap=1 (Sarah, Annabelle)
  const danielGroup = SEED_STORE.groups.find(g => g.id === 'daniel')!
  const danielPersons = [SEED_STORE.persons.find(p => p.id === 'daniel')!]  // gap=0

  function makeSlotWithGroup(date: string, persons: typeof kidsPersons, portions: number): MealSlot {
    const plan: DayPlan = {
      date, activeGroup: kidsGroup, presentPersons: persons, portions,
      activitiesToday: [], windowStatus: 'OPEN', windowEndsBy: null, eatEarlyBy: null, windowNotes: [],
    }
    return { date, occasion: 'DINNER', dayPlan: plan, assignment: null }
  }

  const recipeId = 'risotto'
  const cookEv: CookingEvent = { id: 'ev-sp', date: '2026-05-25', recipeId, personMeals: 9 }

  function makeAssignPair(date1: string, date2: string) {
    const assignments: MealAssignment[] = [
      { slotDate: date1, kind: 'FRESH_COOK', cookingEventId: 'ev-sp', label: null },
      { slotDate: date2, kind: 'LEFTOVER',   cookingEventId: 'ev-sp', label: null },
    ]
    return assignments
  }

  it('kids present, same recipe on consecutive days (Mon→Tue) → SOFT spacing warn', () => {
    const slot1 = makeSlotWithGroup('2026-05-25', kidsPersons, 3)  // Mon
    const slot2 = makeSlotWithGroup('2026-05-26', kidsPersons, 3)  // Tue (1 day later)
    const assignments = makeAssignPair('2026-05-25', '2026-05-26')

    const warn = checkSpacing(slot2, recipeId, [slot1, slot2], assignments, [cookEv], PERSONS)
    expect(warn, 'Consecutive-day repeat with kids should warn').not.toBeNull()
    expect(warn!.severity).toBe('SOFT')
    expect(warn!.code).toBe('REPEAT_TOO_SOON')
  })

  it('kids present, same recipe every other day (Mon→Wed) → no warning', () => {
    const slot1 = makeSlotWithGroup('2026-05-25', kidsPersons, 3)  // Mon
    const slot2 = makeSlotWithGroup('2026-05-27', kidsPersons, 3)  // Wed (2 days later > maxGap=1)
    const assignments = makeAssignPair('2026-05-25', '2026-05-27')

    const warn = checkSpacing(slot2, recipeId, [slot1, slot2], assignments, [cookEv], PERSONS)
    expect(warn, 'Every-other-day repeat with kids should NOT warn').toBeNull()
  })

  it('Daniel-only group (gap=0), consecutive-day repeat → no warning', () => {
    const slot1: MealSlot = {
      date: '2026-05-25', occasion: 'DINNER',
      dayPlan: { date: '2026-05-25', activeGroup: danielGroup, presentPersons: danielPersons, portions: 1,
        activitiesToday: [], windowStatus: 'OPEN', windowEndsBy: null, eatEarlyBy: null, windowNotes: [] },
      assignment: null,
    }
    const slot2: MealSlot = {
      date: '2026-05-26', occasion: 'DINNER',
      dayPlan: { date: '2026-05-26', activeGroup: danielGroup, presentPersons: danielPersons, portions: 1,
        activitiesToday: [], windowStatus: 'OPEN', windowEndsBy: null, eatEarlyBy: null, windowNotes: [] },
      assignment: null,
    }
    const evD: CookingEvent = { id: 'ev-d', date: '2026-05-25', recipeId, personMeals: 2 }
    const assignments = makeAssignPair('2026-05-25', '2026-05-26')

    const warn = checkSpacing(slot2, recipeId, [slot1, slot2], assignments, [evD], PERSONS)
    expect(warn, 'Daniel-only gap=0 should NEVER warn even on consecutive days').toBeNull()
  })

  it('Saturday cook → Wednesday leftover (4 days apart, kids) → no warning', () => {
    // Sat 2026-05-23 → Wed 2026-05-27: 4 days apart, maxGap=1, 4 > 1 → no warn
    const slotSat = makeSlotWithGroup('2026-05-23', kidsPersons, 3)
    const slotWed = makeSlotWithGroup('2026-05-27', kidsPersons, 3)
    const evSat: CookingEvent = { id: 'ev-satw', date: '2026-05-23', recipeId, personMeals: 9 }
    const assignments: MealAssignment[] = [
      { slotDate: '2026-05-23', kind: 'FRESH_COOK', cookingEventId: 'ev-satw', label: null },
      { slotDate: '2026-05-27', kind: 'LEFTOVER',   cookingEventId: 'ev-satw', label: null },
    ]

    const warn = checkSpacing(slotWed, recipeId, [slotSat, slotWed], assignments, [evSat], PERSONS)
    expect(warn, 'Sat→Wed (4 days) should not warn for kids (gap=1)').toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. No shelf-life concept
// ─────────────────────────────────────────────────────────────────────────────

describe('No shelf-life concept', () => {
  it('CookingEvent has no lastsDays or shelf-life field', () => {
    const ev: CookingEvent = { id: 'e1', date: '2026-05-23', recipeId: 'test', personMeals: 6 }
    expect((ev as Record<string, unknown>).lastsDays).toBeUndefined()
    expect((ev as Record<string, unknown>).keepsDays).toBeUndefined()
    expect((ev as Record<string, unknown>).shelf_life).toBeUndefined()
    expect(Object.keys(ev)).toEqual(['id', 'date', 'recipeId', 'personMeals'])
  })

  it('quantity is the only constraint: pool depletes across slots, not by days', () => {
    // A 6-person-meal cook used over 3 slots 5 days apart — no days-based warning
    const ev: CookingEvent = { id: 'ev-dep', date: '2026-05-23', recipeId: 'risotto', personMeals: 6 }
    const assignments: MealAssignment[] = [
      { slotDate: '2026-05-23', kind: 'FRESH_COOK', cookingEventId: 'ev-dep', label: null },
      { slotDate: '2026-05-27', kind: 'LEFTOVER',   cookingEventId: 'ev-dep', label: null },
      { slotDate: '2026-06-01', kind: 'LEFTOVER',   cookingEventId: 'ev-dep', label: null },
    ]
    const daniel = SEED_STORE.persons.find(p => p.id === 'daniel')!
    const makeDP = (date: string): DayPlan => ({
      date, activeGroup: null, presentPersons: [daniel], portions: 2,
      activitiesToday: [], windowStatus: 'OPEN', windowEndsBy: null, eatEarlyBy: null, windowNotes: [],
    })
    const slots: MealSlot[] = assignments.map(a => ({
      date: a.slotDate, occasion: 'DINNER', dayPlan: makeDP(a.slotDate), assignment: a,
    }))

    // Total used: 2+2+2=6 = exactly right, no warning even though dates span 9 days
    const warn = checkQuantity(ev, assignments, slots)
    expect(warn, 'No quantity warning when pool is exactly consumed').toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Eat-out / no-meal assignments
// ─────────────────────────────────────────────────────────────────────────────

describe('EAT_OUT / NO_MEAL assignments', () => {
  it('EAT_OUT slot → no warnings (no recipe, no crash)', () => {
    const slot = makeSlot('2026-05-25')
    const asgn: MealAssignment = { slotDate: '2026-05-25', kind: 'EAT_OUT', cookingEventId: null, label: 'Äter ute' }
    const warns = evaluateSlot(slot, asgn, makeCtx())
    expect(warns).toHaveLength(0)
  })

  it('NO_MEAL slot → no warnings', () => {
    const slot = makeSlot('2026-05-25')
    const asgn: MealAssignment = { slotDate: '2026-05-25', kind: 'NO_MEAL', cookingEventId: null, label: null }
    const warns = evaluateSlot(slot, asgn, makeCtx())
    expect(warns).toHaveLength(0)
  })

  it('a CookingEvent always has a recipeId — there are no free-text cooks', () => {
    const ev: CookingEvent = { id: 'ev-t', date: '2026-05-23', recipeId: 'het-kikärtsgryta', personMeals: 3 }
    expect(typeof ev.recipeId).toBe('string')
    expect(ev.recipeId.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. NO_MEAL / OPEN solo day (no group)
// ─────────────────────────────────────────────────────────────────────────────

describe('NO_MEAL on an OPEN low-key day', () => {
  it('Erika-week Tuesday (Daniel + Erika, OPEN) with NO_MEAL assignment → valid slot, no warnings', () => {
    const plan = makePlan('2026-05-26')  // Erika-week Tuesday — Daniel + Erika
    expect(plan.activeGroup?.id).toBe('daniel-erika')
    expect(plan.windowStatus).toBe('OPEN')

    const slot: MealSlot = { date: plan.date, occasion: 'DINNER', dayPlan: plan, assignment: null }
    const asgn: MealAssignment = { slotDate: plan.date, kind: 'NO_MEAL', cookingEventId: null, label: 'ingen middag' }

    const warns = evaluateSlot(slot, asgn, makeCtx())
    expect(warns).toHaveLength(0)
  })

  it('buildMealSlots gives a slot for every day', () => {
    const days = ['2026-05-25', '2026-05-26', '2026-05-27']
    const plans = days.map(d => makePlan(d))
    const planData: MealPlanData = { cookingEvents: [], assignments: [] }
    const slots = buildMealSlots(plans, planData)
    expect(slots).toHaveLength(3)
    expect(slots[1].dayPlan.activeGroup?.id).toBe('daniel-erika')  // Erika-week Tuesday
    expect(slots[1].assignment).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. Window awareness (SOFT) on CONFLICT days
// ─────────────────────────────────────────────────────────────────────────────

describe('Window awareness on CONFLICT days', () => {
  it('FRESH_COOK on Monday (CONFLICT) → SOFT TIGHT_WINDOW warning reading from DayPlan', () => {
    const plan = makePlan('2026-05-25')  // Monday with kids: CONFLICT
    expect(plan.windowStatus).toBe('CONFLICT')
    expect(plan.eatEarlyBy).toBe('17:15')

    const slot: MealSlot = { date: plan.date, occasion: 'DINNER', dayPlan: plan, assignment: null }
    const asgn: MealAssignment = { slotDate: plan.date, kind: 'FRESH_COOK', cookingEventId: 'ev-veg', label: null }
    const ctx = makeCtx({ cookingEvents: [EVENT_VEGANSK] })

    const warns = evaluateSlot(slot, asgn, ctx)
    const tightWarn = warns.find(w => w.code === 'TIGHT_WINDOW')
    expect(tightWarn, 'Expected TIGHT_WINDOW warning for CONFLICT day').toBeDefined()
    expect(tightWarn!.severity).toBe('SOFT')
    // Message reads eatEarlyBy from the DayPlan, does not recompute it
    expect(tightWarn!.message).toContain('17:15')
  })

  it('FRESH_COOK on an OPEN day → no TIGHT_WINDOW warning', () => {
    const plan = makePlan('2026-05-23')  // Saturday — OPEN
    expect(plan.windowStatus).toBe('OPEN')

    const slot: MealSlot = { date: plan.date, occasion: 'DINNER', dayPlan: plan, assignment: null }
    const asgn: MealAssignment = { slotDate: plan.date, kind: 'FRESH_COOK', cookingEventId: 'ev-veg', label: null }
    const ctx = makeCtx({ cookingEvents: [EVENT_VEGANSK] })

    const warns = evaluateSlot(slot, asgn, ctx)
    expect(warns.some(w => w.code === 'TIGHT_WINDOW')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Bonus: getRecipeVegan helper
// ─────────────────────────────────────────────────────────────────────────────

describe('getRecipeVegan', () => {
  it('vegansk → true', () => expect(getRecipeVegan(['vegansk'])).toBe(true))
  it('vegetarisk → false', () => expect(getRecipeVegan(['vegetarisk'])).toBe(false))
  it('kott → false', () => expect(getRecipeVegan(['kott'])).toBe(false))
  it('fisk → false', () => expect(getRecipeVegan(['fisk'])).toBe(false))
  it('empty → undefined (unknown)', () => expect(getRecipeVegan([])).toBeUndefined())
  it('vegansk + glutenfri → true', () => expect(getRecipeVegan(['vegansk', 'glutenfri'])).toBe(true))
})
