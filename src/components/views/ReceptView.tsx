import { useState } from 'react'
import { RecipeIndexEntry, Eater } from '../../types'
import type { Meal } from '../../types/meal'
import { useFeedback } from '../../hooks/useFeedback'
import { resolveMealForRecipe } from '../../lib/mealResolve'
import { isNonMealRecipe, nonMealLabel } from '../../lib/recipeKind'
import RecipeFeedbackBar from '../feedback/RecipeFeedbackBar'
import TopBar from '../TopBar'

interface Props {
  onBack: () => void
  recipeIndex: RecipeIndexEntry[]
  meals: Meal[]
  eaters: Eater[]
  onOpenRecipe: (slug: string) => void
}

function categoryEmoji(kategorier: string[]): string {
  if (kategorier.includes('vegansk')) return '🌱'
  if (kategorier.includes('vegetarisk')) return '🥚'
  if (kategorier.includes('fisk')) return '🐟'
  return '🍽️'
}

function categoryText(kategorier: string[]): string {
  if (kategorier.includes('vegansk')) return 'Vegansk'
  if (kategorier.includes('vegetarisk')) return 'Vegetarisk'
  if (kategorier.includes('fisk')) return 'Fisk'
  return kategorier[0] ?? ''
}

export default function ReceptView({ onBack, recipeIndex, meals, eaters, onOpenRecipe }: Props) {
  const [query, setQuery] = useState('')
  // Baking/dessert recipes are hidden by default, here and in every planning surface — this
  // chip is the one place in the app that shows them again (src/lib/recipeKind.ts). Plain
  // useState, not a persisted store: "show the cakes" is a per-visit intent, not a setting.
  const [showBaking, setShowBaking] = useState(false)
  const { getFeedback, setExcludeFromWeekPlan } = useFeedback()

  const q = query.trim().toLowerCase()
  const bakingCount = recipeIndex.filter(isNonMealRecipe).length
  const filtered = recipeIndex
    .filter(r => showBaking || !isNonMealRecipe(r))
    .filter(r => !q || r.namn.toLowerCase().includes(q))

  return (
    <div className="screen screen--recept">
      <TopBar onBack={onBack} eyebrow={`${filtered.length} recept`} title="Receptbiblioteket" />
      <div className="screen-body">
        <div className="recipe-scroll-list">
          <input
            className="recipe-search"
            type="search"
            placeholder="Sök recept…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {bakingCount > 0 && (
            <div className="recipe-filterbar">
              <button
                type="button"
                className={`fynd-chip${showBaking ? ' on' : ''}`}
                aria-pressed={showBaking}
                onClick={() => setShowBaking(v => !v)}
              >
                🧁 Bakning & fest ({bakingCount})
              </button>
              <span className="recipe-filter-hint">
                {showBaking ? 'Visas i listan – men aldrig i matplaneringen.' : 'Dolda som standard.'}
              </span>
            </div>
          )}
          {filtered.length === 0 && (
            <div className="recipe-search-empty">
              {q ? `Inga recept matchar "${query}".` : 'Inga recept att visa.'}
            </div>
          )}
          {filtered.map(r => {
            // Feedback is keyed by meal, not recipe (see CLAUDE.md's Stage 5 note) — most
            // recipes have no meals.json entry, so this resolves to a virtual meal keyed
            // to the recipe's own slug, which is why this still reads/writes correctly for
            // almost every card even though the key underneath changed.
            const mealId = resolveMealForRecipe(r.slug, r.namn, meals).slug
            const excluded = getFeedback(mealId)?.excludeFromWeekPlan ?? false
            const bakingLabel = nonMealLabel(r)
            return (
              <div key={r.slug} className={`recipe-card-wrap${excluded ? ' excluded' : ''}`}>
                <button
                  className="recipe-card-btn"
                  onClick={() => onOpenRecipe(r.slug)}
                >
                  {r.bildUrl && (
                    <img className="recipe-thumb" src={r.bildUrl} alt={r.namn} loading="lazy" />
                  )}
                  <div className="recipe-card-info">
                    <div className="recipe-card-name">{r.namn}</div>
                    <div className="recipe-card-meta">
                      <span>{r.tid_min} min</span>
                      <span className="recipe-card-dot">·</span>
                      <span>{categoryEmoji(r.kategorier)} {categoryText(r.kategorier)}</span>
                      {bakingLabel && <span className="recipe-card-badge">{bakingLabel}</span>}
                    </div>
                  </div>
                </button>
                <div className="recipe-card-footer">
                  <RecipeFeedbackBar mealId={mealId} eaters={eaters} variant="card" />
                  {bakingLabel ? (
                    // The per-recipe exclude toggle would be a no-op here: a non-meal recipe
                    // is already kept out of every planning surface by recipeKind.ts.
                    <span className="exclude-toggle">Ingår aldrig i veckoplanen</span>
                  ) : (
                    <label className="exclude-toggle">
                      <input
                        type="checkbox"
                        checked={excluded}
                        onChange={e => setExcludeFromWeekPlan(mealId, e.target.checked)}
                      />
                      <span>Använd inte i veckoplan</span>
                    </label>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
