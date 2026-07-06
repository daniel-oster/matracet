import { useEffect, useMemo, useRef, useState } from 'react'
import { DayMeal, Eater, MealKind, RecipeIndexEntry } from '../../types'
import type { DayPlan } from '../../presence/types'
import { useWeekPlan, applyOverride } from '../../hooks/useWeekPlan'
import { useFeedback } from '../../hooks/useFeedback'
import { useRecipes } from '../../hooks/useRecipes'
import { useOffers } from '../../hooks/useOffers'
import { tagOffers } from '../../lib/bevaka'
import { rankSuggestions, RankedSuggestion, SuggestionFilter } from '../../lib/suggestions'

const DAY_SHORT: Record<string, string> = {
  mandag: 'Mån', tisdag: 'Tis', onsdag: 'Ons',
  torsdag: 'Tor', fredag: 'Fre', lordag: 'Lör', sondag: 'Sön',
}

function dateNum(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getUTCDate()
}

const FILTERS: { id: SuggestionFilter; label: string }[] = [
  { id: 'alla', label: 'Alla' },
  { id: 'fynd', label: '🏷 Fynd' },
  { id: 'snabbt', label: '⚡ Snabbt' },
  { id: 'vegansk', label: '🌱 Vegansk' },
]

interface Props {
  days: DayMeal[]
  lunches: DayMeal[]
  dayPlans: DayPlan[]
  eaters: Eater[]
  recipeIndex: RecipeIndexEntry[]
  onOpenRecipe: (slug: string) => void
}

