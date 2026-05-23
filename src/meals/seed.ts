import type { MealPlanData, MealPreference } from './types'

export const SEED_PREFERENCES: MealPreference[] = [
  // ── Person-derived, presence-gated ──────────────────────────────────────────
  {
    id: 'annabelle-vegan',
    description: 'Annabelle äter veganskt',
    strength: 'HARD',
    origin: 'PERSON',
    personId: 'annabelle',
    rule: { type: 'REQUIRE_VEGAN' },
  },
  {
    id: 'daniel-low-sodium',
    description: 'Daniel: lågt natrium / högt blodtryck — undvik saltrik mat',
    strength: 'SOFT',
    origin: 'PERSON',
    personId: 'daniel',
    rule: { type: 'SOFT_DIETARY', description: 'undvik saltrik mat; föredrar svamp, fisk, starka smaker' },
  },
  // ── Plan-level (applies regardless of who is present) ──────────────────────
  {
    // Dormant until lunch slots are introduced; demonstrates extensibility.
    id: 'plan-light-saturday-lunch',
    description: 'Lördag: gärna lätt lunch — spar aptiten till middagen',
    strength: 'SOFT',
    origin: 'PLAN',
    personId: null,
    rule: { type: 'OCCASION_CONTEXT', occasion: 'DINNER', description: 'Lördag: lätt lunch rekommenderas' },
  },
]

/**
 * Illustrative plan for the 28-day acceptance window (2026-05-22 – 2026-06-18).
 * Deliberately includes:
 *   - A Saturday big cook (vegansk, 6 person-meals)
 *   - Mon+Wed leftovers from that cook — deliberately over-capacity (3+3+3=9 > 6) → warns
 *   - A Sunday cook (vegetarisk, NOT vegan) on a kids-present day → HARD Annabelle warn
 *   - A Daniel-only Thursday cook (same non-vegan recipe) → NO vegan warn (Annabelle absent)
 */
export const ILLUSTRATIVE_PLAN: MealPlanData = {
  cookingEvents: [
    {
      // Saturday big cook — vegansk recipe, 6 person-meals
      id: 'cook-sat-23',
      date: '2026-05-23',
      recipeId: 'het-kikärtsgryta',   // nr 1, vegansk ✓
      personMeals: 6,
    },
    {
      // Sunday cook — vegetarisk (NOT vegan) on a kids-present day → HARD warn
      id: 'cook-sun-24',
      date: '2026-05-24',
      recipeId: 'karljohansvamp-risotto',  // nr 2, vegetarisk → NOT vegan → warns
      personMeals: 3,
    },
    {
      // Second Saturday cook in week 2 (Daniel-week) — same non-vegan recipe as cook-sun-24
      // Daniel+barn present → HARD Annabelle warn again (shows pattern repeats with group)
      id: 'cook-sat-06',
      date: '2026-06-06',
      recipeId: 'karljohansvamp-risotto',
      personMeals: 6,
    },
  ],
  assignments: [
    // ── Week of 2026-05-22 ──────────────────────────────────────────────────
    // Fri 22: no assignment
    // Sat 23: fresh cook — het-kikärtsgryta (vegansk), portions=3, pool: 3/6
    { slotDate: '2026-05-23', kind: 'FRESH_COOK', cookingEventId: 'cook-sat-23', label: null },
    // Sun 24: fresh cook — karljohansvamp (vegetarisk, NOT vegan), portions=3 → HARD warn
    { slotDate: '2026-05-24', kind: 'FRESH_COOK', cookingEventId: 'cook-sun-24', label: null },
    // Mon 25: leftover from Sat cook, portions=3, pool: 3+3=6/6 — exactly full, no over-cap yet
    //         also CONFLICT window (Teater + Modern) → SOFT TIGHT_WINDOW warn
    { slotDate: '2026-05-25', kind: 'LEFTOVER', cookingEventId: 'cook-sat-23', label: null },
    // Tue 26: no group → no meal
    { slotDate: '2026-05-26', kind: 'NO_MEAL', cookingEventId: null, label: 'ingen middag (inga barn)' },
    // Wed 27: leftover from Sat cook, portions=3, pool: 3+3+3=9 > 6 → OVER_CAPACITY warn
    //         also CONFLICT window (Twerk) → SOFT TIGHT_WINDOW warn
    { slotDate: '2026-05-27', kind: 'LEFTOVER', cookingEventId: 'cook-sat-23', label: null },
    // Thu 28: no group
    { slotDate: '2026-05-28', kind: 'EAT_OUT', cookingEventId: null, label: 'Äter ute' },
    // Fri 29: off-week, no group
    { slotDate: '2026-05-29', kind: 'NO_MEAL', cookingEventId: null, label: 'frisvecka' },

    // ── Week of 2026-06-06 (Daniel-week) ────────────────────────────────────
    // Sat 06: fresh cook — karljohansvamp (NOT vegan), kids present → HARD warn
    { slotDate: '2026-06-06', kind: 'FRESH_COOK', cookingEventId: 'cook-sat-06', label: null },
  ],
}
