import type { ReactNode } from 'react'
import type { Eater, MealKind, Recipe, RecipeIndexEntry } from '../../types'
import type { Meal } from '../../types/meal'
import type { PoolRow } from '../../lib/mealPool'
import type { TaggedOffer } from '../../lib/bevaka'
import type { UseFeedback } from '../../hooks/useFeedback'
import { resolveMealForRecipe, resolveMealForName } from '../../lib/mealResolve'
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
  onToggleDone: (id: string) => void
  onRemove: (id: string) => void
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
  return resolveMealForName(row.mealSlug, meals)
}

/** The pool list ("Veckans måltider") — the primary element of the 2026-08 Planera redesign
 *  (issue #93): every meal the week needs, slotted or not, in one flowing list. */
export default function MealPoolList({
  rows, meals, recipeIndex, fullRecipes, eaters, getFeedback, offers, dayLabel,
  onOpenRecipe, onToggleDone, onRemove, onUnslot, onAddLeftover, renderAssign,
}: Props) {
  if (rows.length === 0) {
    return <div className="tray-empty">Inga måltider i veckan än — sök eller lägg till en nedan.</div>
  }

  return (
    <div className="plan-pool-list">
      {rows.map(row => {
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
            {row.slot ? (
              <span className="tray-tag tray-tag--slot">{dayLabel(row.slot.date)} {row.slot.kind === 'lunch' ? '☼' : '☾'}</span>
            ) : (
              <span className="tray-tag tray-tag--none">ej inplanerad</span>
            )}
            {row.receptSlug && (
              <button type="button" className="mini" onClick={() => onOpenRecipe(row.receptSlug!)}>Recept ›</button>
            )}
            {row.slot ? (
              <>
                <button type="button" className="mini" onClick={() => onUnslot(row.slot!.date, row.slot!.kind)}>✕ Avboka</button>
                {/* Derived rows have no stable identity for resterAv to point at (see
                    PoolRow's own doc comment) — offering "rester" here would create a
                    leftover linked to a positional id, not the meal it was made from. */}
                {!row.derived && (
                  <button type="button" className="mini rest" onClick={() => onAddLeftover(row)}>↩ rester</button>
                )}
              </>
            ) : (
              <>
                {!row.derived && (
                  <>
                    <button type="button" className="mini" onClick={() => onToggleDone(row.id)}>
                      {row.done ? '✓ Klart' : '✓ Markera klar'}
                    </button>
                    <button type="button" className="mini" onClick={() => onRemove(row.id)}>✕ Ta bort</button>
                  </>
                )}
                {renderAssign(row.id, meal.namn, meal.slug, row.receptSlug, row.id)}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
