import { useEffect, useState } from 'react'
import { OffersIndex, OffersLatest, StoreOffers } from '../types'

const BASE = '/matracet/data/erbjudanden'

// Module-level caches so every page/hook instance shares one fetch per resource.
let indexCache: Promise<OffersIndex> | null = null
let latestCache: Promise<OffersLatest> | null = null
const weekCache = new Map<string, Promise<StoreOffers[]>>()

function loadIndex(): Promise<OffersIndex> {
  if (!indexCache) indexCache = fetch(`${BASE}/_index.json`).then(r => r.json() as Promise<OffersIndex>)
  return indexCache
}

function loadLatest(): Promise<OffersLatest> {
  if (!latestCache) latestCache = fetch(`${BASE}/_latest.json`).then(r => r.json() as Promise<OffersLatest>)
  return latestCache
}

function loadWeek(vecka: string, butiker: { id: string }[]): Promise<StoreOffers[]> {
  if (!weekCache.has(vecka)) {
    weekCache.set(
      vecka,
      Promise.all(
        butiker.map(b =>
          fetch(`${BASE}/${b.id}/${vecka}.json`)
            .then(r => (r.ok ? (r.json() as Promise<StoreOffers>) : null))
            .catch(() => null),
        ),
      ).then(list => list.filter((x): x is StoreOffers => x !== null)),
    )
  }
  return weekCache.get(vecka)!
}

export interface OffersResult {
  /** Offers for the resolved week, or null while loading. */
  stores: StoreOffers[] | null
  /** All weeks that have been saved, newest last. */
  availableWeeks: string[]
  /** The week `_latest.json` points to. */
  latestWeek: string | null
}

const EMPTY: OffersResult = { stores: null, availableWeeks: [], latestWeek: null }

/** @param week ISO week (`YYYY-Www`) to load, or null/undefined for the latest saved week. */
export function useOffers(week?: string | null): OffersResult {
  const [result, setResult] = useState<OffersResult>(EMPTY)

  useEffect(() => {
    let active = true
    setResult(prev => ({ ...prev, stores: null }))
    Promise.all([loadIndex(), loadLatest()]).then(([idx, latest]) => {
      const targetWeek = week || latest.vecka
      loadWeek(targetWeek, idx.butiker).then(stores => {
        if (active) setResult({ stores, availableWeeks: idx.veckor, latestWeek: latest.vecka })
      })
    })
    return () => {
      active = false
    }
  }, [week])

  return result
}
