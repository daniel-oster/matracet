import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPrivateJson, listPrivateDir, updatePrivateJson, type PrivateStatus } from '../lib/privateData'
import { latestMessages, newMessage, type InkorgMeddelande } from './inkorg'
import type { LagetData, KlartMap, LagetEvent, Todo } from './types'
import type { Period, PresenceStore } from '../presence/types'
import { withKlart } from './format'
import { completeTodo } from './todos'
import { DEFAULT_INSTALLNINGAR, withNotisTimes, type Installningar } from './notiser'
import { mergeMeals, type DinnerSources, type WeekPlanDay } from './dinner'
import { addDays } from '../presence/resolver'
import { getISOWeekString } from '../lib/isoWeek'
import { stockholmNow } from './time'
import type { SyncState } from '../lib/githubSync'
import type { Meal, MealsFile } from '../types/meal'
import type { RecipeIndex, WeekMenu } from '../types'

// Loads Läget's data files from livet-data (cached + offline fallback, see privateData.ts) and
// refreshes when the app is brought back to the foreground — an iOS home-screen app is resumed,
// not reloaded. A missing optional file (attgora.json arrives in step 2) is simply empty.

export interface LagetState {
  data: LagetData | null
  settings: Installningar
  /** The three newest inbox messages, newest first. */
  inbox: InkorgMeddelande[]
  /** Write a message to inkorg/. Resolves to an error text or null. */
  sendMessage: (text: string) => Promise<string | null>
  /** Re-read just the inbox (cheap) — used while a message is waiting for Claude. */
  reloadInbox: () => Promise<void>
  status: PrivateStatus | 'loading'
  stale: boolean
  /** Tick or un-tick a preparation; optimistic, rolled back if the write fails. Resolves to an error text or null. */
  setPrepDone: (key: string, on: boolean) => Promise<string | null>
  /** Tick a to-do (a repeating one spawns its next occurrence). Optimistic; resolves to an error text or null. */
  setTodoDone: (id: string) => Promise<string | null>
  /** Save the notification times (data/installningar.json). Resolves to an error text or null. */
  saveNotisTimes: (idag: string, imorgon: string) => Promise<string | null>
  /** Apply a change to data/schema.json (an activity edit/end). `apply` runs on the freshest file; an error text comes back, or null. */
  changeSchema: (apply: (s: PresenceStore) => { ok: true; store: PresenceStore } | { ok: false; error: string }) => Promise<string | null>
  reload: () => void
}

const REFRESH_MIN_MS = 30_000

