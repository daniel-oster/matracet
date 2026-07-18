// Minimal in-memory (no persistence) toast notification store. Mirrors createLocalStore's
// listener/useSyncExternalStore pattern but deliberately doesn't persist to localStorage — a
// toast is a this-page-load-only notification, never something to restore after a reload.

export interface Toast {
  id: string
  message: string
  kind: 'error' | 'info'
}

type Listener = () => void

let toasts: Toast[] = []
const listeners = new Set<Listener>()

function notify(): void {
  listeners.forEach(l => l())
}

export function getToasts(): Toast[] {
  return toasts
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function showToast(message: string, kind: Toast['kind'] = 'info', durationMs = 6000): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  toasts = [...toasts, { id, message, kind }]
  notify()
  if (typeof window !== 'undefined') {
    window.setTimeout(() => dismissToast(id), durationMs)
  }
  return id
}

export function dismissToast(id: string): void {
  const next = toasts.filter(t => t.id !== id)
  if (next.length === toasts.length) return
  toasts = next
  notify()
}
