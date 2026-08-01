import { useSyncExternalStore } from 'react'
import { createLocalStore } from '../lib/localStore'
import type { DayMeal, MealKind, RecipeIndexEntry } from '../types'
import type { Meal } from '../types/meal'
import { resolveMealDisplayName, resolveMealForName } from '../lib/mealResolve'

export interface WeekPlanOverride {
  mealSlug: string           // link into meals.json, or a virtual meal slug (see mealResolve.ts)
  receptSlug: string | null  // link to the recipe if there is one
  /** Plan-time override of one or more of the meal's components (vara -> chosen
   *  alternativ) — a swap for this slot only, never a change to the meal itself.
   *  Undefined/empty for a meal with no swaps made. */
  komponentByten?: Record<string, string>
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

type FastKey = 'lunchFast' | 'dinnerFast'
function fastKey(kind: MealKind): FastKey {
  return kind === 'lunch' ? 'lunchFast' : 'dinnerFast'
}

export interface DayOverride {
  dinner?: WeekPlanOverride
  lunch?: WeekPlanOverride
  dinnerAttendance?: MealAttendance
  lunchAttendance?: MealAttendance
  /** Manual "this slot needs a fast meal" flag (2026-08 Planera redesign, issue #93) — a
   *  slot-level property independent of whatever's assigned (or not yet assigned) to it.
   *  There's no activity-derived signal for "short evening", so it's a one-tap flag, same
   *  tier as the attendance override. Additive field, no store version bump. */
  dinnerFast?: boolean
  lunchFast?: boolean
}

export type WeekPlanStore = Record<string, DayOverride>  // nyckel = datum (ISO)

const EMPTY: WeekPlanStore = {}

const STORE_KEY = 'matracet:weekplan:v3'
const LEGACY_KEY = 'matracet:weekplan:v2'

export const weekPlanStore = createLocalStore<WeekPlanStore>(STORE_KEY, EMPTY)

// ── v2 → v3 one-time migration ──────────────────────────────────────────────────────
// v2's WeekPlanOverride carried a display name (`recept`) directly; v3 replaced it with
// a `mealSlug` link so every slot uniformly references a meal. Migrating means finding
// (or virtually constructing, see resolveMealForName) the meal each old override's
// `recept` name refers to. Runs once at module load, guarded so it never clobbers real
// v3 data — see CLAUDE.md's "Meals as the plannable unit" section for why this is a real
// migration rather than the silent v1→v2 cutover that preceded it.
interface LegacyOverride {
  recept: string
  receptSlug: string | null
  updatedAt: string
}
interface LegacyDayOverride {
  dinner?: LegacyOverride
  lunch?: LegacyOverride
  dinnerAttendance?: MealAttendance
  lunchAttendance?: MealAttendance
}

function migrateOverride(old: LegacyOverride, meals: Meal[]): WeekPlanOverride {
  const meal = resolveMealForName(old.recept, meals)
  return { mealSlug: meal.slug, receptSlug: old.receptSlug, updatedAt: old.updatedAt }
}

/** Run once, after meals.json has loaded (see App.tsx). No-ops if v3 already has data
 *  (already migrated, or a fresh device that's never had v2 data either) or there's
 *  nothing to migrate. */
export function migrateWeekPlanV2(meals: Meal[]): void {
  if (Object.keys(weekPlanStore.get()).length > 0) return
  let raw: string | null = null
  try {
    raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_KEY) : null
  } catch {
    return
  }
  if (!raw) return
  let legacy: Record<string, LegacyDayOverride>
  try {
    legacy = JSON.parse(raw)
  } catch {
    return
  }
  if (Object.keys(legacy).length === 0) return

