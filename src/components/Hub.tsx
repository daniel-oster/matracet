import { DayMeal, RecipeIndexEntry, ScreenName } from '../types'
import { useWeekPlan, applyOverride } from '../hooks/useWeekPlan'
import { usePlanMode } from '../hooks/usePlanMode'
import { useStash } from '../hooks/useStash'
import type { DayPlan } from '../presence/types'

const DAY_NAMES: Record<string, string> = {
  mandag: 'Måndag', tisdag: 'Tisdag', onsdag: 'Onsdag',
  torsdag: 'Torsdag', fredag: 'Fredag', lordag: 'Lördag', sondag: 'Söndag',
}

function hardRefresh() {
  const url = new URL(window.location.href)
  url.searchParams.set('_r', Date.now().toString())
  window.location.href = url.toString()
}

function categoryEmoji(kategorier: string[]): string {
  if (kategorier.includes('vegansk')) return '🌱'
  if (kategorier.includes('vegetarisk')) return '🥚'
  if (kategorier.includes('fisk')) return '🐟'
  if (kategorier.includes('kott')) return '🥩'
  return '🍽️'
}

interface Props {
  weekLabel: string
  rollingDays: DayMeal[]
  recipeIndex: RecipeIndexEntry[]
  dayPlans: DayPlan[]
  onNavigate: (screen: ScreenName) => void
  onOpenRecipe: (slug: string) => void
}

export default function Hub({ weekLabel, rollingDays, recipeIndex, dayPlans, onNavigate, onOpenRecipe }: Props) {
  const { getOverride, getAttendance } = useWeekPlan()
  const { mode, toggle: toggleMode } = usePlanMode()
  const { items, toggleDone } = useStash()
  const rawTonight = rollingDays[0]
  const tonight = rawTonight
    ? applyOverride(rawTonight, getOverride(rawTonight.datum, 'dinner'), getAttendance(rawTonight.datum, 'dinner'))
    : undefined
  const tonightRecipe = tonight?.receptSlug ? recipeIndex.find(r => r.slug === tonight.receptSlug) : undefined
  const tonightPlan = tonight ? dayPlans.find(p => p.date === tonight.datum) : undefined
  const poolItems = items.filter(i => !i.done)

  return (
    <div className="hub">
      <div className="hub-topbar">
        <div>
          <div className="hub-hello">Veckans matsedel</div>
          <div className="hub-title">Matracet</div>
        </div>
        <div className="hub-topbar-right">
          <div className="hub-week-label">{weekLabel}</div>
          <button
            className={`planmode-toggle${mode === 'semester' ? ' on' : ''}`}
            onClick={toggleMode}
            title="Växla mellan normalt läge och semesterläge"
          >
            {mode === 'semester' ? '🏖️ Semester' : '🗓️ Normalt'}
          </button>
          <button
            className="hub-refresh-btn"
            onClick={hardRefresh}
            title="Hämta senaste versionen av appen (rensar inte dina sparade val)"
          >
            ⟳
          </button>
        </div>
      </div>

      <div className="hub-pad">
        {mode === 'semester' ? (
          <div className="semester-card">
            <div className="semester-card-title">🏖️ Semesterläge · vad känns bra nu?</div>
            {poolItems.length === 0 ? (
              <div className="semester-card-empty">
                Skafferiet är tomt än. Öppna det för att fylla på med fynd, råvaror och idéer.
              </div>
            ) : (
              <div className="semester-card-list">
                {poolItems.slice(0, 4).map(item => (
                  <div className="semester-row" key={item.id}>
                    <button
                      type="button"
                      className="semester-row-name"
                      onClick={() => (item.receptSlug ? onOpenRecipe(item.receptSlug) : onNavigate('skafferi'))}
                    >
                      {item.namn}
                    </button>
                    <button type="button" className="semester-row-done" onClick={() => toggleDone(item.id)} title="Åt/använt detta">✓</button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="semester-card-link" onClick={() => onNavigate('skafferi')}>
              → Öppna Skafferiet
            </button>
          </div>
        ) : (
          tonight && (
            <div
              className="glance"
              onClick={() => (tonight.receptSlug ? onOpenRecipe(tonight.receptSlug) : onNavigate('veckan'))}
            >
              {tonightRecipe?.bildUrl ? (
                <img src={tonightRecipe.bildUrl} alt="" />
              ) : (
                <div className="glance-ph">{tonight.recept ? categoryEmoji(tonightRecipe?.kategorier ?? []) : '🍽️'}</div>
              )}
              <div className="glance-body">
                <div className="glance-eye">Ikväll · {DAY_NAMES[tonight.dag] ?? tonight.dag}</div>
                <div className="glance-dish">{tonight.recept ?? tonight.anteckning ?? 'Inget planerat'}</div>
                {tonightRecipe && (
                  <div className="glance-meta">
                    {categoryEmoji(tonightRecipe.kategorier)} {tonightRecipe.tid_min} min
                    {tonightPlan && ` · ${tonightPlan.portions} port.`}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        <button className="hub-primary" onClick={() => onNavigate('veckan')}>
          <span className="hub-primary-icon">🗓️</span>
          <span>
            <div className="hub-primary-title">Veckan</div>
            <div className="hub-primary-sub">Se & planera lunch + middag</div>
          </span>
          <span className="hub-primary-arrow">→</span>
        </button>

        <div className="hub-grid">
          <Tile em="🧺" tn="Skafferi" ts="semesterpool" onClick={() => onNavigate('skafferi')} />
          <Tile em="🏷️" tn="Fynd" ts="veckans erbjudanden" onClick={() => onNavigate('fynd')} />
          <Tile em="🛒" tn="Handla" ts="inköpslista" onClick={() => onNavigate('handla')} />
          <Tile em="📖" tn="Recept" ts={`${recipeIndex.length} st`} onClick={() => onNavigate('recept')} />
          <Tile em="👨‍👧‍👧" tn="Familj" ts="schema & profiler" onClick={() => onNavigate('familj')} />
          <Tile em="🔔" tn="Bevaka" ts="bulk-fynd" onClick={() => onNavigate('bevaka')} />
          <Tile em="📝" tn="Anteckningar" ts="idéer & noteringar" onClick={() => onNavigate('anteckningar')} />
        </div>
      </div>
    </div>
  )
}

function Tile({ em, tn, ts, onClick }: { em: string; tn: string; ts: string; onClick: () => void }) {
  return (
    <button className="hub-tile" onClick={onClick}>
      <span className="hub-tile-em">{em}</span>
      <span>
        <div className="hub-tile-name">{tn}</div>
        <div className="hub-tile-sub">{ts}</div>
      </span>
    </button>
  )
}
