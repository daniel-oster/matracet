import { DayMeal, Eater, RecipeIndexEntry } from '../../types'
import type { DayPlan } from '../../presence/types'
import { useWeekPlan, applyOverride } from '../../hooks/useWeekPlan'
import { useFeedback } from '../../hooks/useFeedback'
import WeekWarnings from './WeekWarnings'

const DAY_NAMES: Record<string, string> = {
  mandag: 'Måndag', tisdag: 'Tisdag', onsdag: 'Onsdag',
  torsdag: 'Torsdag', fredag: 'Fredag', lordag: 'Lördag', sondag: 'Söndag',
}
const DAY_SHORT: Record<string, string> = {
  mandag: 'Mån', tisdag: 'Tis', onsdag: 'Ons',
  torsdag: 'Tor', fredag: 'Fre', lordag: 'Lör', sondag: 'Sön',
}

function dateNum(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getUTCDate()
}

interface Props {
  days: DayMeal[]
  lunches: DayMeal[]
  dayPlans: DayPlan[]
  eaters: Eater[]
  recipeIndex: RecipeIndexEntry[]
  onOpenRecipe: (slug: string) => void
  onEdit: () => void
}

export default function VeckanOverview({ days, lunches, dayPlans, eaters, recipeIndex, onOpenRecipe, onEdit }: Props) {
  const { getOverride } = useWeekPlan()
  const { getFeedback } = useFeedback()
  const todayDatum = days[0]?.datum

  return (
    <div className="vecka-list">
      {days.map(rawDay => {
        const day = applyOverride(rawDay, getOverride(rawDay.datum, 'dinner'))
        const rawLunch = lunches.find(l => l.datum === rawDay.datum)
        const lunch = rawLunch ? applyOverride(rawLunch, getOverride(rawDay.datum, 'lunch')) : undefined
        const plan = dayPlans.find(p => p.date === day.datum)
        const dishRecipe = day.receptSlug ? recipeIndex.find(r => r.slug === day.receptSlug) : undefined

        const record = day.receptSlug ? getFeedback(day.receptSlug) : null
        const isExcluded = record?.excludeFromWeekPlan ?? false
        const presentIds = plan?.presentPersons.map(p => p.id) ?? null
        const refusers = record
          ? record.persons.filter(p => p.sentiment === 'refuses' && (!presentIds || presentIds.includes(p.personId)))
          : []

        const lunchLabel = lunch?.recept ?? lunch?.anteckning ?? null
        const dishLabel = day.recept ?? day.anteckning ?? null

        return (
          <div key={day.datum} className={`vcard${day.datum === todayDatum ? ' today' : ''}`} onClick={onEdit}>
            <div className="vcard-date">
              <span className="vcard-dow">{DAY_SHORT[day.dag] ?? day.dag}</span>
              <span className="vcard-num">{dateNum(day.datum)}</span>
            </div>
            <div className="vcard-body">
              <div className="vcard-dayname">{DAY_NAMES[day.dag] ?? day.dag}</div>
              <div className={`vline${lunchLabel ? '' : ' empty'}`}>
                <span className="vline-ic">☼</span>
                <span className="vline-nm">{lunchLabel ?? 'lunch ledig'}</span>
              </div>
              <div className={`vline${dishLabel ? '' : ' empty'}`}>
                <span className="vline-ic">☾</span>
                <span className="vline-nm">{dishLabel ?? 'middag ledig'}</span>
              </div>
              {(isExcluded || refusers.length > 0) && (
                <div className="day-flags">
                  {isExcluded && <span className="day-flag day-flag--excluded">Utesluten</span>}
                  {refusers.map(p => (
                    <span className="day-flag day-flag--refuses" key={p.personId}>
                      ⚠️ {eaters.find(e => e.id === p.personId)?.namn ?? p.personId}
                    </span>
                  ))}
                </div>
              )}
              <div className="vnote">
                {plan && plan.portions > 0 ? `${plan.activeGroup?.name ?? ''} · ${plan.portions} port.` : 'hos mamma'}
                {plan && plan.windowStatus === 'CONFLICT' && ` · ⚠ mat senast ${plan.eatEarlyBy}`}
                {plan && plan.windowStatus === 'BOUNDED' && ` · ↓ senast ${plan.windowEndsBy}`}
              </div>
            </div>
            {day.receptSlug ? (
              <button
                type="button"
                className="vcard-thumb"
                onClick={e => { e.stopPropagation(); onOpenRecipe(day.receptSlug!) }}
              >
                {dishRecipe?.bildUrl ? <img src={dishRecipe.bildUrl} alt="" /> : <span>›</span>}
              </button>
            ) : (
              <div className="vcard-thumb vcard-thumb--empty">＋</div>
            )}
          </div>
        )
      })}

      <WeekWarnings days={days} lunches={lunches} dayPlans={dayPlans} eaters={eaters} onOpenRecipe={onOpenRecipe} />

      <div className="hint">Tryck en dag för att redigera i Planera. Tryck bilden för att öppna receptet.</div>
    </div>
  )
}
