import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getPushActivity, subscribePushActivity } from '../lib/syncPusher'
import { useSyncStatus } from '../lib/syncStatus'
import { getToken } from '../lib/githubSync'

/** A small, quiet pill in the corner that answers "did that save?" without a sync button:
 * "Sparar…" while an edit is on its way to GitHub, "✓ Sparat" for a moment after, and a
 * persistent "⚠ Ej synkat" (tap → Hantera appen) while sync is failing. Renders nothing
 * without a sync token — then everything is simply local, as it always was. */
export default function SyncIndicator({ onOpenSettings }: { onOpenSettings: () => void }) {
  const activity = useSyncExternalStore(subscribePushActivity, getPushActivity, () => 'idle' as const)
  const { lastError } = useSyncStatus()
  const [justSaved, setJustSaved] = useState(false)
  const sawPush = useRef(false)

  useEffect(() => {
    if (activity === 'pushing') {
      sawPush.current = true
      return
    }
    if (activity === 'idle' && sawPush.current) {
      sawPush.current = false
      if (lastError) return
      setJustSaved(true)
      const t = window.setTimeout(() => setJustSaved(false), 1800)
      return () => window.clearTimeout(t)
    }
  }, [activity, lastError])

  if (getToken() === null) return null

  if (activity !== 'idle') {
    return <div className="sync-pill" role="status">Sparar…</div>
  }
  if (lastError) {
    return (
      <button type="button" className="sync-pill sync-pill--error" onClick={onOpenSettings}>
        ⚠ Ej synkat
      </button>
    )
  }
  if (justSaved) return <div className="sync-pill sync-pill--ok" role="status">✓ Sparat</div>
  return null
}