export default function VeckanPlanner({ days, lunches, dayPlans, eaters, recipeIndex, onOpenRecipe }: Props) {
  const { getOverride, setMeal, clearOverride } = useWeekPlan()
  const { getFeedback } = useFeedback()
  const allSlugs = useMemo(() => recipeIndex.map(r => r.slug), [recipeIndex])
  const fullRecipes = useRecipes(allSlugs)
  const { stores } = useOffers()
  const offers = useMemo(() => (stores ? tagOffers(stores) : []), [stores])

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SuggestionFilter>('alla')
  const [picked, setPicked] = useState<RankedSuggestion | null>(null)
  const [drag, setDrag] = useState<{ entry: RecipeIndexEntry; x: number; y: number } | null>(null)
  const [hover, setHover] = useState<{ date: string; kind: MealKind } | null>(null)
  const startRef = useRef<{ x: number; y: number; entry: RecipeIndexEntry; moved: boolean } | null>(null)

  const suggestions = rankSuggestions({
    recipeIndex, fullRecipes, query, filter, eaters,
    presentPersonIds: null,
    offers, getFeedback,
  })

  function assign(date: string, kind: MealKind, entry: RecipeIndexEntry) {
    setMeal(date, kind, entry.namn, entry.slug)
    setPicked(null)
  }

  function onMove(e: PointerEvent) {
    const st = startRef.current
    if (!st) return
    if (!st.moved && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 8) return
    st.moved = true
    setDrag({ entry: st.entry, x: e.clientX, y: e.clientY })
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const slot = el && el.closest ? (el.closest('[data-date]') as HTMLElement | null) : null
    setHover(slot ? { date: slot.dataset.date!, kind: slot.dataset.kind as MealKind } : null)
  }

  function onUp() {
    const st = startRef.current
    if (st) {
      if (st.moved && hover) {
        assign(hover.date, hover.kind, st.entry)
      } else if (!st.moved) {
        setPicked(prev => (prev?.entry.slug === st.entry.slug ? null : suggestions.find(s => s.entry.slug === st.entry.slug) ?? null))
      }
    }
    startRef.current = null
    setDrag(null)
    setHover(null)
  }

  useEffect(() => {
    if (!drag) return
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  })

  function onSugPointerDown(e: React.PointerEvent, entry: RecipeIndexEntry) {
    startRef.current = { x: e.clientX, y: e.clientY, entry, moved: false }
    try { (e.target as Element).setPointerCapture(e.pointerId) } catch { /* touch devices without pointer capture */ }
  }

  function clickSlot(date: string, kind: MealKind) {
    if (picked) assign(date, kind, picked.entry)
  }

  return (
    <div className="planner" onPointerMove={drag ? undefined : onMove} onPointerUp={onUp}>
      <div className="hint">
        {picked
          ? <>Vald: <b>{picked.entry.namn}</b> — tryck en lunch- eller middagsruta.</>
          : <>Dra ett förslag till en dag, eller tryck en rätt och sedan en ruta.</>}
      </div>

      <div className="day-plan-list">
        {days.map(rawDay => {
          const day = applyOverride(rawDay, getOverride(rawDay.datum, 'dinner'))
          const rawLunch = lunches.find(l => l.datum === rawDay.datum)
          const lunch = rawLunch ? applyOverride(rawLunch, getOverride(rawDay.datum, 'lunch')) : undefined
          const plan = dayPlans.find(p => p.date === day.datum)

          return (
            <div key={day.datum} className="dplan-card">
              <div className="dplan-date">
                <span className="w">{DAY_SHORT[day.dag] ?? day.dag}</span>
                <span className="n">{dateNum(day.datum)}</span>
              </div>
              <div className="dplan-halves">
                {(['lunch', 'dinner'] as MealKind[]).map(kind => {
                  const meal = kind === 'lunch' ? lunch : day
                  const hot = hover?.date === day.datum && hover?.kind === kind
                  const label = meal?.recept ?? meal?.anteckning ?? null
                  const slug = meal?.receptSlug
                  const override = getOverride(day.datum, kind)
                  return (
                    <div
                      key={kind}
                      data-date={day.datum}
                      data-kind={kind}
                      className={`dplan-half dplan-half--${kind}${hot ? ' hot' : ''}${picked ? ' pickable' : ''}`}
                      onClick={() => clickSlot(day.datum, kind)}
                    >
                      <span className="dplan-half-label">{kind === 'lunch' ? '☼ Lunch' : '☾ Middag'}</span>
                      <span className={`dplan-half-dish${label ? '' : ' empty'}`}>
                        {label ?? (picked ? 'lägg här' : 'ledig')}
                      </span>
                      {hot && <span className="dplan-drop-lbl">släpp</span>}
                      {slug && !hot && (
                        <button
                          type="button"
                          className="dplan-half-open"
                          onClick={e => { e.stopPropagation(); onOpenRecipe(slug) }}
                        >
                          Recept ›
                        </button>
                      )}
                      {override && !hot && (
                        <button
                          type="button"
                          className="dplan-half-clear"
                          onClick={e => { e.stopPropagation(); clearOverride(day.datum, kind) }}
                          title="Återställ till ursprunglig plan"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              {plan && plan.portions > 0 && plan.windowStatus !== 'OPEN' && (
                <div className="dplan-window">
                  {plan.windowStatus === 'CONFLICT' ? `⚠ mat senast ${plan.eatEarlyBy}` : `↓ senast ${plan.windowEndsBy}`}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="tray">
        <div className="tray-grip" />
        <div className="tray-head">
          <div className="tray-title">Förslag</div>
          <div className="tray-sub">
            {picked ? `vald: ${picked.entry.namn}` : `${suggestions.length} rätter`}
          </div>
        </div>
        <div className="tray-filters">
          {FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              className={`tray-fbtn${filter === f.id ? ' on' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          <input
            className="tray-search"
            type="search"
            placeholder="Sök…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="tray-row">
          {suggestions.map(s => (
            <div
              key={s.entry.slug}
              className={`tray-card${picked?.entry.slug === s.entry.slug ? ' picked' : ''}${s.excluded ? ' excluded' : ''}`}
              onPointerDown={e => onSugPointerDown(e, s.entry)}
            >
              {s.entry.bildUrl && <img src={s.entry.bildUrl} alt="" draggable={false} />}
              <div className="tray-card-name">{s.entry.namn}</div>
              <div className="tray-card-tags">
                {s.tags.map((t, i) => <span key={i} className={`tray-tag tray-tag--${t.kind}`}>{t.text}</span>)}
              </div>
            </div>
          ))}
          {suggestions.length === 0 && <div className="tray-empty">Inga recept matchar.</div>}
        </div>
      </div>

      {drag && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          {drag.entry.bildUrl && <img src={drag.entry.bildUrl} alt="" />}
          <div className="drag-ghost-name">{drag.entry.namn}</div>
        </div>
      )}
    </div>
  )
}
