import { useState } from 'react'
import { RecipeIndexEntry, Eater } from '../../types'
import type { Meal } from '../../types/meal'
import { useFeedback } from '../../hooks/useFeedback'
import { resolveMealForRecipe } from '../../lib/mealResolve'
import { isNonMealRecipe, nonMealLabel } from '../../lib/recipeKind'
import { partitionRecipes, type RecipeLibraryFilter } from '../../lib/recipeSearch'
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

/** Copy for the "your search has matches you can't see" callout. Reads differently when the
 *  visible list is empty ("the hits are over there") vs. non-empty ("there are more"). */
function hiddenMatchText(hidden: RecipeIndexEntry[], visibleCount: number): string {
  const where = hidden.some(isNonMealRecipe) ? '🧁 bakning & fest' : '🍽️ måltiderna'
  const n = hidden.length
  const traffar = n === 1 ? '1 träff' : `${n} träffar`
  return visibleCount === 0
    ? `Sökningen ger ${traffar} under ${where}`
    : `${traffar} till under ${where}`
}

export default function ReceptView({ onBack, recipeIndex, meals, eaters, onOpenRecipe }: Props) {
  const [query, setQuery] = useState('')
  // Which slice of the library is on screen. Defaults to 'maltider' (baking hidden), but the
  // three tabs are always visible with counts — the previous single subtle toggle chip was
  // not findable, and a search whose only hit was filtered out reported a flat "no matches".
  // Plain useState, not a persisted store: "show the cakes" is a per-visit intent.
  const [filter, setFilter] = useState<RecipeLibraryFilter>('maltider')
  const { getFeedback, setExcludeFromWeekPlan } = useFeedback()

  const q = query.trim()
  const bakingCount = recipeIndex.filter(isNonMealRecipe).length
  const mealCount = recipeIndex.length - bakingCount
  const { visible, hiddenMatches } = partitionRecipes(recipeIndex, filter, q)

  const tabs: { id: RecipeLibraryFilter; label: string; count: number }[] = [
    { id: 'maltider', label: '🍽️ Måltider', count: mealCount },
    { id: 'bakning', label: '🧁 Bakning & fest', count: bakingCount },
    { id: 'alla', label: 'Alla', count: recipeIndex.length },
  ]

  return (
    <div className="screen screen--recept">
      <TopBar onBack={onBack} eyebrow={`${visible.length} recept`} title="Receptbiblioteket" />
      <div className="screen-body">
        <div className="recipe-scroll-list">
          <input
            className="recipe-search"
            type="search"
            placeholder="Sök recept, tagg eller kategori…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="recipe-tabs" role="tablist" aria-label="Visa recept">
            {tabs.map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={filter === t.id}
                className={`recipe-tab${filter === t.id ? ' on' : ''}`}
                onClick={() => setFilter(t.id)}
              >
                {t.label} <span className="recipe-tab-count">{t.count}</span>
              </button>
            ))}
          </div>
          {filter === 'bakning' && (
            <div className="recipe-filter-hint">
              Bak-, efterrätts- och fikarecept. De finns alltid här, men föreslås aldrig när du planerar mat.
            </div>
          )}
          {/* A query whose matches are all filtered out must say so and offer a way through —
              never a bare "inga recept matchar", which is indistinguishable from the recipe
              not existing at all. This is the exact dead end that made a freshly-tagged
              baking recipe unfindable by its own name. */}
          {q !== '' && hiddenMatches.length > 0 && (
            <button type="button" className="recipe-hidden-hint" onClick={() => setFilter('alla')}>
              <span>{hiddenMatchText(hiddenMatches, visible.length)}</span>
              <span className="recipe-hidden-hint-cta">Visa alla ›</span>
            </button>
          )}
          {visible.length === 0 && hiddenMatches.length === 0 && (
            <div className="recipe-search-empty">
              {q ? `Inga recept matchar "${query}".` : 'Inga recept att visa.'}
            </div>
          )}
          {visible.map(r => {
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
