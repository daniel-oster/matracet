import type { MealKind } from '../types'

/** 'planerat' = came from the week plan (incl. a same-day swap). 'spontant' = off-plan, logged after the fact. */
export type HistorySource = 'planerat' | 'spontant'

export interface HistoryEntry {
  id: string
  datum: string              // ISO date
  maltid: MealKind
  recipeSlug: string | null
  /** Link into meals.json (or a virtual meal slug, see src/lib/mealResolve.ts) — added
   *  alongside recipeSlug during the meals-as-plannable-unit migration, not replacing it
   *  yet. Optional/undefined for entries logged before this field existed. */
  mealSlug?: string
  beskrivning: string        // dish name/description shown in the UI
  kalla: HistorySource
  narvarande: string[]       // eater ids present, best-effort
  anteckning?: string | null
  loggad: string              // ISO timestamp the entry was recorded
}

export interface HistoryFile {
  schema_version: number
  entries: HistoryEntry[]
}
