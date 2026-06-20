import { useEffect, useState } from 'react'
import { OffersIndex, StoreOffers } from '../types'

const BASE = '/matracet/data/erbjudanden'

// Module-level cache so the left and right page share one fetch.
let cache: Promise<StoreOffers[]> | null = null

function loadOffers(): Promise<StoreOffers[]> {
  if (cache) return cache
  cache = fetch(`${BASE}/_index.json`)
    .then(r => r.json() as Promise<OffersIndex>)
    .then(idx => {
      const week = idx.veckor[idx.veckor.length - 1]
      return Promise.all(
        idx.butiker.map(b =>
          fetch(`${BASE}/${b.id}/${week}.json`)
            .then(r => (r.ok ? (r.json() as Promise<StoreOffers>) : null))
            .catch(() => null),
        ),
      )
    })
    .then(list => list.filter((x): x is StoreOffers => x !== null))
    .catch(() => [])
  return cache
}

export function useOffers(): StoreOffers[] | null {
  const [offers, setOffers] = useState<StoreOffers[] | null>(null)
  useEffect(() => {
    let active = true
    loadOffers().then(data => active && setOffers(data))
    return () => {
      active = false
    }
  }, [])
  return offers
}
