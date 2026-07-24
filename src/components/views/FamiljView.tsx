import { useState } from 'react'
import { DayMeal, Eater, MealKind, RecipeIndexEntry } from '../../types'
import type { Meal } from '../../types/meal'
import type { DayPlan, Activity } from '../../presence/types'
import { GROUPS, RULES } from '../../presence/seed'
import { ACTIVITIES } from '../../presence/activities'
import { useWeekPlan, applyOverride, diffAttendance } from '../../hooks/useWeekPlan'
import TopBar from '../TopBar'

const DAY_SHORT: Record<number, string> = {
  1: 'Mån', 2: 'Tis', 3: 'Ons', 4: 'Tor', 5: 'Fre', 6: 'Lör', 7: 'Sön',
}

function isoWeekday(iso: string): number {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = d.getUTCDay()
  return dow === 0 ? 7 : dow
}

function shortDayLabel(iso: string): string {
  const wd = isoWeekday(iso)
  const num = new Date(iso + 'T00:00:00Z').getUTCDate()
  return `${DAY_SHORT[wd]} ${num}`
}

function effectiveTime(act: Activity): string | null {
  return act.leaveBy ?? act.arriveBy ?? act.startTime
}

type Section = 'profiler' | 'regler'

interface Props {
  onBack: () => void
  eaters: Eater[]
  dayPlans: DayPlan[]
  rollingDays: DayMeal[]
  rollingLunches: DayMeal[]
  recipeIndex: RecipeIndexEntry[]
  meals: Meal[]
}

export default function FamiljView({ onBack, eaters, dayPlans, rollingDays, rollingLunches, recipeIndex, meals }: Props) {
  const [section, setSection] = useState<Section>('profiler')

  return (
    <div className="screen">
      <TopBar onBack={onBack} eyebrow="Vem äter vad" title="Familj" />
      <div className="screen-body familj-grid">
        <SchedulePane dayPlans={dayPlans} days={rollingDays} lunches={rollingLunches} eaters={eaters} recipeIndex={recipeIndex} meals={meals} />
        <div className="familj-pane">
          <div className="familj-toggle">
            <button
              className={`familj-toggle-btn${section === 'profiler' ? ' familj-toggle-btn--active' : ''}`}
              onClick={() => setSection('profiler')}
            >
              Profiler
            </button>
            <button
              className={`familj-toggle-btn${section === 'regler' ? ' familj-toggle-btn--active' : ''}`}
              onClick={() => setSection('regler')}
            >
              Regler
            </button>
          </div>
          {section === 'profiler' ? <ProfilerSection eaters={eaters} /> : <ReglerSection />}
        </div>
      </div>
    </div>
  )
}

interface SchedulePaneProps {
  dayPlans: DayPlan[]
  days: DayMeal[]
  lunches: DayMeal[]
  eaters: Eater[]
  recipeIndex: RecipeIndexEntry[]
  meals: Meal[]
}

interface AttendanceException {
  key: string
  dateLabel: string
  kind: MealKind
  text: string
}

function collectAttendanceExceptions(
  days: DayMeal[],
  lunches: DayMeal[],
  dayPlans: DayPlan[],
  eaters: Eater[],
  recipeIndex: RecipeIndexEntry[],
  meals: Meal[],
  getAttendance: ReturnType<typeof useWeekPlan>['getAttendance'],
  getOverride: ReturnType<typeof useWeekPlan>['getOverride'],
): AttendanceException[] {
  const eaterName = (id: string) => eaters.find(e => e.id === id)?.namn ?? id
  const exceptions: AttendanceException[] = []

  function collect(raw: DayMeal, kind: MealKind) {
    const attendance = getAttendance(raw.datum, kind)
    if (!attendance) return
    const plan = dayPlans.find(p => p.date === raw.datum)
    const planPresentIds = plan?.presentPersons.map(p => p.id) ?? null
    const day = applyOverride(raw, getOverride(raw.datum, kind), meals, recipeIndex, attendance)
    const dish = day.recept
    const dateLabel = shortDayLabel(raw.datum)

    if (attendance.skip) {
      exceptions.push({ key: `${raw.datum}-${kind}`, dateLabel, kind, text: 'Ingen måltid behövs' })
      return
    }
    const { away, extra } = diffAttendance(planPresentIds, attendance)
    if (away.length === 0 && extra.length === 0) return
    const parts = [
      ...away.map(id => `− ${eaterName(id)}`),
      ...extra.map(id => `+ ${eaterName(id)}`),
    ]
    exceptions.push({
      key: `${raw.datum}-${kind}`,
      dateLabel,
      kind,
      text: `${dish ?? (kind === 'lunch' ? 'Lunch' : 'Middag')}: ${parts.join(', ')}`,
    })
  }

  for (const raw of days) collect(raw, 'dinner')
  for (const raw of lunches) collect(raw, 'lunch')
  return exceptions
}

