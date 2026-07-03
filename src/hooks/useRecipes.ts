import { useEffect, useState } from 'react'
import { Recipe } from '../types'

// Module-level cache so every hook instance shares one fetch per slug.
const cache = new Map<string, Promise<Recipe | null>>()

function loadRecipe(slug: string): Promise<Recipe | null> {
  if (!cache.has(slug)) {
    cache.set(
      slug,
      fetch(`/matracet/data/recipes/${slug}/recept.json`)
        .then(r => (r.ok ? (r.json() as Promise<Recipe>) : null))
        .catch(() => null),
    )
  }
  return cache.get(slug)!
}

/** Fetches (and caches) full recipe data for the given slugs, keyed by slug. */
export function useRecipes(slugs: string[]): Record<string, Recipe> {
  const key = [...new Set(slugs)].sort().join(',')
  const [recipes, setRecipes] = useState<Record<string, Recipe>>({})

  useEffect(() => {
    let active = true
    const uniqueSlugs = key ? key.split(',') : []
    if (uniqueSlugs.length === 0) {
      setRecipes({})
      return
    }
    Promise.all(uniqueSlugs.map(s => loadRecipe(s).then(r => [s, r] as const))).then(entries => {
      if (!active) return
      const map: Record<string, Recipe> = {}
      for (const [s, r] of entries) if (r) map[s] = r
      setRecipes(map)
    })
    return () => {
      active = false
    }
  }, [key])

  return recipes
}
