import { useState, useEffect, useMemo } from 'react'
import type { Eater, RecipeIndexEntry } from '../../types'
import { useFeedback } from '../../hooks/useFeedback'

interface Props {
  dayLabel: string
  recipeIndex: RecipeIndexEntry[]
  /** Eater-ids present that day (from the presence resolver), or null if unknown. */
  presentPersonIds: string[] | null
  eaters: Eater[]
  onSelect: (entry: RecipeIndexEntry) => void
  onClose: () => void
}

function matchesQuery(r: RecipeIndexEntry, q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  return (
    r.namn.toLowerCase().includes(needle) ||
    r.kategorier.some(k => k.toLowerCase().includes(needle))
  )
}

/**
 * A recipe is "suitable" for the day when it doesn't structurally conflict with a
 * present eater's diet. The only hard rule we can derive today: if a vegan is home,
 * meat/fish dishes don't fit. Everything else stays eligible — we suggest, never block.
 */
function suitableForPresent(r: RecipeIndexEntry, eaters: Eater[], presentIds: string[] | null): boolean {
  if (!presentIds || presentIds.length === 0) return true
  const present = eaters.filter(e => presentIds.includes(e.id))
  const hasVegan = present.some(e => e.kost?.includes('vegan'))
  if (hasVegan && (r.kategorier.includes('kott') || r.kategorier.includes('fisk'))) {
    return false
  }
  return true
}

export default function ReplaceRecipeModal({
  dayLabel,
  recipeIndex,
  presentPersonIds,
  eaters,
  onSelect,
  onClose,
}: Props) {
  const { getFeedback } = useFeedback()
  const [query, setQuery] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const { suggested, others, excluded } = useMemo(() => {
    const filtered = recipeIndex.filter(r => matchesQuery(r, query))
    const suggested: RecipeIndexEntry[] = []
    const others: RecipeIndexEntry[] = []
    const excluded: RecipeIndexEntry[] = []
    for (const r of filtered) {
      if (getFeedback(r.slug)?.excludeFromWeekPlan) {
        excluded.push(r)
      } else if (suitableForPresent(r, eaters, presentPersonIds)) {
        suggested.push(r)
      } else {
        others.push(r)
      }
    }
    return { suggested, others, excluded }
  }, [recipeIndex, query, eaters, presentPersonIds, getFeedback])

  function row(r: RecipeIndexEntry, extraClass = '') {
    return (
      <button
        key={r.slug}
        type="button"
        className={`replace-row${extraClass}`}
        onClick={() => onSelect(r)}
      >
        {r.bildUrl && <img className="replace-thumb" src={r.bildUrl} alt="" loading="lazy" />}
        <span className="replace-row-name">{r.namn}</span>
        <span className="replace-row-meta">{r.tid_min} min</span>
      </button>
    )
  }

  return (
    <div className="replace-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="replace-panel" role="dialog" aria-label="Ersätt måltid">
        <div className="replace-head">
          <div>
            <div className="replace-title">Ersätt måltid</div>
            <div className="replace-sub">{dayLabel}</div>
          </div>
          <button type="button" className="replace-close" onClick={onClose} aria-label="Stäng">✕</button>
        </div>

        <input
          className="replace-search"
          type="search"
          placeholder="Sök recept…"
          value={query}
          autoFocus
          onChange={e => setQuery(e.target.value)}
        />

        <div className="replace-list">
          {suggested.length > 0 && (
            <>
              <div className="replace-group-label">Förslag för dagen</div>
              {suggested.map(r => row(r))}
            </>
          )}

          {others.length > 0 && (
            <>
              <div className="replace-group-label">Övriga recept</div>
              {others.map(r => row(r))}
            </>
          )}

          {excluded.length > 0 && (
            <>
              <div className="replace-group-label">Uteslutna ur veckoplan</div>
              {excluded.map(r => row(r, ' replace-row--excluded'))}
            </>
          )}

          {suggested.length === 0 && others.length === 0 && excluded.length === 0 && (
            <div className="replace-empty">Inga recept matchar “{query}”.</div>
          )}
        </div>
      </div>
    </div>
  )
}
