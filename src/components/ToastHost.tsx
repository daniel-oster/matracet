import { useSyncExternalStore } from 'react'
import { dismissToast, getToasts, subscribeToasts } from '../lib/toastStore'

const EMPTY: ReturnType<typeof getToasts> = []

export default function ToastHost() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, () => EMPTY)
  if (toasts.length === 0) return null
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map(t => (
        <button
          key={t.id}
          type="button"
          className={`toast toast--${t.kind}`}
          onClick={() => dismissToast(t.id)}
        >
          {t.message}
        </button>
      ))}
    </div>
  )
}
