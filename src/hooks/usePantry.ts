import { useEffect, useState } from 'react'
import { Pantry } from '../types'

const URL = '/matracet/data/pantry.json'

let cache: Promise<Pantry | null> | null = null

function load(): Promise<Pantry | null> {
  if (!cache) {
    cache = fetch(URL)
      .then(r => (r.ok ? (r.json() as Promise<Pantry>) : null))
      .catch(() => null)
      .then(result => {
        // A failed fetch must not poison this module-level cache forever — clear it so the
        // next caller (e.g. remounting the screen) gets a fresh attempt instead of replaying
        // the same failure indefinitely.
        if (result === null) cache = null
        return result
      })
  }
  return cache
}

/** Staples the household always has, or currently has in stock — used to skip them on shopping lists. */
export function usePantry(): Pantry | null {
  const [pantry, setPantry] = useState<Pantry | null>(null)

  useEffect(() => {
    let active = true
    load().then(p => {
      if (active) setPantry(p)
    })
    return () => {
      active = false
    }
  }, [])

  return pantry
}
