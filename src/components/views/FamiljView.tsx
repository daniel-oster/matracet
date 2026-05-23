import { PageSide, Eater } from '../../types'
import type { DayPlan } from '../../presence/types'

const WEEKDAY_SHORT: Record<number, string> = {
  1: 'Mån', 2: 'Tis', 3: 'Ons', 4: 'Tor', 5: 'Fre', 6: 'Lör', 7: 'Sön',
}

function isoWeekday(isoDate: string): number {
  const d = new Date(isoDate + 'T00:00:00Z')
  const dow = d.getUTCDay()
  return dow === 0 ? 7 : dow
}

function dayLabel(plan: DayPlan): string {
  const wd = isoWeekday(plan.date)
  const num = new Date(plan.date + 'T00:00:00Z').getUTCDate()
  return `${WEEKDAY_SHORT[wd]} ${num}`
}

interface Props {
  side: PageSide
  eaters: Eater[]
  dayPlans: DayPlan[]
}

export default function FamiljView({ side, eaters, dayPlans }: Props) {
  const visibleEaters = side === 'left' ? eaters.slice(0, 2) : eaters.slice(2)

  return (
    <>
      <div className="page-head">
        <div className="title">{side === 'left' ? 'Familjen' : 'Familjen (forts.)'}</div>
        <div className="sub">{side === 'left' ? 'ätarprofiler' : 'närvaro & rutiner'}</div>
      </div>

      {visibleEaters.map(eater => (
        <div className="eater" key={eater.id}>
          <div className="eater-name">{eater.namn}</div>
          <div className="eater-role">{eater.roll}</div>
          <div className="eater-list">
            {eater.halsa && eater.halsa.length > 0 && (
              <><strong>Hälsa:</strong>{' '}
                {eater.halsa.map(h => <span className="tag" key={h}>{h}</span>)}
                <br />
              </>
            )}
            {eater.kost && eater.kost.length > 0 && (
              <><strong>Kost:</strong>{' '}
                {eater.kost.map(k => <span className="tag" key={k}>{k}</span>)}
                <br />
              </>
            )}
            {eater.gillar.length > 0 && (
              <><strong>Gillar:</strong>{' '}
                {eater.gillar.map(g => <span className="tag good" key={g}>{g}</span>)}
              </>
            )}
          </div>
        </div>
      ))}

      {side === 'right' && (
        <div className="eater">
          <div className="eater-name">Veckans närvaro</div>
          <div className="eater-role">vem är hemma</div>
          {dayPlans.length > 0 ? (
            <div className="presence-week">
              {dayPlans.map(plan => (
                <div className="presence-row" key={plan.date}>
                  <span className="presence-day">{dayLabel(plan)}</span>
                  <span className="presence-group">
                    {plan.portions > 0 ? plan.activeGroup?.name ?? '—' : '—'}
                  </span>
                  {plan.windowStatus === 'CONFLICT' && plan.eatEarlyBy && (
                    <span className="presence-window-conflict">⚠ {plan.eatEarlyBy}</span>
                  )}
                  {plan.windowStatus === 'BOUNDED' && plan.windowEndsBy && (
                    <span className="presence-window-bounded">↓ {plan.windowEndsBy}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="eater-list">
              <strong>Måndag–fredag:</strong> max 35 min middagar<br />
              <strong>Fredag:</strong> oftast pizza-utflykt<br />
              <strong>Lördag–söndag:</strong> tid för längre matlagning
            </div>
          )}
        </div>
      )}
    </>
  )
}
