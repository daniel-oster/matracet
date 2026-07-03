import { PageSide, DayMeal, Eater } from '../../types'
import type { DayPlan } from '../../presence/types'
import { useFeedback } from '../../hooks/useFeedback'
import { useWeekPlan, applyOverride } from '../../hooks/useWeekPlan'
import WeekWarnings from '../week/WeekWarnings'

const DAY_NAMES: Record<string, string> = {
  mandag: 'Måndag', tisdag: 'Tisdag', onsdag: 'Onsdag',
  torsdag: 'Torsdag', fredag: 'Fredag', lordag: 'Lördag', sondag: 'Söndag',
}

const DAY_SHORT: Record<string, string> = {
  mandag: 'mån', tisdag: 'tis', onsdag: 'ons',
  torsdag: 'tor', fredag: 'fre', lordag: 'lör', sondag: 'sön',
}

function formatDateRange(days: DayMeal[]): string {
  if (days.length === 0) return ''
  const first = days[0]
  const last = days[days.length - 1]
  const startName = DAY_SHORT[first.dag] ?? first.dag
  const endName = DAY_SHORT[last.dag] ?? last.dag
  return `${startName} — ${endName}`
}

function dateNum(isoDate: string): number {
  return new Date(isoDate + 'T00:00:00Z').getUTCDate()
}

function monthShort(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00Z').toLocaleDateString('sv-SE', { month: 'short' })
}

interface Props {
  side: PageSide
  days: DayMeal[]
  lunches?: DayMeal[]
  dayPlans: DayPlan[]
  eaters: Eater[]
  onOpenRecipe?: (slug: string) => void
  onReplaceDay?: (date: string) => void
}

export default function VeckanView({ side, days, lunches, dayPlans, eaters, onOpenRecipe, onReplaceDay }: Props) {
  const { getFeedback } = useFeedback()
  const { getOverride } = useWeekPlan()
  const pageDays = side === 'left' ? days.slice(0, 4) : days.slice(4)

  const firstDay = pageDays[0]
  const lastDay = pageDays[pageDays.length - 1]

  let title = ''
  let sub = ''
  if (firstDay) {
    const startNum = dateNum(firstDay.datum)
    const endNum = lastDay ? dateNum(lastDay.datum) : startNum
    const mon = monthShort(firstDay.datum)
    title = side === 'left'
      ? `${startNum}–${endNum} ${mon}`
      : `${startNum}–${endNum} ${mon}`
    sub = formatDateRange(pageDays)
  }

  return (
    <>
      <div className="page-head">
        <div className="title">{title}</div>
        <div className="sub">{sub}</div>
      </div>

      {pageDays.map((rawDay) => {
        const day = applyOverride(rawDay, getOverride(rawDay.datum))
        const num = dateNum(day.datum)
        const dayName = DAY_NAMES[day.dag] ?? day.dag
        const plan = dayPlans.find(p => p.date === day.datum)
        const lunch = lunches?.find(l => l.datum === day.datum)

        const record = day.receptSlug ? getFeedback(day.receptSlug) : null
        const isExcluded = record?.excludeFromWeekPlan ?? false
        const presentIds = plan?.presentPersons.map(p => p.id) ?? null
        const refusers = record
          ? record.persons.filter(
              p => p.sentiment === 'refuses' && (!presentIds || presentIds.includes(p.personId)),
            )
          : []

        return (
          <div className="day-block" key={day.datum}>
            <div className="day-row">
              <span className="day-num">{num}</span>
              <span className="day-name">{dayName}</span>
              {plan && plan.portions > 0 && (
                <span className="day-group">{plan.activeGroup?.name}</span>
              )}
              {onReplaceDay && (
                <button
                  type="button"
                  className="day-replace-btn"
                  title="Ersätt måltid"
                  onClick={() => onReplaceDay(day.datum)}
                >
                  ⇄ Ersätt
                </button>
              )}
            </div>

            {(isExcluded || refusers.length > 0) && (
              <div className="day-flags">
                {isExcluded && <span className="day-flag day-flag--excluded">Utesluten</span>}
                {refusers.map(p => {
                  const namn = eaters.find(e => e.id === p.personId)?.namn ?? p.personId
                  return (
                    <span
                      className="day-flag day-flag--refuses"
                      key={p.personId}
                      title={`${namn} vägrar äta`}
                    >
                      ⚠️ {namn}
                    </span>
                  )
                })}
              </div>
            )}

            {plan && plan.portions > 0 && plan.windowStatus !== 'OPEN' && (
              <div className="day-window">
                {plan.windowStatus === 'CONFLICT' && (
                  <span className="day-window-conflict">⚠ mat senast {plan.eatEarlyBy}</span>
                )}
                {plan.windowStatus === 'BOUNDED' && (
                  <span className="day-window-bounded">↓ senast {plan.windowEndsBy}</span>
                )}
              </div>
            )}

            {lunch && (lunch.recept || lunch.anteckning) && (
              <div className="day-lunch">
                <span className="day-lunch-label">Lunch</span>
                {lunch.receptSlug && onOpenRecipe ? (
                  <button className="day-lunch-link" onClick={() => onOpenRecipe(lunch.receptSlug!)}>
                    {lunch.recept}
                  </button>
                ) : (
                  lunch.recept ?? lunch.anteckning
                )}
              </div>
            )}

            {day.recept ? (
              day.receptSlug && onOpenRecipe ? (
                <button
                  className="day-dish day-dish-linked"
                  onClick={() => onOpenRecipe(day.receptSlug!)}
                >
                  {day.recept}
                  <span className="day-dish-arrow">›</span>
                </button>
              ) : (
                <div className="day-dish">{day.recept}</div>
              )
            ) : day.anteckning ? (
              <div className="day-dish">{day.anteckning}</div>
            ) : null}

            {day.kommentar && (
              <div className="day-comment">{day.kommentar}</div>
            )}
            {day.varianter && Object.entries(day.varianter).map(([who, what]) => (
              <div className="day-meta" key={who}>
                <span className="arrow">→</span> {who}: {what}
              </div>
            ))}
          </div>
        )
      })}

      {side === 'right' && (
        <WeekWarnings days={days} dayPlans={dayPlans} eaters={eaters} onOpenRecipe={onOpenRecipe} />
      )}
    </>
  )
}
