import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPrivateJson, updatePrivateJson, type PrivateStatus } from '../lib/privateData'
import type { LagetData, KlartMap, LagetEvent, Todo } from './types'
import type { Period, PresenceStore } from '../presence/types'
import { withKlart } from './format'
import { completeTodo } from './todos'

// Loads Läget's data files from livet-data (cached + offline fallback, see privateData.ts) and
// refreshes when the app is brought back to the foreground — an iOS home-screen app is resumed,
// not reloaded. A missing optional file (attgora.json arrives in step 2) is simply empty.

export interface LagetState {
  data: LagetData | null
  status: PrivateStatus | 'loading'
  stale: boolean
  /** Tick or un-tick a preparation; optimistic, rolled back if the write fails. Resolves to an error text or null. */
  setPrepDone: (key: string, on: boolean) => Promise<string | null>
  /** Tick a to-do (a repeating one spawns its next occurrence). Optimistic; resolves to an error text or null. */
  setTodoDone: (id: string) => Promise<string | null>
  reload: () => void
}

const REFRESH_MIN_MS = 30_000

export function useLagetData(): LagetState {
  const [data, setData] = useState<LagetData | null>(null)
  const [status, setStatus] = useState<PrivateStatus | 'loading'>('loading')
  const [stale, setStale] = useState(false)
  const lastLoad = useRef(0)

  const load = useCallback(async () => {
    lastLoad.current = Date.now()
    const [schema, periods, events, todos, klart] = await Promise.all([
      fetchPrivateJson<PresenceStore>('data/schema.json'),
      fetchPrivateJson<Period[]>('data/perioder.json'),
      fetchPrivateJson<LagetEvent[]>('data/handelser.json'),
      fetchPrivateJson<Todo[]>('data/attgora.json'),
      fetchPrivateJson<KlartMap>('data/klart.json'),
    ])
    setStatus(schema.status)
    setStale(schema.stale)
    setData(
      schema.data
        ? { schema: schema.data, periods: periods.data ?? [], events: events.data ?? [], todos: todos.data ?? [], klart: klart.data ?? {} }
        : null,
    )
  }, [])

  useEffect(() => {
    void load()
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > REFRESH_MIN_MS) void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  const setPrepDone = useCallback(async (key: string, on: boolean): Promise<string | null> => {
    const stamp = new Date().toISOString()
    setData(d => (d ? { ...d, klart: withKlart(d.klart, key, on, stamp) } : d))
    const result = await updatePrivateJson<KlartMap>(
      'data/klart.json',
      current => withKlart(current ?? {}, key, on, stamp),
      on ? 'Läget: förberedelse bockad' : 'Läget: förberedelse ångrad',
    )
    if (result === 'ok') return null
    setData(d => (d ? { ...d, klart: withKlart(d.klart, key, !on, stamp) } : d))
    return result === 'no-token' || result === 'unauthorized' ? 'Token saknar skrivrätt till livet-data.' : 'Kunde inte spara – försök igen.'
  }, [])

  const setTodoDone = useCallback(async (id: string): Promise<string | null> => {
    const now = new Date()
    let before: Todo[] | null = null
    setData(d => {
      if (!d) return d
      before = d.todos
      return { ...d, todos: completeTodo(d.todos, id, now) }
    })
    const result = await updatePrivateJson<Todo[]>('data/attgora.json', current => completeTodo(current ?? [], id, now), 'Läget: att göra bockad')
    if (result === 'ok') return null
    setData(d => (d && before ? { ...d, todos: before } : d))
    return result === 'no-token' || result === 'unauthorized' ? 'Token saknar skrivrätt till livet-data.' : 'Kunde inte spara – försök igen.'
  }, [])

  return { data, status, stale, setPrepDone, setTodoDone, reload: () => void load() }
}
