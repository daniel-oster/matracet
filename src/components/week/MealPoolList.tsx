import type { ReactNode } from 'react'
import type { Eater, MealKind, Recipe, RecipeIndexEntry } from '../../types'
import type { Meal } from '../../types/meal'
import type { PoolRow } from '../../lib/mealPool'
import type { TaggedOffer } from '../../lib/bevaka'
import type { UseFeedback } from '../../hooks/useFeedback'
import { resolveMealForRecipe } from '../../lib/mealResolve'
import { isVeganFriendly, findOfferMatch, parseSavings, FAST_THRESHOLD_MIN } from '../../lib/suggestions'
import { evaluateFit } from '../../lib/dietFit'

interface Props {
  rows: PoolRow[]
  meals: Meal[]
  recipeIndex: RecipeIndexEntry[]
  fullRecipes: Record<string, Recipe>
  eaters: Eater[]
  getFeedback: UseFeedback['getFeedback']
  offers: TaggedOffer[]
  dayLabel: (date: string) => string
  onOpenRecipe: (slug: string) => void
  onToggleDone: (row: PoolRow) => void
  onRemove: (row: PoolRow) => void
  onUnslot: (date: string, kind: MealKind) => void
  onAddLeftover: (row: PoolRow) => void
  renderAssign: (key: string, namn: string, mealSlug: string, receptSlug: string | null, reuseEntryId?: string) => ReactNode
}

function resolveRowMeal(row: PoolRow, meals: Meal[], recipeIndex: RecipeIndexEntry[]): Meal {
  const real = meals.find(m => m.slug === row.mealSlug)
  if (real) return real
  if (row.receptSlug) {
    const recipeNamn = recipeIndex.find(r => r.slug === row.receptSlug)?.namn ?? row.mealSlug
    return resolveMealForRecipe(row.receptSlug, recipeNamn, meals)
  }
  // A freeform virtual meal (no meals.json entry, no recipe) has no durable name beyond its
  // own slug unless mealNamn carries one — see MealPoolEntry.mealNamn's own doc comment.
  return { slug: row.mealSlug, namn: row.mealNamn ?? row.mealSlug, alias: [], komponenter: [], receptSlug: null, taggar: [] }
}

/** The pool list ("Veckans måltider") — the primary element of the app, per the 2026-08
 *  "list-first" redesign (docs/planera-list-first-2026-08.md, Problem 3): every meal the week
 *  needs, grouped "Behöver plats" (unslotted — the working set) above "Inplanerade" (slotted,
 *  chronological), deliberately unslotted-first — see sortPoolRows' own doc comment for why.
 *  `rows` arrives already sorted that way; this just draws the two group boundaries. */
export default function MealPoolList({
  rows, meals, recipeIndex, fullRecipes, eaters, getFeedback, offers, dayLabel,
  onOpenRecipe, onToggleDone, onRemove, onUnslot, onAddLeftover, renderAssign,
}: Props) {
  if (rows.length === 0) {
    return <div className="tray-empty">Inga måltider i veckan än — sök eller lägg till en nedan.</div>
  }

  function renderRow(row: PoolRow) {
    const meal = resolveRowMeal(row, meals, recipeIndex)
    const recipeEntry = row.receptSlug ? recipeIndex.find(r => r.slug === row.receptSlug) : undefined
    const fullRecipe = row.receptSlug ? fullRecipes[row.receptSlug] : undefined
    const tidMin = recipeEntry?.tid_min ?? meal.tid_min
    const veganOk = isVeganFriendly(meal, fullRecipe)
    const offerMatch = findOfferMatch(fullRecipe, offers)
    const savings = parseSavings(offerMatch?.besparing)
    const feedback = getFeedback(meal.slug)
    const fit = evaluateFit(meal, fullRecipe ?? recipeEntry ?? null, eaters, feedback ?? null)
    const refuses = fit.conflicts.some(c => c.reason === 'refuses')
    const sourceName = row.resterAv
      ? (rows.find(r => r.id === row.resterAv) ? resolveRowMeal(rows.find(r => r.id === row.resterAv)!, meals, recipeIndex).namn : null)
      : null

    return (
      <div key={row.id} className="pool-row">
        <span className="pool-name">
          {sourceName ? <>Rester <small>← {sourceName}</small></> : (row.resterAv ? <>Rester <small>(källan borttagen)</small></> : meal.namn)}
        </span>
        {tidMin != null && tidMin <= FAST_THRESHOLD_MIN && <span className="tray-tag tray-tag--fast">⚡ {tidMin} min</span>}
        {veganOk && <span className="tray-tag tray-tag--vegan">🌱{fit.requiredSwaps.length > 0 ? ' med byte' : ''}</span>}
        {savings > 0 && <span className="tray-tag tray-tag--offer">🏷 spara {savings}kr</span>}
        {refuses && <span className="tray-tag tray-tag--warn">⚠️ vägras</span>}
        {row.slot && (
          <span className="tray-tag tray-tag--slot">{dayLabel(row.slot.date)} {row.slot.kind === 'lunch' ? '☼' : '☾'}</span>
        )}
        {row.receptSlug && (
          <button type="button" className="mini" onClick={() => onOpenRecipe(row.receptSlug!)}>Recept ›</button>
        )}
        {row.slot ? (
          <>
            <button type="button" className="mini" onClick={() => onUnslot(row.slot!.date, row.slot!.kind)}>✕ Avboka</button>
            {/* Materializes a still-derived row first (see VeckanPlanner's
                materializeRow) so a git-planned day's leftover is linked to a stable,
                real entry id, not the positional "derived:date:kind" id a derived row
                only has until acted on. */}
            <button type="button" className="mini rest" onClick={() => onAddLeftover(row)}>↩ rester</button>
          </>
        ) : (
          <>
            <button type="button" className="mini" onClick={() => onToggleDone(row)}>
              {row.done ? '✓ Klart' : '✓ Markera klar'}
            </button>
            <button type="button" className="mini" onClick={() => onRemove(row)}>✕ Ta bort</button>
            {renderAssign(row.id, meal.namn, meal.slug, row.receptSlug, row.id)}
          </>
        )}
      </div>
    )
  }

  const unslotted = rows.filter(r => !r.slot)
  const slotted = rows.filter(r => r.slot)

  return (
    <div className="plan-pool-list">
      {unslotted.length > 0 && (
        <>
          <div className="plan-group-label">Behöver plats <span className="plan-group-label-n">· {unslotted.length}</span></div>
          {unslotted.map(renderRow)}
        </>
      )}
      {slotted.length > 0 && (
        <>
          <div className="plan-group-label">Inplanerade <span className="plan-group-label-n">· {slotted.length}</span></div>
          {slotted.map(renderRow)}
        </>
      )}
    </div>
  )
}
