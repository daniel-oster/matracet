// Matracet keeps all user data local (no backend). This bundles EVERY
// `matracet:*` localStorage key into one JSON payload so it can be downloaded
// and later fed to a backend — by reading localStorage directly rather than
// importing each store, a brand-new `createLocalStore(...)` call anywhere in
// the app is picked up automatically, with no edit needed here. See the
// "Local storage export" note in CLAUDE.md before adding a new store.

import { categoryFeedbackStore } from '../hooks/useCategoryFeedback'

export interface ExportPayload {
  app: 'matracet'
  version: 2
  exportedAt: string
  /** Every localStorage key prefixed `matracet:`, keyed by its full storage key, parsed. */
  stores: Record<string, unknown>
}

export function buildExportPayload(): ExportPayload {
  const stores: Record<string, unknown> = {}
  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith('matracet:')) continue
      try {
        stores[key] = JSON.parse(localStorage.getItem(key) ?? 'null')
      } catch {
        // skip a value that somehow isn't valid JSON
      }
    }
  }
  return {
    app: 'matracet',
    version: 2,
    exportedAt: new Date().toISOString(),
    stores,
  }
}

export function downloadLocalData(): void {
  const payload = buildExportPayload()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `matracet-data-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export interface CategoryFeedbackExportPayload {
  app: 'matracet'
  version: 1
  kind: 'category-feedback'
  exportedAt: string
  entries: unknown[]
}

/** A narrower export than `downloadLocalData` — just the "flag a wrong Fynd kategori"
 * corrections (`matracet:category-feedback:v1`), meant to be pasted into a Claude Code chat
 * for the sync-category-feedback skill without also carrying every other local store. The
 * entries still ride along inside a full `downloadLocalData()` export too, unchanged. */
export function buildCategoryFeedbackPayload(): CategoryFeedbackExportPayload {
  return {
    app: 'matracet',
    version: 1,
    kind: 'category-feedback',
    exportedAt: new Date().toISOString(),
    entries: Object.values(categoryFeedbackStore.get().entries),
  }
}

export function downloadCategoryFeedback(): void {
  const payload = buildCategoryFeedbackPayload()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `matracet-category-feedback-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
