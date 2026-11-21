import type { Eater, Recipe, RecipeIndexEntry } from '../types'
import type { Meal } from '../types/meal'
import type { UseFeedback } from '../hooks/useFeedback'
import type { TaggedOffer } from './bevaka'
import { evaluateFit } from './dietFit'
import { resolveMealForRecipe } from './mealResolve'
import { filterPlannableRecipes } from './recipeKind'
import { FAST_THRESHOLD_MIN, findOfferMatch, parseSavings } from './suggestions'

export interface ProposalSlot { date: string; presentIds: string[] | null; fast: boolean }

export interface ProposalCandidate {
  mealSlug: string
  mealNamn: string
  receptSlug: string
  receptNamn: string
  score: number
  reasons: string[]
  offer?: TaggedOffer
}

export interface ProposeWeekOptions {
  slots: ProposalSlot[]
  meals: Meal[]
  recipeIndex: RecipeIndexEntry[]
  fullRecipes: Record<string, Recipe>
  eaters: Eater[]
  offers: TaggedOffer[]
  getFeedback: UseFeedback['getFeedback']
  recentRecipeSlugs?: string[]
  recentMealSlugs?: string[]
  seed?: number
  alternatives?: number
}

/** Small deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The meal a recipe belongs to: a meals.json entry listing it in `recept`, else the usual
 *  recipe-linked / virtual meal (whose slug is the key feedback is stored under). */
function mealForRecipe(entry: RecipeIndexEntry, meals: Meal[]): Meal {
  return meals.find(m => m.recept?.includes(entry.slug)) ?? resolveMealForRecipe(entry.slug, entry.namn, meals)
}

const RECENT_RECIPE_PENALTY = 3
const RECENT_MEAL_PENALTY = 2
const KIND_REUSE_PENALTY = 1

const offerBonus = (offer: TaggedOffer) => 3 + Math.min(parseSavings(offer.besparing), 50) / 10

const offerKey = (offer: TaggedOffer) => `${offer.store}:${offer.namn.toLowerCase()}`

/**
 * Per slot date, a ranked list of recipe candidates (first = the proposal, rest = "byt").
 * Slots are processed in date order; a meal already chosen as a first pick is pushed out of
 * later slots' first position (it may still appear as an alternative further down).
 */
export function proposeWeek(o: ProposeWeekOptions): Record<string, ProposalCandidate[]> {
  const nAlt = o.alternatives ?? 5
  const rand = mulberry32(o.seed ?? 0)
  const recentRecipes = new Set(o.recentRecipeSlugs ?? [])
  const recentMeals = new Set(o.recentMealSlugs ?? [])
  const plannable = filterPlannableRecipes(o.recipeIndex)
  const usedMeals = new Set<string>()
  const usedOffers = new Map<string, number>()
  const usedKinds = new Map<string, number>()
  const kindOf = new Map(plannable.map(r => [
    r.slug,
    r.kategorier.includes('fisk') ? 'fisk' : r.kategorier.includes('kott') ? 'kott' : 'vego',
  ]))
  const result: Record<string, ProposalCandidate[]> = {}

  const slots = [...o.slots].sort((a, b) => a.date.localeCompare(b.date))
  for (const slot of slots) {
    const present = slot.presentIds ? o.eaters.filter(e => slot.presentIds!.includes(e.id)) : o.eaters
    const cands: ProposalCandidate[] = []

    for (const entry of plannable) {
      const meal = mealForRecipe(entry, o.meals)
      const feedback = o.getFeedback(meal.slug)
      if (feedback?.excludeFromWeekPlan) continue
      const full = o.fullRecipes[entry.slug]
      const fit = evaluateFit(meal, full ?? entry, present, feedback ?? null)
      // Hard exclusions: a refusal, an avoid-ingredient with no swap, an unsolvable vegan
      // need, or an unverifiable vegan check (fail-closed). requiredSwaps are fine.
      if (fit.conflicts.length > 0) continue
      if (fit.unknowns.some(u => u.reason === 'vegan-unknown')) continue

      let score = 0
      const reasons: string[] = []
      const offer = findOfferMatch(full, o.offers)
      if (offer) {
        const kr = parseSavings(offer.besparing)
        score += offerBonus(offer)
        reasons.push(kr > 0 ? `🏷 ${offer.namn} −${kr} kr` : `🏷 ${offer.namn}`)
      }
      const likers = (feedback?.persons ?? []).filter(
        p => p.sentiment === 'likes' && present.some(e => e.id === p.personId),
      )
      if (likers.length > 0) {
        score += likers.length
        const names = likers.map(p => o.eaters.find(e => e.id === p.personId)?.namn ?? p.personId)
        reasons.push(`❤ ${names.join(', ')}`)
      }
      if (slot.fast && entry.tid_min <= FAST_THRESHOLD_MIN) {
        score += 2
        reasons.push(`⚡ ${entry.tid_min} min`)
      }
      if (fit.unknowns.length > 0) score -= 0.5
      if (recentRecipes.has(entry.slug)) { score -= RECENT_RECIPE_PENALTY; reasons.push('↺ ätet nyligen') }
      else if (recentMeals.has(meal.slug)) { score -= RECENT_MEAL_PENALTY; reasons.push('↺ ätet nyligen') }
      if (fit.requiredSwaps.length > 0) {
        const s = fit.requiredSwaps[0]
        reasons.push(`🔁 byt ${s.from} → ${s.to}`)
        score -= 0.5
      }
      // Seeded jitter, small enough to only reorder near-ties.
      score += rand() * 0.9

      cands.push({
        mealSlug: meal.slug, mealNamn: meal.namn, receptSlug: entry.slug, receptNamn: entry.namn,
        score, reasons: reasons.slice(0, 4), offer,
      })
    }

    // Variety across the week: the same offer and the same protein kind (fisk/kött/vego)
    // shouldn't carry several first picks — one cheap salmon must not become three fish nights.
    for (const c of cands) {
      // An offer already carrying a first pick gives no further bonus (the reason chip stays,
      // since the dish really is cheaper); each earlier pick of the same kind costs a point.
      if (c.offer && usedOffers.has(offerKey(c.offer))) c.score -= offerBonus(c.offer)
      c.score -= KIND_REUSE_PENALTY * (usedKinds.get(kindOf.get(c.receptSlug) ?? 'vego') ?? 0)
    }
    cands.sort((a, b) => b.score - a.score || a.receptSlug.localeCompare(b.receptSlug))
    // Variety: best candidate whose meal hasn't been a first pick yet goes first.
    const firstIdx = cands.findIndex(c => !usedMeals.has(c.mealSlug))
    if (firstIdx > 0) cands.unshift(...cands.splice(firstIdx, 1))
    if (cands.length > 0) {
      const first = cands[0]
      usedMeals.add(first.mealSlug)
      if (first.offer) usedOffers.set(offerKey(first.offer), (usedOffers.get(offerKey(first.offer)) ?? 0) + 1)
      const k = kindOf.get(first.receptSlug) ?? 'vego'
      usedKinds.set(k, (usedKinds.get(k) ?? 0) + 1)
    }
    result[slot.date] = cands.slice(0, nAlt)
  }
  return result
}
