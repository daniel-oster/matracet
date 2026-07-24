import { DayMeal, Eater, RecipeIndexEntry } from '../../types'
import type { Meal } from '../../types/meal'
import type { DayPlan } from '../../presence/types'
import { useWeekPlan, applyOverride, effectivePresentIds, diffAttendance } from '../../hooks/useWeekPlan'
import { useFeedback } from '../../hooks/useFeedback'
import { evaluateFit } from '../../lib/dietFit'
import { resolveDayMeal } from '../../lib/mealResolve'
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
  meals: Meal[]
  onOpenRecipe: (slug: string) => void
  onEdit: () => void
}

export default function VeckanOverview({ days, lunches, dayPlans, eaters, recipeIndex, meals, onOpenRecipe, onEdit }: Props) {
  const { getOverride, getAttendance } = useWeekPlan()
  const { getFeedback } = useFeedback()
  const todayDatum = days[0]?.datum

  return (
    <div className="vecka-list">
      {days.map(rawDay => {
        const dinnerAttendance = getAttendance(rawDay.datum, 'dinner')
        const day = applyOverride(rawDay, getOverride(rawDay.datum, 'dinner'), meals, recipeIndex, dinnerAttendance)
        const rawLunch = lunches.find(l => l.datum === rawDay.datum)
        const lunchAttendance = getAttendance(rawDay.datum, 'lunch')
        const lunch = rawLunch ? applyOverride(rawLunch, getOverride(rawDay.datum, 'lunch'), meals, recipeIndex, lunchAttendance) : undefined
        const plan = dayPlans.find(p => p.date === day.datum)
        const dishRecipe = day.receptSlug ? recipeIndex.find(r => r.slug === day.receptSlug) : undefined

        // evaluateFit replaces the old hand-rolled refuses-only check (see CLAUDE.md's
        // Stage 4 note) — recipe: null for the same reason as WeekWarnings: no full Recipe
        // data loaded here, and refusal never needed it.
        const dayMeal = resolveDayMeal(day, meals)
        // Feedback is keyed by meal, not recipe (Stage 5) — dayMeal.slug either way.
        const record = dayMeal ? getFeedback(dayMeal.slug) : null
        const isExcluded = record?.excludeFromWeekPlan ?? false
        const planPresentIds = plan?.presentPersons.map(p => p.id) ?? null
        const presentIds = effectivePresentIds(planPresentIds, dinnerAttendance)
        const presentEaters = presentIds ? eaters.filter(e => presentIds.includes(e.id)) : eaters
        const conflicts = dayMeal ? evaluateFit(dayMeal, null, presentEaters, record ?? null).conflicts : []
        const { away: dinnerAway, extra: dinnerExtra } = diffAttendance(planPresentIds, dinnerAttendance)

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
              {(isExcluded || conflicts.length > 0 || dinnerAway.length > 0 || dinnerExtra.length > 0) && (
                <div className="day-flags">
                  {isExcluded && <span className="day-flag day-flag--excluded">Utesluten</span>}
                  {conflicts.map(c => (
                    <span className="day-flag day-flag--refuses" key={`${c.reason}-${c.personId}`}>
                      ⚠️ {eaters.find(e => e.id === c.personId)?.namn ?? c.personId}
                    </span>
                  ))}
                  {dinnerAway.map(id => (
                    <span className="day-flag day-flag--away" key={`away-${id}`}>
                      − {eaters.find(e => e.id === id)?.namn ?? id}
                    </span>
                  ))}
                  {dinnerExtra.map(id => (
                    <span className="day-flag day-flag--extra" key={`extra-${id}`}>
                      + {eaters.find(e => e.id === id)?.namn ?? id}
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

      <WeekWarnings days={days} lunches={lunches} dayPlans={dayPlans} eaters={eaters} recipeIndex={recipeIndex} meals={meals} onOpenRecipe={onOpenRecipe} />

      <div className="hint">Tryck en dag för att redigera i Planera. Tryck bilden för att öppna receptet.</div>
    </div>
  )
}
