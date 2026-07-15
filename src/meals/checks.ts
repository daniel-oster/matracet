/**
 * Side B — pure check/evaluation functions.
 * Reads Side A (DayPlan, Person) but never imports Side A modules at runtime;
 * only imports their TypeScript types. Never mutates any Side A data.
 */
import type { DayPlan, Person } from '../presence/types'
import type {
  CookingEvent,
  MealAssignment,
  MealPreference,
  MealPlanData,
  MealSlot,
  Warning,
} from './types'

// ── Recipe diet helpers ────────────────────────────────────────────────────────

/** Lightweight recipe shape needed for dietary checks.
 *  Matches the subset of RecipeIndexEntry that the checks require. */
export type RecipeLite = {
  slug: string
  namn: string
  kategorier: string[]
}

/**
 * Derive vegan status from a recipe's kategorier array.
 *   true     → marked vegansk
 *   false    → marked vegetarisk / kott / fisk (not vegan)
 *   undefined → cannot determine (warn softly)
 */
export function getRecipeVegan(kategorier: string[]): boolean | undefined {
  if (kategorier.includes('vegansk')) return true
  if (kategorier.some(k => ['vegetarisk', 'kott', 'fisk'].includes(k))) return false
  return undefined
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function dateDiffDays(dateA: string, dateB: string): number {
  const msPerDay = 24 * 60 * 60 * 1000
  const a = new Date(dateA + 'T00:00:00Z').getTime()
  const b = new Date(dateB + 'T00:00:00Z').getTime()
  return Math.abs(Math.round((a - b) / msPerDay))
}

// ── Slot builder ───────────────────────────────────────────────────────────────

/** Build MealSlots by wrapping DayPlans with their assignments (if any). */
export function buildMealSlots(
  dayPlans: DayPlan[],
  planData: MealPlanData,
): MealSlot[] {
  return dayPlans.map(dp => ({
    date: dp.date,
    occasion: 'DINNER' as const,
    dayPlan: dp,
    assignment: planData.assignments.find(a => a.slotDate === dp.date) ?? null,
  }))
}

// ── Quantity check ─────────────────────────────────────────────────────────────

/** Total person-meals drawn from a cooking event across all slots in the plan. */
export function eventPersonMealsUsed(
  event: CookingEvent,
  allAssignments: MealAssignment[],
  allSlots: MealSlot[],
): number {
  return allAssignments
    .filter(a => a.cookingEventId === event.id)
    .reduce((sum, a) => {
      const slot = allSlots.find(s => s.date === a.slotDate)
      return sum + (slot?.dayPlan.portions ?? 0)
    }, 0)
}

/**
 * Warns (SOFT) if total person-meals drawn from an event exceed its batch size.
 * This is the only capacity constraint — there is no shelf-life or days-lasting concept.
 */
export function checkQuantity(
  event: CookingEvent,
  allAssignments: MealAssignment[],
  allSlots: MealSlot[],
): Warning | null {
  const used = eventPersonMealsUsed(event, allAssignments, allSlots)
  if (used > event.personMeals) {
    return {
      severity: 'SOFT',
      code: 'OVER_CAPACITY',
      message: `Totalt ${used} portioner planerade mot ${event.personMeals} lagade — ${used - event.personMeals} för många`,
    }
  }
  return null
}

// ── Spacing check ──────────────────────────────────────────────────────────────

/**
 * Warns (SOFT) when the same recipe recurs within the max minRepeatGapDays among
 * the present group. The gap is person-derived and presence-gated:
 *   Daniel / Erika (gap=0): never warns — 0 means no gap is required.
 *   Sarah / Annabelle (gap=1): consecutive-day repeats warn; every-other-day is fine.
 *
 * "daysApart <= maxGap" triggers the warning (gap not achieved).
 * Daniel-only or Daniel+Erika groups have maxGap=0, so the early-exit at line below fires.
 */
export function checkSpacing(
  slot: MealSlot,
  recipeId: string,
  allAssignments: MealAssignment[],
  cookingEvents: CookingEvent[],
  persons: Person[],
): Warning | null {
  const presentIds = new Set(slot.dayPlan.presentPersons.map(p => p.id))
  if (presentIds.size === 0) return null

  const maxGap = Math.max(
    0,
    ...persons.filter(p => presentIds.has(p.id)).map(p => p.minRepeatGapDays ?? 0),
  )
  if (maxGap === 0) return null  // Daniel-only / Daniel+Erika never warn

  // Map date → recipeId for all assigned slots that reference a cooking event
  const dateToRecipe = new Map<string, string>()
  for (const asgn of allAssignments) {
    if (!asgn.cookingEventId) continue
    const ev = cookingEvents.find(e => e.id === asgn.cookingEventId)
    if (ev) dateToRecipe.set(asgn.slotDate, ev.recipeId)
  }

  for (const [otherDate, otherRecipe] of dateToRecipe) {
    if (otherDate === slot.date) continue
    if (otherRecipe !== recipeId) continue
    const diff = dateDiffDays(slot.date, otherDate)
    if (diff <= maxGap) {
      return {
        severity: 'SOFT',
        code: 'REPEAT_TOO_SOON',
        message: `Samma rätt serveras ${diff} dag(ar) isär — minst ${maxGap + 1} dagars mellanrum rekommenderas`,
      }
    }
  }

  return null
}

// ── CheckContext ───────────────────────────────────────────────────────────────

export interface CheckContext {
  cookingEvents: CookingEvent[]
  allAssignments: MealAssignment[]
  allSlots: MealSlot[]
  recipeIndex: RecipeLite[]
  persons: Person[]
  preferences: MealPreference[]
}

// ── Main evaluation ────────────────────────────────────────────────────────────

/**
 * Pure function: evaluates all applicable checks and preferences for a slot+assignment.
 * Returns warnings tagged HARD/SOFT. Never mutates Side A data.
 * Shape is designed so a future SUGGEST step can call the same checks over candidate
 * recipes without modification.
 */
export function evaluateSlot(
  slot: MealSlot,
  assignment: MealAssignment,
  ctx: CheckContext,
): Warning[] {
  const warnings: Warning[] = []

  // EAT_OUT and NO_MEAL: skip dietary/quantity/spacing checks entirely
  if (assignment.kind === 'EAT_OUT' || assignment.kind === 'NO_MEAL') {
    return warnings
  }

  const event = assignment.cookingEventId
    ? ctx.cookingEvents.find(e => e.id === assignment.cookingEventId) ?? null
    : null

  if (!event) return warnings

  const recipe = ctx.recipeIndex.find(r => r.slug === event.recipeId) ?? null

  // ─ Dietary / preference checks (PERSON-origin gated by presence) ─────────────
  const presentIds = new Set(slot.dayPlan.presentPersons.map(p => p.id))

  for (const pref of ctx.preferences) {
    if (pref.origin === 'PERSON' && pref.personId && !presentIds.has(pref.personId)) continue
    // OCCASION_CONTEXT rules are dormant until the relevant occasion slot type exists
    if (pref.rule.type === 'OCCASION_CONTEXT') continue

    if (pref.rule.type === 'REQUIRE_VEGAN' && recipe) {
      const isVegan = getRecipeVegan(recipe.kategorier)
      const personName = ctx.persons.find(p => p.id === pref.personId)?.name ?? pref.personId ?? '?'
      if (isVegan === false) {
        warnings.push({
          severity: pref.strength,
          code: 'VEGAN_VIOLATION',
          message: `${personName} äter veganskt — "${recipe.namn}" är inte veganskt`,
        })
      } else if (isVegan === undefined) {
        warnings.push({
          severity: 'SOFT',
          code: 'VEGAN_UNKNOWN',
          message: `Vegansk status okänd för "${recipe.namn}"`,
        })
      }
    }
  }

  // ─ Quantity check ─────────────────────────────────────────────────────────────
  const qtyWarn = checkQuantity(event, ctx.allAssignments, ctx.allSlots)
  if (qtyWarn) warnings.push(qtyWarn)

  // ─ Spacing check ──────────────────────────────────────────────────────────────
  const spacingWarn = checkSpacing(
    slot, event.recipeId,
    ctx.allAssignments, ctx.cookingEvents, ctx.persons,
  )
  if (spacingWarn) warnings.push(spacingWarn)

  // ─ Window awareness (SOFT) ────────────────────────────────────────────────────
  // Reads windowStatus from the DayPlan — does not recompute it.
  if (slot.dayPlan.windowStatus === 'CONFLICT') {
    warnings.push({
      severity: 'SOFT',
      code: 'TIGHT_WINDOW',
      message: `Matfönstret är trångt — ät senast ${slot.dayPlan.eatEarlyBy ?? '?'} (${slot.dayPlan.windowNotes.join('; ')})`,
    })
  }

  return warnings
}
