import type { MealKind } from '../types'

/** 'planerat' = came from the week plan (incl. a same-day swap). 'spontant' = off-plan, logged after the fact. */
export type HistorySource = 'planerat' | 'spontant'

export interface HistoryEntry {
  id: string
  datum: string              // ISO date
  maltid: MealKind
  recipeSlug: string | null
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
