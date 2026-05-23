import { PageSide, WeekMenu } from '../../types'
import type { DayPlan } from '../../presence/types'

const DAY_NAMES: Record<string, string> = {
  mandag: 'Måndag', tisdag: 'Tisdag', onsdag: 'Onsdag',
  torsdag: 'Torsdag', fredag: 'Fredag', lordag: 'Lördag', sondag: 'Söndag',
}

interface Props {
  side: PageSide
  week: WeekMenu
  dayPlans: DayPlan[]
  onOpenRecipe?: (slug: string) => void
}

export default function VeckanView({ side, week, dayPlans, onOpenRecipe }: Props) {
  const days = side === 'left' ? week.middagar.slice(0, 3) : week.middagar.slice(3)

  const [year, isoWeek] = week.vecka.split('-W')
  const subLeft = `${days[0]?.datum ? new Date(days[0].datum).toLocaleDateString('sv-SE', { month: 'long' }) : ''} ${year} / Vecka ${isoWeek}`
  const subRight = side === 'right' ? `Vecka ${isoWeek} (forts.)` : ''

  return (
    <>
      <div className="page-head">
        <div className="title">{side === 'left' ? subLeft : subRight}</div>
        <div className="sub">{side === 'left' ? 'mån — ons' : 'tor — sön'}</div>
      </div>

      {days.map((day) => {
        const date = new Date(day.datum)
        const dayNum = date.getDate()
        const dayName = DAY_NAMES[day.dag] ?? day.dag
        const plan = dayPlans.find(p => p.date === day.datum)

        return (
          <div className="day-block" key={day.datum}>
            <div className="day-row">
              <span className="day-num">{dayNum}</span>
              <span className="day-name">{dayName}</span>
              {plan && plan.portions > 0 && (
                <span className="day-group">{plan.activeGroup?.name}</span>
              )}
            </div>

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
    </>
  )
}
