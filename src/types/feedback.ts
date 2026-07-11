export type FeedbackSentiment = 'likes' | 'dislikes' | 'refuses'

export interface PersonRecipeFeedback {
  personId: string        // matchar Eater.id
  sentiment: FeedbackSentiment
  note?: string           // valfri fri text, t.ex. "gillar inte löken"
  updatedAt: string       // ISO-8601
}

export interface RecipeFeedbackRecord {
  recipeId: string        // recept-slug
  persons: PersonRecipeFeedback[]
  excludeFromWeekPlan: boolean   // döljs i förslag och varnar i veckoplanen
  updatedAt: string
}

export type FeedbackStore = Record<string, RecipeFeedbackRecord>

/**
 * Shape of the git-tracked public/data/feedback.json backend snapshot — built by
 * the sync-local-storage skill from the `matracet:feedback:v1` entry of an
 * exportData.ts export (or a bare FeedbackStore, which older/manual edits may
 * use). Mirrors the tolerant unwrap already done in scripts/build-brief.ts.
 */
export interface FeedbackFile {
  app?: 'matracet'
  version?: number
  feedback: FeedbackStore
}
