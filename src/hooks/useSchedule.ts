import { useEffect, useState } from 'react'
import { fetchPrivateJson, type PrivateStatus } from '../lib/privateData'
import type { Period, PresenceStore } from '../presence/types'

// The custody schedule, recurring activities and school terms/breaks used to be compiled
// into the (public) app. They now live in the private repo daniel-oster/livet-data
// (data/schema.json, data/perioder.json) and are fetched with the device's token, so a
// device without a token simply runs without eating windows — see docs/laget-spec-2026-10.md.

export interface Schedule {
  /** null until loaded, and for good when there is no token / no access. */
  store: PresenceStore | null
  periods: Period[] | null
  status: PrivateStatus | 'loading'
}

const LOADING: Schedule = { store: null, periods: null, status: 'loading' }

export async function loadSchedule(): Promise<Schedule> {
  const [schema, perioder] = await Promise.all([
    fetchPrivateJson<PresenceStore>('data/schema.json'),
    fetchPrivateJson<Period[]>('data/perioder.json'),
  ])
  return { store: schema.data, periods: perioder.data, status: schema.status }
}

export function useSchedule(): Schedule {
  const [schedule, setSchedule] = useState<Schedule>(LOADING)
  useEffect(() => {
    let cancelled = false
    loadSchedule().then(s => {
      if (!cancelled) setSchedule(s)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return schedule
}
