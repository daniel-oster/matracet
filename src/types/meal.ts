export interface MealComponent {
  vara: string
  /** Substitutes that still make this the same meal. Serves double duty:
   *  pantry swaps (ris → nudlar) and dietary swaps (nötfärsbiff → vegansk biff). */
  alternativ: string[]
  valfri?: boolean
}

/** One way of making a meal, e.g. "Belugabolognese" under "Pasta med sås". Points at a recipe,
 *  at another meal (an existing meals.json entry), or is just a name (a dish with no recipe).
 *  Not the same thing as Recipe.varianter, which are ingredient swaps inside one recipe. */
export interface MealVariant {
  namn: string
  receptSlug?: string
  mealSlug?: string
}

export interface Meal {
  slug: string              // same convention as recipes: lowercase, hyphens, ö→o ä→a å→a
  namn: string
  /** Other names this meal gets logged under, so "tacos"/"Tacos"/"tacofredag" merge. */
  alias: string[]
  komponenter: MealComponent[]
  /** The recipe this meal is currently made from, if any. Null is the normal case. */
  receptSlug: string | null
  taggar: string[]
  /** Only for meals with no recipe behind them; recipe-linked meals derive from
   *  Recipe.tid_min. Optional — most recipe-less meals are fast and can omit it. */
  tid_min?: number
  /** The everyday dish's known variants (2026-11, sorted by the household). Grows as new
   *  ways of making it are eaten or suggested; never classified by hand up front. */
  varianter?: MealVariant[]
}

export interface MealsFile {
  schema_version: number
  meals: Meal[]
}
