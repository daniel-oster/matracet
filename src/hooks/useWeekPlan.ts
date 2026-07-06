import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'
import type { DayMeal, MealKind } from '../types'

export interface WeekPlanOverride {
  recept: string            // visningsnamn på måltiden
  receptSlug: string | null // länk till receptet om det finns
  updatedAt: string
}

export interface DayOverride {
  dinner?: WeekPlanOverride
  lunch?: WeekPlanOverride
}

export type WeekPlanStore = Record<string, DayOverride>  // nyckel = datum (ISO)

const EMPTY: WeekPlanStore = {}

export const weekPlanStore = createLocalStore<WeekPlanStore>('matracet:weekplan:v2', EMPTY)

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

function setMeal(date: string, kind: MealKind, recept: string, receptSlug: string | null): void {
  const all = weekPlanStore.get()
  const day = all[date] ?? {}
  weekPlanStore.set({
    ...all,
    [date]: { ...day, [kind]: { recept, receptSlug, updatedAt: new Date().toISOString() } },
  })
}

function clearOverride(date: string, kind: MealKind): void {
  const all = weekPlanStore.get()
  const day = all[date]
  if (!day?.[kind]) return
  const nextDay = { ...day }
  delete nextDay[kind]
  const next = { ...all }
  if (nextDay.dinner || nextDay.lunch) next[date] = nextDay
  else delete next[date]
  weekPlanStore.set(next)
}

export interface UseWeekPlan {
  data: WeekPlanStore
  getOverride: (date: string, kind: MealKind) => WeekPlanOverride | undefined
  setMeal: (date: string, kind: MealKind, recept: string, receptSlug: string | null) => void
  clearOverride: (date: string, kind: MealKind) => void
}

export function useWeekPlan(): UseWeekPlan {
  const data = useSyncExternalStore(
    weekPlanStore.subscribe,
    weekPlanStore.getSnapshot,
    () => EMPTY,
  )
  return {
    data,
    getOverride: (date: string, kind: MealKind) => data[date]?.[kind],
    setMeal,
    clearOverride,
  }
}
