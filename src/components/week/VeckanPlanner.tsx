import { useMemo, useState } from 'react'
import { DayMeal, Eater, MealKind, RecipeIndexEntry } from '../../types'
import type { Meal } from '../../types/meal'
import type { DayPlan } from '../../presence/types'
import { useWeekPlan, applyOverride, effectivePresentIds, diffAttendance, MealAttendance } from '../../hooks/useWeekPlan'
import { useFeedback } from '../../hooks/useFeedback'
import { useRecipes } from '../../hooks/useRecipes'
import { useOffers } from '../../hooks/useOffers'
import { usePantry } from '../../hooks/usePantry'
import { useStash } from '../../hooks/useStash'
import { useShoppingList } from '../../hooks/useShoppingList'
import { useChaosMode } from '../../hooks/useChaosMode'
import { useLocalMeals } from '../../hooks/useLocalMeals'
import { tagOffers } from '../../lib/bevaka'
import { rankSuggestions, SuggestionFilter, SuggestionSort } from '../../lib/suggestions'
import { findUnlockOpportunities } from '../../lib/unlockMatch'
import { resolveMealForRecipe, resolveComponents, rankComponentOptions, resolveDayMeal, matchMealByName } from '../../lib/mealResolve'
import { evaluateFit } from '../../lib/dietFit'
import StashPantryPanel from '../StashPantryPanel'
import MealEditorModal from '../MealEditorModal'

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
  meals: Meal[]
  onOpenRecipe: (slug: string) => void
}

