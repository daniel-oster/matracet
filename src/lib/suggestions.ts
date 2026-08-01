import { Eater, Recipe, RecipeIndexEntry } from '../types'
import type { Meal } from '../types/meal'
import type { UseFeedback } from '../hooks/useFeedback'
import type { TaggedOffer } from './bevaka'
import { evaluateFit } from './dietFit'
import { resolveMealForRecipe } from './mealResolve'

export type SuggestionFilter = 'alla' | 'fynd' | 'snabbt' | 'vegansk'
export type SuggestionSort = 'match' | 'savings' | 'favorites' | 'fastest'

export interface SuggestionTag {
  text: string
  kind: 'offer' | 'fast' | 'warn' | 'vegan' | 'liked' | 'swap'
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

/** A probe eater with no identity of its own, used purely to ask "would this dish work
 *  for someone who eats vegan" independent of who's actually present today — the same
 *  question the 🌱 filter chip/tag always asked, now answered by evaluateFit (as-written
 *  OR swappable) instead of a flat `kategorier.includes('vegansk')` lookup, so a
 *  swappable dish like Hamburgare correctly counts as vegan-friendly. */
const VEGAN_PROBE: Eater = { id: '__vegan_probe__', namn: '', roll: '', kost: ['vegan'], gillar: [], undviker: [] }

export function isVeganFriendly(meal: Meal, recipe: Recipe | undefined): boolean {
  return evaluateFit(meal, recipe ?? null, [VEGAN_PROBE], null).ok
}

/**
 * Generic pantry staples that are too trivial/free to ever be a meaningful "bargain match" —
 * e.g. a recipe's plain "vatten" (water, for boiling pasta) would otherwise substring-match a
 * "Kolsyrat vatten 12-pack" offer, surfacing a sparkling-water deal as the reason to cook a
 * completely unrelated dish. Same substring-collision shape as the erbjudanden classifier traps
 * documented in CLAUDE.md, just in the offer-matching heuristic instead.
 */
const TRIVIAL_INGREDIENTS = new Set(['vatten', 'salt', 'peppar', 'svartpeppar', 'vitpeppar', 'salt och peppar', 'is', 'isbitar'])

/** Find a currently-discounted offer whose name plausibly matches one of the recipe's ingredients. */
export function findOfferMatch(recipe: Recipe | undefined, offers: TaggedOffer[]): TaggedOffer | undefined {
  if (!recipe) return undefined
  const ingredientNames = recipe.ingredienser
    .map(i => i.vara.trim().toLowerCase())
    .filter(name => name && !TRIVIAL_INGREDIENTS.has(name))
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
  meals: Meal[]
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
  meals,
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
    .filter(r => (filter === 'snabbt' ? r.tid_min <= 25 : true))
    .map((entry): RankedSuggestion => {
      const recipe = fullRecipes[entry.slug]
      const meal = resolveMealForRecipe(entry.slug, entry.namn, meals)
      const feedback = getFeedback(meal.slug)
      const excluded = feedback?.excludeFromWeekPlan ?? false
      const offerMatch = findOfferMatch(recipe, offers)
      const savingsKr = parseSavings(offerMatch?.besparing)
      const veganFriendly = isVeganFriendly(meal, recipe)
      const fit = evaluateFit(meal, recipe ?? null, present, feedback ?? null)
      const refusers = fit.conflicts.filter(c => c.reason === 'refuses')
      // Unknowns fold in here for scoring — a fit we couldn't verify one way or the other
      // is not a "clean pass" any more than a real conflict is (see CLAUDE.md's "Vegan
      // classification is fail-closed" note).
      const softIssueCount = fit.conflicts.filter(c => c.reason !== 'refuses').length + fit.unknowns.length
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
      if (veganFriendly) { score += 1; tags.push({ text: '🌱 vegansk', kind: 'vegan' }) }
      score += likers.length
      if (likerNames.length > 0) tags.push({ text: `❤ ${likerNames.join(', ')}`, kind: 'liked' })
      if (softIssueCount > 0) score -= 2
      if (refusers.length > 0) {
        score -= 5
        const names = refusers
          .map(c => eaters.find(e => e.id === c.personId)?.namn ?? c.personId)
          .join(', ')
        tags.push({ text: `⚠️ ${names} vägrar`, kind: 'warn' })
      }
      if (fit.requiredSwaps.length > 0 && refusers.length === 0) {
        const swap = fit.requiredSwaps[0]
        tags.push({ text: `🔁 byt ${swap.from} → ${swap.to}`, kind: 'swap' })
      }

      return { entry, score, tags: tags.slice(0, 4), excluded, offerMatch, savingsKr, likerNames }
    })
    .filter(s => filter !== 'fynd' || s.tags.some(t => t.kind === 'offer'))
    .filter(s => filter !== 'vegansk' || s.tags.some(t => t.kind === 'vegan'))

  return ranked.sort((a, b) => {
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1
    if (sort === 'savings') return b.savingsKr - a.savingsKr || b.score - a.score
    if (sort === 'favorites') return b.likerNames.length - a.likerNames.length || b.score - a.score
    if (sort === 'fastest') return a.entry.tid_min - b.entry.tid_min || b.score - a.score
    return b.score - a.score
  })
}
