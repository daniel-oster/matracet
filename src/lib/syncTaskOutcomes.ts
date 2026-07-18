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

const APPLIERS: Record<string, (entry: TaskLogEntry) => void> = {
  'resolve-manual-item': applyResolveManualItem,
}

export function applyTaskOutcome(entry: TaskLogEntry): void {
  APPLIERS[entry.type]?.(entry)
}
