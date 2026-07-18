// A stable, generated-once identifier for this device/browser profile, used to tag
// GitHub-sync snapshots (src/lib/githubSync.ts's SyncState.deviceId) — not itself synced.

const DEVICE_ID_KEY = 'matracet:sync:deviceId'

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // Fallback for environments without crypto.randomUUID (older WebViews) — not
  // cryptographically strong, but this id only needs to be locally unique-ish for
  // attribution in commit messages, never used as a security boundary.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getDeviceId(): string {
  if (typeof localStorage === 'undefined') return 'unknown-device'
  const existing = localStorage.getItem(DEVICE_ID_KEY)
  if (existing) return existing
  const id = randomUuid()
  try {
    localStorage.setItem(DEVICE_ID_KEY, id)
  } catch {
    // storage unavailable — return the generated id anyway, just won't be stable across reloads
  }
  return id
}
