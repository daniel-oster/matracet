import { Eater, Recipe, RecipeIndexEntry } from '../types'
import type { UseFeedback } from '../hooks/useFeedback'
import type { TaggedOffer } from './bevaka'

export type SuggestionFilter = 'alla' | 'fynd' | 'snabbt' | 'vegansk'

export interface SuggestionTag {
  text: string
  kind: 'offer' | 'fast' | 'warn' | 'vegan'
}

export interface RankedSuggestion {
  entry: RecipeIndexEntry
  score: number
  tags: SuggestionTag[]
  excluded: boolean
}

/**
 * A recipe is "suitable" for the day when it doesn't structurally conflict with a
 * present eater's diet. The only hard rule we can derive today: if a vegan is home,
 * meat/fish dishes don't fit. Everything else stays eligible — we suggest, never block.
 */
export function suitableForPresent(r: RecipeIndexEntry, eaters: Eater[], presentIds: string[] | null): boolean {
  if (!presentIds || presentIds.length === 0) return true
  const present = eaters.filter(e => presentIds.includes(e.id))
  const hasVegan = present.some(e => e.kost?.includes('vegan'))
  if (hasVegan && (r.kategorier.includes('kott') || r.kategorier.includes('fisk'))) {
    return false
  }
  return true
}

/** Find a currently-discounted offer whose name plausibly matches one of the recipe's ingredients. */
function findOfferMatch(recipe: Recipe | undefined, offers: TaggedOffer[]): TaggedOffer | undefined {
  if (!recipe) return undefined
  const ingredientNames = recipe.ingredienser.map(i => i.vara.trim().toLowerCase()).filter(Boolean)
  if (ingredientNames.length === 0) return undefined
  return offers.find(o => {
    const hay = o.namn.toLowerCase()
    return ingredientNames.some(name => hay.includes(name) || name.includes(hay))
  })
}

function matchesQuery(r: RecipeIndexEntry, q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  return (
    r.namn.toLowerCase().includes(needle) ||
    r.kategorier.some(k => k.toLowerCase().includes(needle))
  )
}

interface RankOptions {
  recipeIndex: RecipeIndexEntry[]
  fullRecipes: Record<string, Recipe>
  query: string
  filter: SuggestionFilter
  eaters: Eater[]
  presentPersonIds: string[] | null
  offers: TaggedOffer[]
  getFeedback: UseFeedback['getFeedback']
}

/** Ranks recipes for the suggestion tray: bargains and quick dishes score higher, refusals sink to the bottom. */
export function rankSuggestions({
  recipeIndex,
  fullRecipes,
  query,
  filter,
  eaters,
  presentPersonIds,
  offers,
  getFeedback,
}: RankOptions): RankedSuggestion[] {
  const present = presentPersonIds ? eaters.filter(e => presentPersonIds.includes(e.id)) : eaters

  return recipeIndex
    .filter(r => matchesQuery(r, query))
    .filter(r => {
      if (filter === 'snabbt') return r.tid_min <= 25
      if (filter === 'vegansk') return r.kategorier.includes('vegansk')
      return true
    })
    .map((entry): RankedSuggestion => {
      const feedback = getFeedback(entry.slug)
      const excluded = feedback?.excludeFromWeekPlan ?? false
      const offerMatch = findOfferMatch(fullRecipes[entry.slug], offers)
      const suitable = suitableForPresent(entry, eaters, presentPersonIds)
      const refusers = feedback?.persons.filter(
        p => p.sentiment === 'refuses' && present.some(e => e.id === p.personId),
      ) ?? []
      const likers = feedback?.persons.filter(
        p => p.sentiment === 'likes' && present.some(e => e.id === p.personId),
      ) ?? []

      let score = 0
      const tags: SuggestionTag[] = []
      if (offerMatch) { score += 3; tags.push({ text: `🏷 ${offerMatch.namn}`, kind: 'offer' }) }
      if (entry.tid_min <= 25) { score += 1; tags.push({ text: `⚡ ${entry.tid_min} min`, kind: 'fast' }) }
      if (entry.kategorier.includes('vegansk')) { score += 1; tags.push({ text: '🌱 vegansk', kind: 'vegan' }) }
      score += likers.length
      if (!suitable) score -= 2
      if (refusers.length > 0) {
        score -= 5
        const names = refusers
          .map(p => eaters.find(e => e.id === p.personId)?.namn ?? p.personId)
          .join(', ')
        tags.push({ text: `⚠️ ${names} vägrar`, kind: 'warn' })
      }

      return { entry, score, tags: tags.slice(0, 3), excluded }
    })
    .filter(s => filter !== 'fynd' || s.tags.some(t => t.kind === 'offer'))
    .sort((a, b) => {
      if (a.excluded !== b.excluded) return a.excluded ? 1 : -1
      return b.score - a.score
    })
}
