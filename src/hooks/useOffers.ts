import { useEffect, useState } from 'react'
import { Offer, OffersIndex, OffersLatest, StoreOffers } from '../types'
import { candidateWeeks, filterStoresToRange, staleWeekNote, type DateRange } from '../lib/offerValidity'

const BASE = '/matracet/data/erbjudanden'

// Module-level caches so every page/hook instance shares one fetch per resource.
let indexCache: Promise<OffersIndex> | null = null
let latestCache: Promise<OffersLatest> | null = null
const weekCache = new Map<string, Promise<StoreOffers[]>>()

function loadIndex(): Promise<OffersIndex> {
  if (!indexCache) {
    indexCache = fetch(`${BASE}/_index.json`)
      .then(r => {
        if (!r.ok) throw new Error(`_index.json fetch failed: ${r.status}`)
        return r.json() as Promise<OffersIndex>
      })
      // A failed fetch must not poison this module-level cache forever — clear it so the
      // next caller (e.g. remounting the screen) retries instead of replaying the same
      // rejection indefinitely. Re-thrown so callers still see the failure.
      .catch(err => {
        indexCache = null
        throw err
      })
  }
  return indexCache
}

function loadLatest(): Promise<OffersLatest> {
  if (!latestCache) {
    latestCache = fetch(`${BASE}/_latest.json`)
      .then(r => {
        if (!r.ok) throw new Error(`_latest.json fetch failed: ${r.status}`)
        return r.json() as Promise<OffersLatest>
      })
      .catch(err => {
        latestCache = null
        throw err
      })
  }
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
    Promise.all([loadIndex(), loadLatest()])
      .then(([idx, latest]) => {
        const targetWeek = week || latest.vecka
        loadWeek(targetWeek, idx.butiker).then(stores => {
          if (active) setResult({ stores, availableWeeks: idx.veckor, latestWeek: latest.vecka })
        })
      })
      // Leave `stores` at null (already this hook's loading/empty signal) rather than
      // throwing an unhandled rejection — the caches above were cleared on failure, so the
      // next mount/dependency change retries automatically.
      .catch(() => {})
    return () => {
      active = false
    }
  }, [week])

  return result
}

export interface ValidOffersResult {
  /** Offers valid at some point during the requested period, or null while loading. */
  stores: StoreOffers[] | null
  /** Set when nothing covers the period and there *is* older data, e.g. "senast sparade
   * veckan (v.35) gick ut sön 30/8" — so a screen can say why it's empty instead of just
   * rendering nothing. Null while loading, and whenever offers were found. */
  staleNote: string | null
}

const EMPTY_VALID: ValidOffersResult = { stores: null, staleNote: null }

/**
 * Offers actually valid during `from`..`to` (inclusive ISO dates) — what every "what's cheap
 * for the days I'm planning" screen wants, as opposed to `useOffers()`'s "whichever week
 * `_latest.json` names", which lags after a week ends and runs ahead when next week's flyer
 * is imported early.
 *
 * Loads only the saved weeks that could overlap the period (see candidateWeeks) rather than
 * one hardcoded week — a rolling 7-day window straddles two ISO weeks most of the time, and
 * both halves are real offers. The module-level week cache above is shared with `useOffers`,
 * so a week already fetched for the Fynd screen costs nothing here.
 */
export function useOffersValidDuring(from: string, to: string): ValidOffersResult {
  const [result, setResult] = useState<ValidOffersResult>(EMPTY_VALID)

  useEffect(() => {
    if (!from || !to) return
    let active = true
    const range: DateRange = { from, to }
    setResult(EMPTY_VALID)
    loadIndex()
      .then(async idx => {
        const weeks = candidateWeeks(range, idx.veckor)
        const loaded = await Promise.all(weeks.map(w => loadWeek(w, idx.butiker)))
        if (!active) return
        const all = loaded.flat()
        const valid = filterStoresToRange(all, range)
        setResult({ stores: valid, staleNote: valid.length === 0 ? staleWeekNote(all, range) : null })
      })
      .catch(() => {
        // Same reasoning as useOffers: the caches cleared themselves on failure, so leave
        // `stores` at its loading value and let the next mount retry.
      })
    return () => {
      active = false
    }
  }, [from, to])

  return result
}

/** Resolves shopping-list items' {store, week} refs (see ShoppingOfferRef) back to their full
 * offer record — brand, size, price, savings — straight from that week's saved flyer, so the
 * list can show exactly which offer an item was pulled from without duplicating those fields
 * into shopping-list storage. Weekly flyer files are kept forever (see _index.json's `veckor`),
 * so this always resolves unless the item's name/offer was later edited out of the source data.
 * Keyed by item id; an id is absent from the result until resolved, and maps to `null` if the
 * ref's week/store/name no longer match anything. */
export function useOfferRefLookup(
  items: { id: string; vara: string; offerRef?: { store: string; week: string } }[],
): Record<string, Offer | null> {
  const withRef = items.filter((i): i is typeof i & { offerRef: { store: string; week: string } } => !!i.offerRef)
  const depKey = withRef.map(i => `${i.id}:${i.offerRef.store}:${i.offerRef.week}:${i.vara}`).join('|')
  const [result, setResult] = useState<Record<string, Offer | null>>({})

  useEffect(() => {
    if (withRef.length === 0) {
      setResult({})
      return
    }
    let active = true
    loadIndex()
      .then(async idx => {
        const weeks = [...new Set(withRef.map(i => i.offerRef.week))]
        const weekStores = await Promise.all(weeks.map(w => loadWeek(w, idx.butiker)))
        if (!active) return
        const byWeek = new Map(weeks.map((w, i) => [w, weekStores[i]]))
        const out: Record<string, Offer | null> = {}
        for (const item of withRef) {
          const stores = byWeek.get(item.offerRef.week) ?? []
          const store = stores.find(s => s.kalla === item.offerRef.store)
          const needle = item.vara.trim().toLowerCase()
          out[item.id] = store?.erbjudanden.find(o => o.namn.trim().toLowerCase() === needle) ?? null
        }
        setResult(out)
      })
      .catch(() => {
        if (active) setResult({})
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey])

  return result
}