export function useLagetData(): LagetState {
  const [data, setData] = useState<LagetData | null>(null)
  const [settings, setSettings] = useState<Installningar>(DEFAULT_INSTALLNINGAR)
  const [inbox, setInbox] = useState<InkorgMeddelande[]>([])
  const [status, setStatus] = useState<PrivateStatus | 'loading'>('loading')
  const [stale, setStale] = useState(false)
  const lastLoad = useRef(0)

  const loadInbox = useCallback(async () => {
    const { names } = await listPrivateDir('inkorg')
    const newest = names.filter(n => n.endsWith('.json')).sort().slice(-3)
    const files = await Promise.all(newest.map(n => fetchPrivateJson<InkorgMeddelande>(`inkorg/${n}`)))
    setInbox(latestMessages(files.map(f => f.data).filter((m): m is InkorgMeddelande => m !== null)))
  }, [])

  const load = useCallback(async () => {
    lastLoad.current = Date.now()
    void loadInbox()
    // Matracet's plan, for the dinner line: the device-sync snapshot, the public meal library and
    // the week files covering the next two weeks. Any of it missing just means no dinner line.
    const today = stockholmNow(new Date()).date
    const weeks = [...new Set(Array.from({ length: 14 }, (_, i) => getISOWeekString(addDays(today, i))))]
    const base = import.meta.env.BASE_URL
    const json = <T,>(url: string): Promise<T | null> => fetch(url).then(r => (r.ok ? (r.json() as Promise<T>) : null)).catch(() => null)
    const dinnerFetch = Promise.all([
      fetchPrivateJson<SyncState>('matracet/sync/state.json', 'device-sync'),
      json<MealsFile>(`${base}data/meals.json`),
      json<RecipeIndex>(`${base}data/recipes/_index.json`),
      Promise.all(weeks.map(w => fetchPrivateJson<WeekMenu>(`matracet/weeks/${w}.json`))),
    ])
    const [schema, periods, events, todos, klart, installningar] = await Promise.all([
      fetchPrivateJson<PresenceStore>('data/schema.json'),
      fetchPrivateJson<Period[]>('data/perioder.json'),
      fetchPrivateJson<LagetEvent[]>('data/handelser.json'),
      fetchPrivateJson<Todo[]>('data/attgora.json'),
      fetchPrivateJson<KlartMap>('data/klart.json'),
      fetchPrivateJson<Installningar>('data/installningar.json'),
    ])
    const [sync, mealsFile, recipeIndex, weekFiles] = await dinnerFetch
    const stores = sync.data?.stores
    const dinner: DinnerSources = {
      weekplan: ((stores?.['matracet:weekplan:v3']?.data as Record<string, WeekPlanDay> | undefined) ?? {}),
      weeks: weekFiles.map(w => w.data).filter((w): w is WeekMenu => w !== null),
      meals: mergeMeals(mealsFile?.meals ?? [], stores?.['matracet:meals:local:v1']?.data as Record<string, Meal> | undefined),
      recipeIndex: recipeIndex?.recipes ?? [],
    }
    setSettings(installningar.data?.notiser ? installningar.data : DEFAULT_INSTALLNINGAR)
    setStatus(schema.status)
    setStale(schema.stale)
    setData(
      schema.data
        ? { schema: schema.data, periods: periods.data ?? [], events: events.data ?? [], todos: todos.data ?? [], klart: klart.data ?? {}, dinner }
        : null,
    )
  }, [loadInbox])

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

  const saveNotisTimes = useCallback(async (idag: string, imorgon: string): Promise<string | null> => {
    if (!withNotisTimes(DEFAULT_INSTALLNINGAR, idag, imorgon)) return 'Tiderna måste vara på formen HH:MM.'
    const result = await updatePrivateJson<Installningar>(
      'data/installningar.json',
      current => withNotisTimes(current?.notiser ? current : DEFAULT_INSTALLNINGAR, idag, imorgon)!,
      'Läget: notistider',
    )
    if (result !== 'ok') return result === 'no-token' || result === 'unauthorized' ? 'Token saknar skrivrätt till livet-data.' : 'Kunde inte spara – försök igen.'
    setSettings(s => withNotisTimes(s, idag, imorgon) ?? s)
    return null
  }, [])

  const changeSchema = useCallback<LagetState['changeSchema']>(async apply => {
    let failure: string | null = null
    let result
    try {
      result = await updatePrivateJson<PresenceStore>(
        'data/schema.json',
        current => {
          if (!current) throw new Error('schema.json saknas')
          const r = apply(current)
          if (!r.ok) {
            failure = r.error
            throw new Error(r.error)
          }
          return r.store
        },
        'Läget: aktiviteter ändrade',
      )
    } catch {
      return failure ?? 'Kunde inte spara.'
    }
    if (result !== 'ok') return result === 'no-token' || result === 'unauthorized' ? 'Token saknar skrivrätt till livet-data.' : 'Kunde inte spara – försök igen.'
    await load()
    return null
  }, [load])

  const sendMessage = useCallback(async (text: string): Promise<string | null> => {
    const msg = newMessage(text, new Date())
    if (!msg) return text.trim() ? 'Meddelandet är för långt.' : 'Skriv något först.'
    // Show it at once; the real file arrives with the next read.
    setInbox(prev => latestMessages([msg, ...prev]))
    const result = await updatePrivateJson<InkorgMeddelande>(`inkorg/${msg.id}.json`, current => current ?? msg, 'Läget: nytt meddelande')
    if (result === 'ok') return null
    setInbox(prev => prev.filter(m => m.id !== msg.id))
    return result === 'no-token' || result === 'unauthorized' ? 'Token saknar skrivrätt till livet-data.' : 'Kunde inte skicka – försök igen.'
  }, [])

  return { data, settings, inbox, sendMessage, reloadInbox: loadInbox, status, stale, setPrepDone, setTodoDone, saveNotisTimes, changeSchema, reload: () => void load() }
}
