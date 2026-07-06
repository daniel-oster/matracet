import { useMemo, useState } from 'react'
import { DayMeal, Eater, MealKind, RecipeIndexEntry } from '../../types'
import type { DayPlan } from '../../presence/types'
import { useWeekPlan, applyOverride } from '../../hooks/useWeekPlan'
import { useFeedback } from '../../hooks/useFeedback'
import { useRecipes } from '../../hooks/useRecipes'
import { useOffers } from '../../hooks/useOffers'
import { tagOffers } from '../../lib/bevaka'
import { rankSuggestions, SuggestionFilter, SuggestionSort } from '../../lib/suggestions'

const DAY_SHORT: Record<string, string> = {
  mandag: 'Mån', tisdag: 'Tis', onsdag: 'Ons',
  torsdag: 'Tor', fredag: 'Fre', lordag: 'Lör', sondag: 'Sön',
}
const DAY_NAMES: Record<string, string> = {
  mandag: 'Måndag', tisdag: 'Tisdag', onsdag: 'Onsdag',
  torsdag: 'Torsdag', fredag: 'Fredag', lordag: 'Lördag', sondag: 'Söndag',
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

const SORTS: { id: SuggestionSort; label: string }[] = [
  { id: 'match', label: 'Bäst' },
  { id: 'savings', label: '💰 Besparing' },
  { id: 'favorites', label: '❤ Favoriter' },
  { id: 'fastest', label: '⚡ Snabbast' },
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

  const enrichedDays = useMemo(() => days.map(rawDay => {
    const dinner = applyOverride(rawDay, getOverride(rawDay.datum, 'dinner'))
    const rawLunch = lunches.find(l => l.datum === rawDay.datum)
    const lunch = rawLunch ? applyOverride(rawLunch, getOverride(rawDay.datum, 'lunch')) : undefined
    return {
      datum: rawDay.datum,
      dag: rawDay.dag,
      plan: dayPlans.find(p => p.date === rawDay.datum),
      dinnerLabel: dinner.recept ?? dinner.anteckning ?? null,
      dinnerSlug: dinner.receptSlug ?? null,
      lunchLabel: lunch?.recept ?? lunch?.anteckning ?? null,
      lunchSlug: lunch?.receptSlug ?? null,
      dinnerOverride: getOverride(rawDay.datum, 'dinner'),
      lunchOverride: getOverride(rawDay.datum, 'lunch'),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [days, lunches, dayPlans, getOverride])

  const [activeDate, setActiveDate] = useState(() => {
    const firstEmpty = enrichedDays.find(d => !d.lunchLabel || !d.dinnerLabel)
    return (firstEmpty ?? enrichedDays[0])?.datum
  })
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SuggestionFilter>('alla')
  const [sort, setSort] = useState<SuggestionSort>('match')

  const active = enrichedDays.find(d => d.datum === activeDate) ?? enrichedDays[0]

  const suggestions = rankSuggestions({
    recipeIndex, fullRecipes, query, filter, sort, eaters,
    presentPersonIds: active?.plan?.presentPersons.map(p => p.id) ?? null,
    offers, getFeedback,
  })

  function assign(kind: MealKind, entry: { namn: string; slug: string }) {
    if (!active) return
    setMeal(active.datum, kind, entry.namn, entry.slug)
  }

  return (
    <div className="planner">
      <div className="day-strip">
        {enrichedDays.map(d => (
          <button
            key={d.datum}
            type="button"
            className={`day-pill${d.datum === active?.datum ? ' on' : ''}`}
            onClick={() => setActiveDate(d.datum)}
          >
            <span className="day-pill-w">{DAY_SHORT[d.dag] ?? d.dag}</span>
            <span className="day-pill-n">{dateNum(d.datum)}</span>
            <span className="day-pill-dots">
              <span className={`day-dot${d.lunchLabel ? ' filled' : ''}`} title="Lunch" />
              <span className={`day-dot${d.dinnerLabel ? ' filled' : ''}`} title="Middag" />
            </span>
          </button>
        ))}
      </div>

      {active && (
        <div className="active-day">
          <div className="active-day-name">{DAY_NAMES[active.dag] ?? active.dag}, väljer plats för:</div>
          <div className="active-day-slots">
            {(['lunch', 'dinner'] as MealKind[]).map(kind => {
              const label = kind === 'lunch' ? active.lunchLabel : active.dinnerLabel
              const slug = kind === 'lunch' ? active.lunchSlug : active.dinnerSlug
              const override = kind === 'lunch' ? active.lunchOverride : active.dinnerOverride
              return (
                <div key={kind} className="active-slot">
                  <span className="active-slot-ic">{kind === 'lunch' ? '☼' : '☾'}</span>
                  <span className={`active-slot-dish${label ? '' : ' empty'}`}>{label ?? 'ledig'}</span>
                  {slug && (
                    <button type="button" className="active-slot-open" onClick={() => onOpenRecipe(slug)}>Recept ›</button>
                  )}
                  {override && (
                    <button
                      type="button"
                      className="active-slot-clear"
                      onClick={() => clearOverride(active.datum, kind)}
                      title="Återställ till ursprunglig plan"
                    >✕</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="sugg-controls">
        <div className="sugg-filters">
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
        </div>
        <div className="sugg-sorts">
          {SORTS.map(s => (
            <button
              key={s.id}
              type="button"
              className={`sugg-sortbtn${sort === s.id ? ' on' : ''}`}
              onClick={() => setSort(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <input
          className="tray-search"
          type="search"
          placeholder="Sök recept…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="sugg-list">
        {suggestions.map(s => {
          const isLunch = active?.lunchSlug === s.entry.slug
          const isDinner = active?.dinnerSlug === s.entry.slug
          return (
            <div key={s.entry.slug} className={`sugg-card${s.excluded ? ' excluded' : ''}`}>
              {s.entry.bildUrl
                ? <img className="sugg-card-img" src={s.entry.bildUrl} alt="" />
                : <div className="sugg-card-img sugg-card-img--empty" />}
              <div className="sugg-card-body">
                <button type="button" className="sugg-card-name" onClick={() => onOpenRecipe(s.entry.slug)}>
                  {s.entry.namn}
                </button>
                <div className="sugg-card-tags">
                  {s.tags.map((t, i) => <span key={i} className={`tray-tag tray-tag--${t.kind}`}>{t.text}</span>)}
                </div>
              </div>
              <div className="sugg-card-assign">
                <button type="button" className={`sugg-assign${isLunch ? ' on' : ''}`} onClick={() => assign('lunch', s.entry)}>
                  {isLunch ? '✓ Lunch' : '☼ Lunch'}
                </button>
                <button type="button" className={`sugg-assign${isDinner ? ' on' : ''}`} onClick={() => assign('dinner', s.entry)}>
                  {isDinner ? '✓ Middag' : '☾ Middag'}
                </button>
              </div>
            </div>
          )
        })}
        {suggestions.length === 0 && <div className="tray-empty">Inga recept matchar.</div>}
      </div>
    </div>
  )
}
