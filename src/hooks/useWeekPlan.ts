import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'
import type { DayMeal, MealKind } from '../types'

export interface WeekPlanOverride {
  recept: string            // visningsnamn på måltiden
  receptSlug: string | null // länk till receptet om det finns
  updatedAt: string
}

/** Per-meal override of who's actually eating, independent of the recipe itself. */
export interface MealAttendance {
  /** Explicit list of eater ids for this meal. null = derive from the day's presence plan. */
  presentIds: string[] | null
  /** True = this slot needs no meal at all (e.g. eating out) — the dish is cleared too. */
  skip: boolean
  updatedAt: string
}

type AttendanceKey = 'lunchAttendance' | 'dinnerAttendance'
function attendanceKey(kind: MealKind): AttendanceKey {
  return kind === 'lunch' ? 'lunchAttendance' : 'dinnerAttendance'
}

export interface DayOverride {
  dinner?: WeekPlanOverride
  lunch?: WeekPlanOverride
  dinnerAttendance?: MealAttendance
  lunchAttendance?: MealAttendance
}

export type WeekPlanStore = Record<string, DayOverride>  // nyckel = datum (ISO)

const EMPTY: WeekPlanStore = {}

export const weekPlanStore = createLocalStore<WeekPlanStore>('matracet:weekplan:v2', EMPTY)

/** Effective attendee ids for a meal: an explicit attendance override wins, else the day's presence plan. */
export function effectivePresentIds(
  planPresentIds: string[] | null,
  attendance: MealAttendance | undefined,
): string[] | null {
  if (attendance?.presentIds) return attendance.presentIds
  return planPresentIds
}

export interface AttendanceDiff {
  /** Ids normally present per the schedule but marked away for this one meal. */
  away: string[]
  /** Ids not normally present per the schedule but added for this one meal. */
  extra: string[]
}

/** How an explicit attendance override differs from the day's default presence plan. Empty when there's no override. */
export function diffAttendance(planPresentIds: string[] | null, attendance: MealAttendance | undefined): AttendanceDiff {
  if (!attendance?.presentIds) return { away: [], extra: [] }
  const plan = planPresentIds ?? []
  return {
    away: plan.filter(id => !attendance.presentIds!.includes(id)),
    extra: attendance.presentIds.filter(id => !plan.includes(id)),
  }
}

/** Merge a local replacement (recipe swap and/or skip) onto a day from the static week JSON. */
export function applyOverride(
  day: DayMeal,
  override: WeekPlanOverride | undefined,
  attendance?: MealAttendance,
): DayMeal {
  if (attendance?.skip) {
    return { ...day, recept: null, receptSlug: undefined, anteckning: 'Ingen måltid behövs', varianter: undefined }
  }
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
  const attKey = attendanceKey(kind)
  const att = day[attKey]
  weekPlanStore.set({
    ...all,
    [date]: {
      ...day,
      [kind]: { recept, receptSlug, updatedAt: new Date().toISOString() },
      // Assigning a dish means the meal is needed again.
      ...(att?.skip ? { [attKey]: { ...att, skip: false, updatedAt: new Date().toISOString() } } : {}),
    },
  })
}

function clearOverride(date: string, kind: MealKind): void {
  const all = weekPlanStore.get()
  const day = all[date]
  if (!day?.[kind]) return
  const nextDay = { ...day }
  delete nextDay[kind]
  const next = { ...all }
  if (Object.keys(nextDay).length > 0) next[date] = nextDay
  else delete next[date]
  weekPlanStore.set(next)
}

function setAttendance(date: string, kind: MealKind, attendance: MealAttendance): void {
  const all = weekPlanStore.get()
  const day = all[date] ?? {}
  weekPlanStore.set({
    ...all,
    [date]: { ...day, [attendanceKey(kind)]: attendance },
  })
}

function clearAttendance(date: string, kind: MealKind): void {
  const all = weekPlanStore.get()
  const day = all[date]
  const key = attendanceKey(kind)
  if (!day?.[key]) return
  const nextDay = { ...day }
  delete nextDay[key]
  const next = { ...all }
  if (Object.keys(nextDay).length > 0) next[date] = nextDay
  else delete next[date]
  weekPlanStore.set(next)
}

export interface UseWeekPlan {
  data: WeekPlanStore
  getOverride: (date: string, kind: MealKind) => WeekPlanOverride | undefined
  getAttendance: (date: string, kind: MealKind) => MealAttendance | undefined
  setMeal: (date: string, kind: MealKind, recept: string, receptSlug: string | null) => void
  clearOverride: (date: string, kind: MealKind) => void
  setAttendance: (date: string, kind: MealKind, attendance: MealAttendance) => void
  clearAttendance: (date: string, kind: MealKind) => void
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
    getAttendance: (date: string, kind: MealKind) => data[date]?.[attendanceKey(kind)],
    setMeal,
    clearOverride,
    setAttendance,
    clearAttendance,
  }
}
