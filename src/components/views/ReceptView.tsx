import { useState } from 'react'
import { RecipeIndexEntry, Eater } from '../../types'
import type { Meal } from '../../types/meal'
import { useFeedback } from '../../hooks/useFeedback'
import { resolveMealForRecipe } from '../../lib/mealResolve'
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
  const { getFeedback, setExcludeFromWeekPlan } = useFeedback()

  const q = query.trim().toLowerCase()
  const filtered = q
    ? recipeIndex.filter(r => r.namn.toLowerCase().includes(q))
    : recipeIndex

  return (
    <div className="screen screen--recept">
      <TopBar onBack={onBack} eyebrow={`${recipeIndex.length} recept`} title="Receptbiblioteket" />
      <div className="screen-body">
        <div className="recipe-scroll-list">
          <input
            className="recipe-search"
            type="search"
            placeholder="Sök recept…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {filtered.length === 0 && (
            <div className="recipe-search-empty">Inga recept matchar "{query}".</div>
          )}
          {filtered.map(r => {
            // Feedback is keyed by meal, not recipe (see CLAUDE.md's Stage 5 note) — most
            // recipes have no meals.json entry, so this resolves to a virtual meal keyed
            // to the recipe's own slug, which is why this still reads/writes correctly for
            // almost every card even though the key underneath changed.
            const mealId = resolveMealForRecipe(r.slug, r.namn, meals).slug
            const excluded = getFeedback(mealId)?.excludeFromWeekPlan ?? false
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
                    </div>
                  </div>
                </button>
                <div className="recipe-card-footer">
                  <RecipeFeedbackBar mealId={mealId} eaters={eaters} variant="card" />
                  <label className="exclude-toggle">
                    <input
                      type="checkbox"
                      checked={excluded}
                      onChange={e => setExcludeFromWeekPlan(mealId, e.target.checked)}
                    />
                    <span>Använd inte i veckoplan</span>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
