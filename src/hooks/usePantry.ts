import { useEffect, useState } from 'react'
import { Pantry } from '../types'

const URL = '/matracet/data/pantry.json'

let cache: Promise<Pantry> | null = null

function load(): Promise<Pantry> {
  if (!cache) cache = fetch(URL).then(r => r.json() as Promise<Pantry>)
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
