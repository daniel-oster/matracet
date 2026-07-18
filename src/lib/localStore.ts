// Tiny localStorage-backed reactive store.
//
// Matracet has no state manager by design. This factory gives us cross-component
// shared state (so e.g. a sentiment change in the recipe list immediately updates
// the warning badge in the week view) using React's built-in useSyncExternalStore,
// while persisting to localStorage. All keys are namespaced `matracet:*` so they
// can be exported together and later fed to a backend.

type Listener = () => void

const TOUCHED_KEY = 'matracet:sync:touched:v1'

// One shared ledger (not a companion key per store) of "when did `set` last run on this
// device" per store key — read by the GitHub auto-sync client (src/lib/syncSnapshot.ts) to
// decide, per store, whether a remote snapshot is newer than what's on this device. Kept
// entirely separate from each store's own persisted value (never wraps `T`) so every
// existing `get()`/`getSnapshot()` caller is unaffected — see CLAUDE.md's "GitHub-backed
// auto-sync" section for why extending rather than wrapping was the deliberate choice.
let touchedCache: Record<string, string> | null = null

function readTouchedMap(): Record<string, string> {
  if (touchedCache) return touchedCache
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(TOUCHED_KEY) : null
    touchedCache = raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    touchedCache = {}
  }
  return touchedCache
}

function markTouched(key: string, at: string): void {
  const map = { ...readTouchedMap(), [key]: at }
  touchedCache = map
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(TOUCHED_KEY, JSON.stringify(map))
  } catch {
    // quota exceeded or storage unavailable — keep in-memory value
  }
}

export interface LocalStore<T> {
  readonly key: string
  /** Stable snapshot reference; identity only changes on `set`/`setFromSync`/`setSilently`. */
  getSnapshot: () => T
  subscribe: (listener: Listener) => () => void
  get: () => T
  /** A genuine local edit — advances this store's sync ledger entry to "now". */
  set: (next: T) => void
  /** ISO timestamp this store was last `set` or `setFromSync`'d on this device, or null if
   * neither has ever happened. `setSilently` does not advance this. */
  touchedAt: () => string | null
  /** Adopt a value from GitHub sync hydration. Advances the ledger to the remote's own
   * `touchedAt`, not "now" — so a hydrated value isn't mistaken for a fresh local edit and
   * immediately re-pushed. */
  setFromSync: (next: T, touchedAt: string) => void
  /** Persist a value without touching the sync ledger at all. For writes that shouldn't
   * count as either "the user edited this" or "sync hydration adopted this" — e.g. gap-filling
   * from the git-tracked feedback.json baseline (see mergeFeedbackBaseline). Leaves whatever
   * touchedAt already existed (possibly null) exactly as it was. */
  setSilently: (next: T) => void
}

export function createLocalStore<T>(key: string, initial: T): LocalStore<T> {
  let cache: T = initial
  let loaded = false
  const listeners = new Set<Listener>()

  function read(): T {
    if (loaded) return cache
    loaded = true
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
      cache = raw ? (JSON.parse(raw) as T) : initial
    } catch {
      cache = initial
    }
    return cache
  }

  function persist(next: T): void {
    cache = next
    loaded = true
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(next))
      }
    } catch {
      // quota exceeded or storage unavailable — keep in-memory value
    }
    listeners.forEach(l => l())
  }

  return {
    key,
    getSnapshot: read,
    subscribe(listener: Listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    get: read,
    set(next: T) {
      persist(next)
      markTouched(key, new Date().toISOString())
    },
    touchedAt() {
      return readTouchedMap()[key] ?? null
    },
    setFromSync(next: T, touchedAt: string) {
      persist(next)
      markTouched(key, touchedAt)
    },
    setSilently(next: T) {
      persist(next)
    },
  }
}
