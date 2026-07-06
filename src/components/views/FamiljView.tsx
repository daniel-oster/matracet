import { useState } from 'react'
import { Eater } from '../../types'
import type { DayPlan, Activity } from '../../presence/types'
import { GROUPS, RULES } from '../../presence/seed'
import { ACTIVITIES } from '../../presence/activities'
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
}

export default function FamiljView({ onBack, eaters, dayPlans }: Props) {
  const [section, setSection] = useState<Section>('profiler')

  return (
    <div className="screen">
      <TopBar onBack={onBack} eyebrow="Vem äter vad" title="Familj" />
      <div className="screen-body familj-grid">
        <SchedulePane dayPlans={dayPlans} />
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

function SchedulePane({ dayPlans }: { dayPlans: DayPlan[] }) {
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
