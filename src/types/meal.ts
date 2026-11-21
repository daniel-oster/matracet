export interface MealComponent {
  vara: string
  /** Substitutes that still make this the same meal. Serves double duty:
   *  pantry swaps (ris → nudlar) and dietary swaps (nötfärsbiff → vegansk biff). */
  alternativ: string[]
  valfri?: boolean
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
  /** Recipes this everyday dish can be made from (recipe slugs), e.g. every pasta sauce under
   *  "Pasta med sås". A recipe can be thin (komplett: false, just a name and a few
   *  ingredients) and filled in later. Grows from what is actually eaten; never classified by
   *  hand up front. Distinct from receptSlug, the single recipe an older meal pointed at. */
  recept?: string[]
}

export interface MealsFile {
  schema_version: number
  meals: Meal[]
}
