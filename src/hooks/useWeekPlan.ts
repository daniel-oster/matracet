import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'
import type { DayMeal } from '../types'

export interface WeekPlanOverride {
  recept: string            // visningsnamn på måltiden
  receptSlug: string | null // länk till receptet om det finns
  updatedAt: string
}

export type WeekPlanStore = Record<string, WeekPlanOverride>  // nyckel = datum (ISO)

const EMPTY: WeekPlanStore = {}

export const weekPlanStore = createLocalStore<WeekPlanStore>('matracet:weekplan:v1', EMPTY)

/** Merge a local replacement onto a day from the static week JSON. */
export function applyOverride(day: DayMeal, override: WeekPlanOverride | undefined): DayMeal {
  if (!override) return day
  return {
    ...day,
    recept: override.recept,
    receptSlug: override.receptSlug ?? undefined,
    anteckning: undefined,
    // A manual swap replaces the planned dish; per-person variant notes from the
    // original JSON no longer apply.
    varianter: undefined,
  }
}

function setMeal(date: string, recept: string, receptSlug: string | null): void {
  const all = weekPlanStore.get()
  weekPlanStore.set({
    ...all,
    [date]: { recept, receptSlug, updatedAt: new Date().toISOString() },
  })
}

function clearOverride(date: string): void {
  const all = weekPlanStore.get()
  if (!all[date]) return
  const next = { ...all }
  delete next[date]
  weekPlanStore.set(next)
}

export interface UseWeekPlan {
  data: WeekPlanStore
  getOverride: (date: string) => WeekPlanOverride | undefined
  setMeal: (date: string, recept: string, receptSlug: string | null) => void
  clearOverride: (date: string) => void
}

export function useWeekPlan(): UseWeekPlan {
  const data = useSyncExternalStore(
    weekPlanStore.subscribe,
    weekPlanStore.getSnapshot,
    () => EMPTY,
  )
  return {
    data,
    getOverride: (date: string) => data[date],
    setMeal,
    clearOverride,
  }
}
