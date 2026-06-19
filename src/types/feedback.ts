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