  const next: WeekPlanStore = {}
  for (const [date, day] of Object.entries(legacy)) {
    next[date] = {
      ...(day.dinner ? { dinner: migrateOverride(day.dinner, meals) } : {}),
      ...(day.lunch ? { lunch: migrateOverride(day.lunch, meals) } : {}),
      ...(day.dinnerAttendance ? { dinnerAttendance: day.dinnerAttendance } : {}),
      ...(day.lunchAttendance ? { lunchAttendance: day.lunchAttendance } : {}),
    }
  }
  // A migration adopting old local data isn't a fresh edit or a sync hydration —
  // same "don't advance the ledger" reasoning as mergeFeedbackBaseline.
  weekPlanStore.setSilently(next)
}

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
  meals: Meal[],
  recipeIndex: RecipeIndexEntry[],
  attendance?: MealAttendance,
): DayMeal {
  if (attendance?.skip) {
    return { ...day, recept: null, receptSlug: undefined, mealSlug: undefined, anteckning: 'Ingen måltid behövs', varianter: undefined }
  }
  if (!override) return day
  return {
    ...day,
    recept: resolveMealDisplayName(override.mealSlug, override.receptSlug, meals, recipeIndex),
    receptSlug: override.receptSlug ?? undefined,
    mealSlug: override.mealSlug,
    anteckning: undefined,
    // A manual swap replaces the planned dish; per-person variant notes from the
    // original JSON no longer apply.
    varianter: undefined,
  }
}

function setMeal(date: string, kind: MealKind, mealSlug: string, receptSlug: string | null): void {
  const all = weekPlanStore.get()
  const day = all[date] ?? {}
  const attKey = attendanceKey(kind)
  const att = day[attKey]
  weekPlanStore.set({
    ...all,
    [date]: {
      ...day,
      [kind]: { mealSlug, receptSlug, updatedAt: new Date().toISOString() },
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

/** Set (or clear, when chosen is null) a plan-time component swap on an already-assigned
 *  slot. No-ops if the slot has no override yet — a swap only ever modifies an existing
 *  assignment, it never creates one. */
function setComponentSwap(date: string, kind: MealKind, vara: string, chosen: string | null): void {
  const all = weekPlanStore.get()
  const day = all[date]
  const override = day?.[kind]
  if (!override) return
  const nextByten = { ...(override.komponentByten ?? {}) }
  if (chosen === null) delete nextByten[vara]
  else nextByten[vara] = chosen
  weekPlanStore.set({
    ...all,
    [date]: {
      ...day,
      [kind]: {
        ...override,
        komponentByten: Object.keys(nextByten).length > 0 ? nextByten : undefined,
        updatedAt: new Date().toISOString(),
      },
    },
  })
}

/** Toggle the manual "kort om tid" flag for a slot — independent of whether the slot is
 *  assigned yet, so it can be set ahead of time on an empty slot too (see DayOverride's
 *  dinnerFast/lunchFast doc comment). Clearing the flag drops the whole day entry once it's
 *  otherwise empty, same convention as clearOverride/clearAttendance. */
function setFast(date: string, kind: MealKind, value: boolean): void {
  const all = weekPlanStore.get()
  const day = all[date] ?? {}
  const key = fastKey(kind)
  if (!value) {
    if (!day[key]) return
    const nextDay = { ...day }
    delete nextDay[key]
    const next = { ...all }
    if (Object.keys(nextDay).length > 0) next[date] = nextDay
    else delete next[date]
    weekPlanStore.set(next)
    return
  }
  weekPlanStore.set({ ...all, [date]: { ...day, [key]: true } })
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
  getFast: (date: string, kind: MealKind) => boolean
  setMeal: (date: string, kind: MealKind, mealSlug: string, receptSlug: string | null) => void
  clearOverride: (date: string, kind: MealKind) => void
  setComponentSwap: (date: string, kind: MealKind, vara: string, chosen: string | null) => void
  setAttendance: (date: string, kind: MealKind, attendance: MealAttendance) => void
  clearAttendance: (date: string, kind: MealKind) => void
  setFast: (date: string, kind: MealKind, value: boolean) => void
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
    getFast: (date: string, kind: MealKind) => !!data[date]?.[fastKey(kind)],
    setMeal,
    clearOverride,
    setComponentSwap,
    setAttendance,
    clearAttendance,
    setFast,
  }
}
