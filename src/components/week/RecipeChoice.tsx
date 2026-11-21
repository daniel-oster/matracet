import { useState } from 'react'
import type { Recipe, RecipeIndexEntry } from '../../types'
import type { Meal } from '../../types/meal'
import type { MealPoolEntry } from '../../hooks/useMealPool'
import type { TaggedOffer } from '../../lib/bevaka'
import { findOfferMatch, parseSavings } from '../../lib/suggestions'

interface Props {
  /** Gathered meals (in this week's window, not done) that have several recipes and no choice yet. */
  entries: MealPoolEntry[]
  meals: Meal[]
  recipeIndex: RecipeIndexEntry[]
  fullRecipes: Record<string, Recipe>
  offers: TaggedOffer[]
  recentRecipeSlugs: string[]
  onChoose: (entry: MealPoolEntry, receptSlug: string) => void
}

interface Option { slug: string; namn: string; offer?: TaggedOffer; kr: number; recent: boolean }

const SHOWN = 5

/**
 * Step 2 of planning: "Vilket recept?". Step 1 only gathers meals ("Pasta med sås", "Soppa");
 * here each one that has several recipes gets them as chips — ones with an ingredient on offer
 * first, recently eaten last. Choosing is optional: a meal can stay general.
 */
export default function RecipeChoice(p: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  if (p.entries.length === 0) return null
  const recent = new Set(p.recentRecipeSlugs)

  function options(meal: Meal): Option[] {
    return (meal.recept ?? [])
      .map(slug => p.recipeIndex.find(r => r.slug === slug))
      .filter((r): r is RecipeIndexEntry => !!r)
      .map(r => {
        const offer = findOfferMatch(p.fullRecipes[r.slug], p.offers)
        return { slug: r.slug, namn: r.namn, offer, kr: parseSavings(offer?.besparing), recent: recent.has(r.slug) }
      })
      .sort((a, b) => Number(a.recent) - Number(b.recent) || Number(!!b.offer) - Number(!!a.offer) || b.kr - a.kr || a.namn.localeCompare(b.namn, 'sv'))
  }

  return (
    <div className="wprop rchoice">
      <div className="wprop-head">
        <span className="wprop-step">2</span>
        <span className="wprop-title">Vilket recept?</span>
      </div>
      <div className="wprop-def">Välj när ni vet – en måltid kan också få vara allmän.</div>
      {p.entries.map(e => {
        const meal = p.meals.find(m => m.slug === e.mealSlug)
        if (!meal) return null
        const opts = options(meal)
        const shown = open[e.id] ? opts : opts.slice(0, SHOWN)
        return (
          <div className="wprop-row rchoice-row" key={e.id}>
            <div className="wprop-meal">{meal.namn}</div>
            <div className="rchoice-chips">
              {shown.map(o => (
                <button key={o.slug} className="rchoice-chip" onClick={() => p.onChoose(e, o.slug)}>
                  {o.namn}
                  {o.offer && <span className="rchoice-offer"> 🏷{o.kr > 0 ? ` −${o.kr} kr` : ''}</span>}
                  {o.recent && <span className="rchoice-recent"> ↺</span>}
                </button>
              ))}
              {opts.length > SHOWN && !open[e.id] && (
                <button className="rchoice-more" onClick={() => setOpen(m => ({ ...m, [e.id]: true }))}>
                  visa alla {opts.length}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
