import { Eater, Recipe, RecipeIndexEntry } from '../types'
import type { UseFeedback } from '../hooks/useFeedback'
import type { TaggedOffer } from './bevaka'

export type SuggestionFilter = 'alla' | 'fynd' | 'snabbt' | 'vegansk'
export type SuggestionSort = 'match' | 'savings' | 'favorites' | 'fastest'

export interface SuggestionTag {
  text: string
  kind: 'offer' | 'fast' | 'warn' | 'vegan' | 'liked'
}

export interface RankedSuggestion {
  entry: RecipeIndexEntry
  score: number
  tags: SuggestionTag[]
  excluded: boolean
  offerMatch: TaggedOffer | undefined
  savingsKr: number
  likerNames: string[]
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

/** "10.80-14.58kr" / "1.30kr" → the largest kr figure in the string, or 0 if unparseable. */
export function parseSavings(besparing: string | null | undefined): number {
  if (!besparing) return 0
  const matches = besparing.match(/[\d.]+/g)
  if (!matches) return 0
  return Math.max(...matches.map(Number).filter(n => !Number.isNaN(n)))
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
  sort: SuggestionSort
  eaters: Eater[]
  presentPersonIds: string[] | null
  offers: TaggedOffer[]
  getFeedback: UseFeedback['getFeedback']
}

/** Ranks recipes for the suggestion list: bargains and quick dishes score higher, refusals sink to the bottom. */
export function rankSuggestions({
  recipeIndex,
  fullRecipes,
  query,
  filter,
  sort,
  eaters,
  presentPersonIds,
  offers,
  getFeedback,
}: RankOptions): RankedSuggestion[] {
  const present = presentPersonIds ? eaters.filter(e => presentPersonIds.includes(e.id)) : eaters

  const ranked = recipeIndex
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
      const savingsKr = parseSavings(offerMatch?.besparing)
      const suitable = suitableForPresent(entry, eaters, presentPersonIds)
      const refusers = feedback?.persons.filter(
        p => p.sentiment === 'refuses' && present.some(e => e.id === p.personId),
      ) ?? []
      const likers = feedback?.persons.filter(
        p => p.sentiment === 'likes' && present.some(e => e.id === p.personId),
      ) ?? []
      const likerNames = likers.map(p => eaters.find(e => e.id === p.personId)?.namn ?? p.personId)

      let score = 0
      const tags: SuggestionTag[] = []
      if (offerMatch) {
        score += 3
        tags.push({ text: savingsKr > 0 ? `🏷 spara ${savingsKr}kr` : `🏷 ${offerMatch.namn}`, kind: 'offer' })
      }
      if (entry.tid_min <= 25) { score += 1; tags.push({ text: `⚡ ${entry.tid_min} min`, kind: 'fast' }) }
      if (entry.kategorier.includes('vegansk')) { score += 1; tags.push({ text: '🌱 vegansk', kind: 'vegan' }) }
      score += likers.length
      if (likerNames.length > 0) tags.push({ text: `❤ ${likerNames.join(', ')}`, kind: 'liked' })
      if (!suitable) score -= 2
      if (refusers.length > 0) {
        score -= 5
        const names = refusers
          .map(p => eaters.find(e => e.id === p.personId)?.namn ?? p.personId)
          .join(', ')
        tags.push({ text: `⚠️ ${names} vägrar`, kind: 'warn' })
      }

      return { entry, score, tags: tags.slice(0, 4), excluded, offerMatch, savingsKr, likerNames }
    })
    .filter(s => filter !== 'fynd' || s.tags.some(t => t.kind === 'offer'))

  return ranked.sort((a, b) => {
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1
    if (sort === 'savings') return b.savingsKr - a.savingsKr || b.score - a.score
    if (sort === 'favorites') return b.likerNames.length - a.likerNames.length || b.score - a.score
    if (sort === 'fastest') return a.entry.tid_min - b.entry.tid_min || b.score - a.score
    return b.score - a.score
  })
}
