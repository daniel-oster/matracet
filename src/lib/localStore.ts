// Tiny localStorage-backed reactive store.
//
// Matracet has no state manager by design. This factory gives us cross-component
// shared state (so e.g. a sentiment change in the recipe list immediately updates
// the warning badge in the week view) using React's built-in useSyncExternalStore,
// while persisting to localStorage. All keys are namespaced `matracet:*` so they
// can be exported together and later fed to a backend.

type Listener = () => void

export interface LocalStore<T> {
  readonly key: string
  /** Stable snapshot reference; identity only changes on `set`. */
  getSnapshot: () => T
  subscribe: (listener: Listener) => () => void
  get: () => T
  set: (next: T) => void
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

  function write(next: T): void {
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
    set: write,
  }
}
