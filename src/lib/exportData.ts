import { feedbackStore } from '../hooks/useFeedback'
import { weekPlanStore } from '../hooks/useWeekPlan'

// Matracet keeps all user feedback local (no backend). This bundles every
// `matracet:*` store into one JSON payload so it can be downloaded and later
// fed to a backend.

export interface ExportPayload {
  app: 'matracet'
  version: 1
  exportedAt: string
  feedback: ReturnType<typeof feedbackStore.get>
  weekplan: ReturnType<typeof weekPlanStore.get>
}

export function buildExportPayload(): ExportPayload {
  return {
    app: 'matracet',
    version: 1,
    exportedAt: new Date().toISOString(),
    feedback: feedbackStore.get(),
    weekplan: weekPlanStore.get(),
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