function SchedulePane({ dayPlans, days, lunches, eaters, recipeIndex, meals }: SchedulePaneProps) {
  const { getAttendance, getOverride } = useWeekPlan()
  const exceptions = collectAttendanceExceptions(days, lunches, dayPlans, eaters, recipeIndex, meals, getAttendance, getOverride)

  return (
    <div className="sched-pane">
      <h3 className="shop-group-title">Schema · närvaro, aktiviteter, matfönster</h3>
      <div className="sched-days">
        {dayPlans.map(plan => {
          const hasGroup = plan.portions > 0
          const timedActs = plan.activitiesToday.filter(a => a.startTime !== null)

          return (
            <div key={plan.date} className={`sched-day${hasGroup ? '' : ' sched-day--away'}`}>
              <div className="sched-day-header">
                <span className="sched-day-label">{shortDayLabel(plan.date)}</span>
                <span className="sched-day-group">
                  {hasGroup ? (plan.activeGroup?.name ?? '—') : 'mamman'}
                </span>
                {hasGroup && plan.windowStatus === 'CONFLICT' && (
                  <span className="sched-win sched-win--conflict">⚠ {plan.eatEarlyBy}</span>
                )}
                {hasGroup && plan.windowStatus === 'BOUNDED' && (
                  <span className="sched-win sched-win--bounded">↓ {plan.windowEndsBy}</span>
                )}
                {hasGroup && plan.windowStatus === 'OPEN' && (
                  <span className="sched-win sched-win--open">öppet</span>
                )}
              </div>
              {hasGroup && timedActs.length > 0 && (
                <div className="sched-acts">
                  {timedActs.map(act => {
                    const t = effectiveTime(act)
                    const initial = act.personId.charAt(0).toUpperCase()
                    return (
                      <span key={act.id} className={`sched-act sched-act--${act.personId}`}>
                        {initial} · {act.label}{t ? ` ${t}` : ''}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {exceptions.length > 0 && (
        <>
          <h3 className="shop-group-title">Undantag denna vecka</h3>
          <div className="sched-exceptions">
            {exceptions.map(ex => (
              <div key={ex.key} className="sched-exception">
                <span className="sched-exception-date">{ex.dateLabel}</span>
                <span className="sched-exception-ic">{ex.kind === 'lunch' ? '☼' : '☾'}</span>
                <span className="sched-exception-text">{ex.text}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ProfilerSection({ eaters }: { eaters: Eater[] }) {
  return (
    <div className="profiler-list">
      {eaters.map(eater => (
        <div key={eater.id} className="profil-card">
          <div className="profil-name">{eater.namn}</div>
          <div className="profil-role">{eater.roll}</div>
          <div className="profil-tags">
            {eater.kost?.map(k => (
              <span key={k} className="profil-tag profil-tag--kost">{k}</span>
            ))}
            {eater.halsa?.map(h => (
              <span key={h} className="profil-tag profil-tag--halsa">{h}</span>
            ))}
            {eater.gillar.map(g => (
              <span key={g} className="profil-tag profil-tag--gillar">{g}</span>
            ))}
            {eater.undviker.map(u => (
              <span key={u} className="profil-tag profil-tag--undviker">{u}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ReglerSection() {
  const byPerson: Record<string, Activity[]> = {}
  for (const act of ACTIVITIES) {
    ;(byPerson[act.personId] ??= []).push(act)
  }

  return (
    <div className="regler-section">
      <div className="regler-label">Grupper</div>
      {GROUPS.map(g => (
        <div key={g.id} className="regler-group">
          <span className="regler-group-name">{g.name}</span>
          <span className="regler-group-members">{g.memberPersonIds.join(' · ')}</span>
        </div>
      ))}

      <div className="regler-label">Närvaro-regler</div>
      {RULES.map(r => {
        const days = r.weekdays.map(wd => DAY_SHORT[wd]).join(', ')
        const cadence = r.cadence === 'BIWEEKLY' ? 'varannan v.' : 'varje v.'
        const handover = r.handoverByWeekday
          ? (Object.values(r.handoverByWeekday).filter(Boolean)[0] as string | undefined)
          : undefined
        return (
          <div key={r.id} className="regler-rule">
            <span className="regler-rule-days">{days}</span>
            <span className="regler-rule-cadence">{cadence}</span>
            {handover && <span className="regler-rule-note">överlämn. {handover}</span>}
          </div>
        )
      })}

      <div className="regler-label">Aktiviteter</div>
      {Object.entries(byPerson).map(([personId, acts]) => {
        const timed = acts.filter(a => a.startTime)
        if (timed.length === 0) return null
        const firstName = personId.charAt(0).toUpperCase() + personId.slice(1)
        return (
          <div key={personId} className="regler-person-acts">
            <span className={`regler-person-name regler-person-name--${personId}`}>
              {firstName}
            </span>
            <span className="regler-acts-list">
              {timed.map(a => {
                const t = effectiveTime(a)
                return `${a.label}${t ? ` (${DAY_SHORT[a.weekday]} ${t})` : ''}`
              }).join(' · ')}
            </span>
          </div>
        )
      })}
    </div>
  )
}
