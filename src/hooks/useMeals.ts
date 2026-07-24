import { useEffect, useState } from 'react'
import type { Meal, MealsFile } from '../types/meal'

const URL = '/matracet/data/meals.json'

let cache: Promise<Meal[]> | null = null

function load(): Promise<Meal[]> {
  if (!cache) {
    cache = fetch(URL)
      .then(r => (r.ok ? (r.json() as Promise<MealsFile>) : null))
      .then(f => f?.meals ?? [])
      .catch(() => [])
  }
  return cache
}

/** The meal library (public/data/meals.json) — a small, hand-authored set of the dishes
 *  actually eaten, distinct from the 120-recipe library. Most plan slots reference a
 *  recipe with no matching entry here; see src/lib/mealResolve.ts for the virtual-meal
 *  fallback that covers that case. */
export function useMeals(): Meal[] {
  const [meals, setMeals] = useState<Meal[]>([])

  useEffect(() => {
    let active = true
    load().then(m => {
      if (active) setMeals(m)
    })
    return () => {
      active = false
    }
  }, [])

  return meals
}
