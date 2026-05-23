import type { DayPlan } from '../presence/types'

/** Meal occasion — only DINNER used now; field exists for lunch/breakfast later. */
export type Occasion = 'DINNER'

export type AssignmentKind = 'FRESH_COOK' | 'LEFTOVER' | 'EAT_OUT' | 'NO_MEAL' | 'OTHER'

export type WarningSeverity = 'HARD' | 'SOFT'

export type PreferenceStrength = 'HARD' | 'SOFT'

/** PERSON: only applies when the named person is in the active group (presence-gated).
 *  PLAN: applies regardless of who is present. */
export type PreferenceOrigin = 'PERSON' | 'PLAN'

export interface Warning {
  severity: WarningSeverity
  code: string
  message: string
}

/** The decision recorded for one slot. */
export interface MealAssignment {
  slotDate: string
  kind: AssignmentKind
  /** FRESH_COOK → the CookingEvent happening this day.
   *  LEFTOVER → an earlier CookingEvent this slot draws from. */
  cookingEventId: string | null
  /** Human label for EAT_OUT / OTHER / NO_MEAL. */
  label: string | null
}

/** Derived planning unit — never persisted. Built from DayPlan + assignment. */
export interface MealSlot {
  date: string
  occasion: Occasion
  /** Immutable Side-A facts for this date. Side B only reads this. */
  dayPlan: DayPlan
  assignment: MealAssignment | null
}

/** One act of cooking. Always references a real recipe slug.
 *  Quantity is purely in person-meals; no shelf-life / days-lasting field exists here
 *  or anywhere in the model. How long a cook stretches is derived from the pool depleting. */
export interface CookingEvent {
  id: string
  date: string
  recipeId: string     // always a real recipe slug
  personMeals: number  // total person-eatings this batch produces
}

/** Structured predicate evaluated by the preference checker.
 *  New rule types can be added here without changing evaluation logic structure. */
export type PreferenceRuleSpec =
  | { type: 'REQUIRE_VEGAN' }
  | { type: 'SOFT_DIETARY'; description: string }
  | { type: 'OCCASION_CONTEXT'; occasion: Occasion; description: string }

export interface MealPreference {
  id: string
  description: string
  strength: PreferenceStrength
  origin: PreferenceOrigin
  /** For PERSON-origin: whose preference; presence-gates the check. */
  personId: string | null
  rule: PreferenceRuleSpec
}

/** Source-of-truth data committed as JSON. Slots are derived from this + DayPlans. */
export interface MealPlanData {
  cookingEvents: CookingEvent[]
  assignments: MealAssignment[]
}
