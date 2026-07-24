export type FeedbackSentiment = 'likes' | 'dislikes' | 'refuses'

export interface PersonRecipeFeedback {
  personId: string        // matchar Eater.id
  sentiment: FeedbackSentiment
  note?: string           // valfri fri text, t.ex. "gillar inte löken"
  updatedAt: string       // ISO-8601
}

/**
 * Keyed by meal slug (public/data/meals.json), not recipe slug — sentiment is usually
 * about the dish, not one particular recipe for it (see CLAUDE.md's "Meals as the
 * plannable unit" Stage 5). A recipe with no matching meals.json entry still gets a key
 * here via its own virtual meal slug (src/lib/mealResolve.ts::resolveMealForRecipe), so
 * in practice most keys still look exactly like a recipe slug — only meals that share a
 * real meals.json entry across more than one recipe (rare today) actually differ.
 */
export interface RecipeFeedbackRecord {
  mealId: string          // meals.json slug, or a virtual meal slug — see above
  persons: PersonRecipeFeedback[]
  excludeFromWeekPlan: boolean   // döljs i förslag och varnar i veckoplanen
  updatedAt: string
}

export type FeedbackStore = Record<string, RecipeFeedbackRecord>

/**
 * Shape of the git-tracked public/data/feedback.json backend snapshot — built by
 * the sync-local-storage skill from the `matracet:feedback:v2` entry of an
 * exportData.ts export (or a bare FeedbackStore, which older/manual edits may
 * use). Mirrors the tolerant unwrap already done in scripts/build-brief.ts.
 */
export interface FeedbackFile {
  app?: 'matracet'
  version?: number
  feedback: FeedbackStore
}
