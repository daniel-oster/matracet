import { useEffect, useState } from 'react'
import { Bevakningslista, BevakningItem } from '../types'

const URL = '/matracet/data/erbjudanden/bevakningslista.json'

let cache: Promise<BevakningItem[] | null> | null = null

function load(): Promise<BevakningItem[] | null> {
  if (!cache) {
    cache = fetch(URL)
      .then(r => (r.ok ? (r.json() as Promise<Bevakningslista>).then(d => d.varor) : null))
      .catch(() => null)
      .then(result => {
        // See usePantry.ts's identical comment: a failed fetch must not poison this
        // module-level cache forever.
        if (result === null) cache = null
        return result
      })
  }
  return cache
}

/** The standing watch-list of products to bulk-buy whenever they're a genuine bargain. */
export function useBevakningslista(): BevakningItem[] | null {
  const [items, setItems] = useState<BevakningItem[] | null>(null)

  useEffect(() => {
    let active = true
    load().then(varor => { if (active) setItems(varor) })
    return () => {
      active = false
    }
  }, [])

  return items
}