export default function VeckanPlanner({ days, lunches, dayPlans, eaters, recipeIndex, meals, onOpenRecipe }: Props) {
  const { getOverride, setMeal, clearOverride, setComponentSwap, getAttendance, setAttendance, clearAttendance } = useWeekPlan()
  const { getFeedback } = useFeedback()
  const allSlugs = useMemo(() => recipeIndex.map(r => r.slug), [recipeIndex])
  const fullRecipes = useRecipes(allSlugs)
  const { stores } = useOffers()
  const offers = useMemo(() => (stores ? tagOffers(stores) : []), [stores])
  const chaos = useChaosMode()
  const pantry = usePantry()
  const { items: stashItems } = useStash()
  const { addOrRestoreByName, isActiveByName } = useShoppingList()
  const { upsertMeal } = useLocalMeals()

  const haveNames = useMemo(() => [
    ...(pantry?.always_have ?? []),
    ...(pantry?.current_stock.map(i => i.vara) ?? []),
    ...stashItems.filter(i => !i.done && i.kind === 'stock').map(i => i.namn),
  ], [pantry, stashItems])

  const unlockOpportunities = useMemo(
    () => findUnlockOpportunities(recipeIndex, fullRecipes, haveNames),
    [recipeIndex, fullRecipes, haveNames],
  )
  const [expandedUnlock, setExpandedUnlock] = useState<string | null>(null)

  const enrichedDays = useMemo(() => days.map(rawDay => {
    const dinnerAttendance = getAttendance(rawDay.datum, 'dinner')
    const lunchAttendance = getAttendance(rawDay.datum, 'lunch')
    const dinner = applyOverride(rawDay, getOverride(rawDay.datum, 'dinner'), meals, recipeIndex, dinnerAttendance)
    const rawLunch = lunches.find(l => l.datum === rawDay.datum)
    const lunch = rawLunch ? applyOverride(rawLunch, getOverride(rawDay.datum, 'lunch'), meals, recipeIndex, lunchAttendance) : undefined
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
      dinnerAttendance,
      lunchAttendance,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [days, lunches, dayPlans, meals, recipeIndex, getOverride, getAttendance])

  const [activeDate, setActiveDate] = useState(() => {
    const firstEmpty = enrichedDays.find(d => !d.lunchLabel || !d.dinnerLabel)
    return (firstEmpty ?? enrichedDays[0])?.datum
  })
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SuggestionFilter>('alla')
  const [sort, setSort] = useState<SuggestionSort>('match')
  const [attendanceOpen, setAttendanceOpen] = useState<MealKind | null>(null)
  const [mealQuery, setMealQuery] = useState('')
  const [editorState, setEditorState] = useState<
    { mode: 'closed' } | { mode: 'new'; prefill: string } | { mode: 'edit'; meal: Meal }
  >({ mode: 'closed' })
  const existingMealSlugs = useMemo(
    () => [...meals.map(m => m.slug), ...recipeIndex.map(r => r.slug)],
    [meals, recipeIndex],
  )
  const mealMatches = useMemo(() => {
    const needle = mealQuery.trim().toLowerCase()
    if (!needle) return []
    return meals
      .filter(m => m.namn.toLowerCase().includes(needle) || m.alias.some(a => a.toLowerCase().includes(needle)))
      .slice(0, 8)
  }, [mealQuery, meals])

  const active = enrichedDays.find(d => d.datum === activeDate) ?? enrichedDays[0]
  const activePlanIds = useMemo(() => active?.plan?.presentPersons.map(p => p.id) ?? [], [active])

  const suggestions = rankSuggestions({
    recipeIndex, fullRecipes, meals, query, filter, sort, eaters,
    presentPersonIds: effectivePresentIds(active?.plan?.presentPersons.map(p => p.id) ?? null, active?.dinnerAttendance),
    offers, getFeedback,
  })

  function assign(kind: MealKind, entry: { namn: string; slug: string }) {
    if (!active) return
    const meal = resolveMealForRecipe(entry.slug, entry.namn, meals)
    setMeal(active.datum, kind, meal.slug, entry.slug)
  }

  function attendanceFor(kind: MealKind): MealAttendance | undefined {
    return kind === 'lunch' ? active?.lunchAttendance : active?.dinnerAttendance
  }

  function toggleAttendee(kind: MealKind, eaterId: string) {
    if (!active) return
    const attendance = attendanceFor(kind)
    const base = attendance?.presentIds ?? activePlanIds
    const nextIds = base.includes(eaterId) ? base.filter(id => id !== eaterId) : [...base, eaterId]
    setAttendance(active.datum, kind, { presentIds: nextIds, skip: false, updatedAt: new Date().toISOString() })
  }

  function toggleSkip(kind: MealKind) {
    if (!active) return
    const attendance = attendanceFor(kind)
    if (attendance?.skip) {
      clearAttendance(active.datum, kind)
    } else {
      setAttendance(active.datum, kind, { presentIds: attendance?.presentIds ?? null, skip: true, updatedAt: new Date().toISOString() })
    }
  }

  function resetAttendance(kind: MealKind) {
    if (!active) return
    clearAttendance(active.datum, kind)
    setAttendanceOpen(null)
  }

  return (
    <div className="planner">
      <button
        type="button"
        className={`planmode-toggle${chaos.enabled ? ' on' : ''}`}
        onClick={chaos.toggle}
        title="Växla mellan dag-för-dag-planering och skafferi-läge för kaotiska sträckor"
      >
        {chaos.enabled ? '🏖️ Kaosläge' : '🗓️ Dag för dag'}
      </button>

      {chaos.enabled ? (
        <StashPantryPanel recipeIndex={recipeIndex} fullRecipes={fullRecipes} meals={meals} onOpenRecipe={onOpenRecipe} />
      ) : (
        <>
      <div className="day-strip">
        {enrichedDays.map(d => (
          <button
            key={d.datum}
            type="button"
            className={`day-pill${d.datum === active?.datum ? ' on' : ''}`}
            onClick={() => { setActiveDate(d.datum); setAttendanceOpen(null) }}
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
              const attendance = attendanceFor(kind)
              const { away, extra } = diffAttendance(activePlanIds, attendance)
              const meal = resolveDayMeal({ recept: label, receptSlug: slug ?? undefined, mealSlug: override?.mealSlug }, meals)
              const presentIds = effectivePresentIds(activePlanIds, attendance)
              const presentEaters = presentIds ? eaters.filter(e => presentIds.includes(e.id)) : eaters
              const fit = meal && !attendance?.skip
                ? evaluateFit(meal, slug ? fullRecipes[slug] ?? null : null, presentEaters, getFeedback(meal.slug) ?? null)
                : null
              return (
                <div key={kind} className="active-slot-group">
                  <div className="active-slot">
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
                    <button
                      type="button"
                      className={`active-slot-people${attendance ? ' edited' : ''}${attendanceOpen === kind ? ' on' : ''}`}
                      onClick={() => setAttendanceOpen(o => (o === kind ? null : kind))}
                      title="Vem äter?"
                    >
                      👪
                    </button>
                  </div>
                  {!attendance?.skip && (away.length > 0 || extra.length > 0) && (
                    <div className="active-slot-attendance">
                      {away.map(id => (
                        <span key={`away-${id}`} className="day-flag day-flag--away">− {eaters.find(e => e.id === id)?.namn ?? id}</span>
                      ))}
                      {extra.map(id => (
                        <span key={`extra-${id}`} className="day-flag day-flag--extra">+ {eaters.find(e => e.id === id)?.namn ?? id}</span>
                      ))}
                    </div>
                  )}
                  {override && (() => {
                    if (!meal || meal.komponenter.length === 0) return null
                    return (
                      <div className="active-slot-components">
                        {meal.komponenter.map(orig => {
                          const current = override.komponentByten?.[orig.vara] ?? orig.vara
                          const options = rankComponentOptions(orig, haveNames)
                          return (
                            <div className="component-row" key={orig.vara}>
                              <span className="component-label">{orig.vara}{orig.valfri ? ' · valfri' : ''}</span>
                              <div className="component-options">
                                {options.map(opt => (
                                  <button
                                    key={opt}
                                    type="button"
                                    className={`component-opt${opt === current ? ' on' : ''}`}
                                    onClick={() => setComponentSwap(active.datum, kind, orig.vara, opt === orig.vara ? null : opt)}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                        <button
                          type="button"
                          className="component-shop-btn"
                          onClick={() => {
                            for (const c of resolveComponents(meal, override.komponentByten)) {
                              addOrRestoreByName(c.vara, { source: meal.namn })
                            }
                          }}
                        >
                          🛒 Lägg komponenter i inköpslistan
                        </button>
                      </div>
                    )
                  })()}
                  {fit && (fit.conflicts.length > 0 || fit.unknowns.length > 0 || fit.requiredSwaps.length > 0) && (
                    <div className="fit-hints">
                      {fit.conflicts.map(c => (
                        <div className="fit-conflict" key={`${c.reason}-${c.personId}`}>⚠️ {c.detail}</div>
                      ))}
                      {fit.unknowns.map(u => (
                        <div className="fit-unknown" key={`${u.reason}-${u.personId}`}>? {u.detail}</div>
                      ))}
                      {fit.requiredSwaps.map(s => {
                        const canApply = meal?.komponenter.some(
                          c => (override?.komponentByten?.[c.vara] ?? c.vara) === s.from && c.alternativ.includes(s.to),
                        )
                        return (
                          <div className="fit-swap" key={`${s.from}-${s.to}`}>
                            <span>🔁 funkar för alla om <strong>{s.from}</strong> byts mot <strong>{s.to}</strong> ({s.reason})</span>
                            {canApply && meal && (
                              <button
                                type="button"
                                className="fit-swap-apply"
                                onClick={() => {
                                  const orig = meal.komponenter.find(c => (override?.komponentByten?.[c.vara] ?? c.vara) === s.from)
                                  if (orig) setComponentSwap(active.datum, kind, orig.vara, s.to)
                                }}
                              >
                                Använd
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {attendanceOpen === kind && (
                    <div className="attendance-editor">
                      <div className="attendance-eaters">
                        {eaters.map(e => {
                          const ids = attendance?.presentIds ?? activePlanIds
                          const on = ids.includes(e.id)
                          return (
                            <button
                              key={e.id}
                              type="button"
                              disabled={attendance?.skip}
                              className={`attendance-chip${on ? ' on' : ''}`}
                              onClick={() => toggleAttendee(kind, e.id)}
                            >
                              {on ? '✓ ' : '— '}{e.namn}
                            </button>
                          )
                        })}
                      </div>
                      <div className="attendance-actions">
                        <button
                          type="button"
                          className={`attendance-skip${attendance?.skip ? ' on' : ''}`}
                          onClick={() => toggleSkip(kind)}
                        >
                          {attendance?.skip ? '✓ Ingen måltid behövs' : 'Ingen måltid behövs'}
                        </button>
                        {attendance && (
                          <button type="button" className="attendance-reset" onClick={() => resetAttendance(kind)}>
                            Återställ till schema
                          </button>
                        )}
                        <button type="button" className="attendance-close" onClick={() => setAttendanceOpen(null)}>Klar</button>
                      </div>
                    </div>
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

      {unlockOpportunities.length > 0 && (
        <section className="unlock-section">
          <h3 className="shop-group-title">🔓 Ett köp bort</h3>
          <div className="unlock-list">
            {unlockOpportunities.slice(0, 6).map(o => (
              <div className="unlock-chip" key={o.ingredient}>
                <button
                  type="button"
                  className="unlock-chip-main"
                  onClick={() => setExpandedUnlock(x => (x === o.ingredient ? null : o.ingredient))}
                >
                  <span className="unlock-chip-name">{o.ingredient}</span>
                  <span className="unlock-chip-count">→ {o.recipes.length} rätter</span>
                </button>
                <button
                  type="button"
                  className="unlock-chip-add"
                  onClick={() => addOrRestoreByName(o.ingredient)}
                  title="Lägg till på inköpslistan"
                  disabled={isActiveByName(o.ingredient)}
                >
                  {isActiveByName(o.ingredient) ? '✓' : '+ handla'}
                </button>
              </div>
            ))}
          </div>
          {expandedUnlock && (
            <div className="unlock-recipes">
              {unlockOpportunities.find(o => o.ingredient === expandedUnlock)?.recipes.map(r => (
                <button key={r.slug} type="button" className="unlock-recipe-link" onClick={() => onOpenRecipe(r.slug)}>
                  {r.namn}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="meal-add-section">
        <h3 className="shop-group-title">🍽️ Måltider</h3>
        <input
          className="tray-search"
          type="search"
          placeholder="Sök måltid…"
          value={mealQuery}
          onChange={e => setMealQuery(e.target.value)}
        />
        {mealQuery.trim() ? (
          <div className="meal-add-results">
            {mealMatches.map(m => {
              const isLunch = active?.lunchOverride?.mealSlug === m.slug
              const isDinner = active?.dinnerOverride?.mealSlug === m.slug
              return (
                <div key={m.slug} className="meal-chip">
                  <span className="meal-chip-name">{m.namn}</span>
                  <div className="meal-chip-assign">
                    <button
                      type="button"
                      className="meal-chip-edit"
                      title="Redigera måltid"
                      onClick={() => setEditorState({ mode: 'edit', meal: m })}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className={`sugg-assign${isLunch ? ' on' : ''}`}
                      onClick={() => active && setMeal(active.datum, 'lunch', m.slug, m.receptSlug)}
                    >
                      {isLunch ? '✓ Lunch' : '☼ Lunch'}
                    </button>
                    <button
                      type="button"
                      className={`sugg-assign${isDinner ? ' on' : ''}`}
                      onClick={() => active && setMeal(active.datum, 'dinner', m.slug, m.receptSlug)}
                    >
                      {isDinner ? '✓ Middag' : '☾ Middag'}
                    </button>
                  </div>
                </div>
              )
            })}
            {mealMatches.length === 0 && <div className="tray-empty">Inga måltider matchar.</div>}
            {!matchMealByName(mealQuery, meals) && (
              <button
                type="button"
                className="meal-add-create"
                onClick={() => setEditorState({ mode: 'new', prefill: mealQuery.trim() })}
              >
                + Skapa ny måltid: "{mealQuery.trim()}"
              </button>
            )}
          </div>
        ) : (
          <div className="meal-add-hint-row">
            <span className="meal-add-hint">Sök en måltid för att lägga till den, eller skapa en ny.</span>
            <button
              type="button"
              className="meal-add-new-btn"
              onClick={() => setEditorState({ mode: 'new', prefill: '' })}
            >
              + Ny måltid
            </button>
          </div>
        )}
      </section>

      {editorState.mode !== 'closed' && (
        <MealEditorModal
          meal={editorState.mode === 'edit' ? editorState.meal : null}
          initialName={editorState.mode === 'new' ? editorState.prefill : undefined}
          recipeIndex={recipeIndex}
          existingSlugs={existingMealSlugs}
          onSave={m => {
            upsertMeal(m)
            setEditorState({ mode: 'closed' })
            setMealQuery('')
          }}
          onClose={() => setEditorState({ mode: 'closed' })}
        />
      )}

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
        </>
      )}
    </div>
  )
}
