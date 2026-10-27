// Applies a processed task-log entry's outcome to local state (Phase 5 of the auto-sync
// plan — see CLAUDE.md's "GitHub-backed auto-sync" section). One function per recognized
// task `type`; an unrecognized type is left alone here — the caller (App.tsx) still prunes
// it from the local queue via pruneSyncTasks once its id appears in task-log.json, since
// "processed" is true either way, there's just nothing more for this client version to
// apply (see .claude/skills/run-sync-tasks/SKILL.md's own "unrecognized type" rule for the
// skill-side half of this — a task the skill's catalog doesn't cover is left in
// sync/state.json untouched, never appears in task-log.json, and therefore is never pruned).
//
// Uses shoppingListStore.setSilently, not .set(): task-log.json is a git-tracked static file
// fetched by every device directly (the same mechanism as feedback.json's baseline gap-fill
// in mergeFeedbackBaseline — see that function's own comment), so applying its outcomes
// doesn't need to propagate via device-sync's own newer-wins snapshot at all. Using a real
// .set() here would bump the sync ledger to "now" and risk the identical same-boot ordering
// hazard already fixed for mergeFeedbackBaseline: a later hydration in the same boot would
// wrongly see shoppingListStore as "just touched" and skip adopting a genuinely newer remote
// snapshot from another device.

import type { TaskLogEntry } from '../types/taskLog'
import { shoppingListStore, type ShoppingOfferRef } from '../hooks/useShoppingList'
import { weekPlanStore } from '../hooks/useWeekPlan'
import { mealPoolStore } from '../hooks/useMealPool'
import type { MealKind } from '../types'

interface ResolveManualItemResult {
  vara: string
  offerRef: ShoppingOfferRef
}

function isResolveManualItemResult(result: unknown): result is ResolveManualItemResult {
  if (!result || typeof result !== 'object') return false
  const r = result as Partial<ResolveManualItemResult>
  return typeof r.vara === 'string' && !!r.offerRef && typeof r.offerRef.store === 'string' && typeof r.offerRef.week === 'string'
}

function applyResolveManualItem(entry: TaskLogEntry): void {
  if (entry.outcome !== 'applied' || !isResolveManualItemResult(entry.result)) return
  const { vara, offerRef } = entry.result
  const state = shoppingListStore.get()
  const needle = vara.trim().toLowerCase()
  // Only claims a still-unresolved item with this exact name — never overwrites an offerRef
  // the user (or a different task) already attached, and never touches a same-named item
  // that's since been checked off/removed (that's a deliberate user action, not a bug).
  const match = state.manualItems.find(m => m.vara.toLowerCase() === needle && !m.offerRef)
  if (!match) return
  shoppingListStore.setSilently({
    ...state,
    manualItems: state.manualItems.map(m => (m.id === match.id ? { ...m, offerRef } : m)),
  })
}

// ── move-meal ────────────────────────────────────────────────────────────────────────
// Läget's inbox routine can't touch the week plan (it lives in each phone's localStorage), so
// "flytta gårdagens middag till lunch idag" arrives as a task-log entry instead. Unlike
// resolve-manual-item this is NOT idempotent by nature — task-log.json is replayed on every
// boot, and re-applying would undo any later edit of those two slots — so each device
// remembers which entry ids it has already applied (plain localStorage, deliberately not a
// synced store: every device applies it once by itself).
interface MoveMealResult {
  from: { date: string; kind: MealKind }
  to: { date: string; kind: MealKind }
}

const APPLIED_KEY = 'matracet:taskapplied:v1'

function readApplied(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(APPLIED_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function markApplied(id: string): void {
  try {
    localStorage.setItem(APPLIED_KEY, JSON.stringify([...readApplied(), id]))
  } catch {
    /* storage unavailable: worst case the move is attempted again next boot */
  }
}

const KINDS = ['lunch', 'dinner']
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isSlot(x: unknown): x is MoveMealResult['from'] {
  if (!x || typeof x !== 'object') return false
  const s = x as { date?: unknown; kind?: unknown }
  return typeof s.date === 'string' && ISO_DATE.test(s.date) && typeof s.kind === 'string' && KINDS.includes(s.kind)
}

function applyMoveMeal(entry: TaskLogEntry): void {
  if (entry.outcome !== 'applied') return
  const r = entry.result as Partial<MoveMealResult> | undefined
  if (!r || !isSlot(r.from) || !isSlot(r.to)) return
  if (readApplied().includes(entry.id)) return
  const { from, to } = r
  const plan = weekPlanStore.get()
  const source = plan[from.date]?.[from.kind]
  // The dish has to be in a local override: a day that only exists in a git week file has no
  // slot to move out of. Leave it unapplied-but-marked so it isn't retried forever.
  markApplied(entry.id)
  if (!source) return
  const now = new Date().toISOString()
  const fromDay = { ...plan[from.date] }
  delete fromDay[from.kind]
  const next = { ...plan, [from.date]: fromDay }
  next[to.date] = { ...next[to.date], [to.kind]: { ...source, updatedAt: now } }
  weekPlanStore.setSilently(next)
  // Keep the pool's pointers consistent: the moved entry follows the dish, whatever it
  // displaced becomes unslotted (reconcilePoolEntries would drop its pointer anyway).
  const pool = mealPoolStore.get()
  mealPoolStore.setSilently({
    entries: pool.entries.map(e => {
      if (e.slot?.date === to.date && e.slot.kind === to.kind) return { ...e, slot: null }
      if (e.slot?.date === from.date && e.slot.kind === from.kind && e.mealSlug === source.mealSlug) {
        return { ...e, slot: { date: to.date, kind: to.kind } }
      }
      return e
    }),
  })
}

const APPLIERS: Record<string, (entry: TaskLogEntry) => void> = {
  'resolve-manual-item': applyResolveManualItem,
  'move-meal': applyMoveMeal,
}

export function applyTaskOutcome(entry: TaskLogEntry): void {
  APPLIERS[entry.type]?.(entry)
}
