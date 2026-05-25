import { useState } from 'react'
import { PageSide, Eater } from '../../types'
import type { DayPlan, Activity } from '../../presence/types'
import { GROUPS, RULES } from '../../presence/seed'
import { ACTIVITIES } from '../../presence/activities'

const DAY_LONG: Record<number, string> = {
  1: 'Måndag', 2: 'Tisdag', 3: 'Onsdag', 4: 'Torsdag',
  5: 'Fredag', 6: 'Lördag', 7: 'Söndag',
}
const DAY_SHORT: Record<number, string> = {
  1: 'Mån', 2: 'Tis', 3: 'Ons', 4: 'Tor', 5: 'Fre', 6: 'Lör', 7: 'Sön',
}

function isoWeekday(iso: string): number {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = d.getUTCDay()
  return dow === 0 ? 7 : dow
}

function dateNum(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getUTCDate()
}

function monthShort(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('sv-SE', { month: 'short' })
}

function dateRangeLabel(plans: DayPlan[]): string {
  if (plans.length === 0) return ''
  const first = plans[0]
  const last = plans[plans.length - 1]
  const a = dateNum(first.date)
  const b = dateNum(last.date)
  const mon = monthShort(first.date)
  return `${a}–${b} ${mon}`
}

function effectiveTime(act: Activity): string | null {
  return act.leaveBy ?? act.arriveBy ?? act.startTime
}

type RightView = 'schema' | 'profiler' | 'regler'

interface Props {
  side: PageSide
  eaters: Eater[]
  dayPlans: DayPlan[]
}

export default function FamiljView({ side, eaters, dayPlans }: Props) {
  const [rightView, setRightView] = useState<RightView>('schema')

  const leftDays  = dayPlans.slice(0, 4)
  const rightDays = dayPlans.slice(4)

  if (side === 'left') {
    return (
      <>
        <div className="page-head">
          <div className="title">{dateRangeLabel(leftDays)}</div>
          <div className="sub">{leftDays.map(p => DAY_SHORT[isoWeekday(p.date)]).join(' — ')}</div>
        </div>
        <ScheduleDays plans={leftDays} />
      </>
    )
  }

  const rightTitle = rightView === 'schema'
    ? dateRangeLabel(rightDays)
    : rightView === 'profiler'
      ? 'Familjen'
      : 'Regler'

  return (
    <>
      <div className="page-head">
        <div className="title">{rightTitle}</div>
        <div className="familj-toggle">
          <button
            className={`familj-toggle-btn${rightView === 'schema'  ? ' familj-toggle-btn--active' : ''}`}
            onClick={() => setRightView('schema')}
          >Schema</button>
          <button
            className={`familj-toggle-btn${rightView === 'profiler' ? ' familj-toggle-btn--active' : ''}`}
            onClick={() => setRightView('profiler')}
          >Profiler</button>
          <button
            className={`familj-toggle-btn${rightView === 'regler'  ? ' familj-toggle-btn--active' : ''}`}
            onClick={() => setRightView('regler')}
          >Regler</button>
        </div>
      </div>

      {rightView === 'schema'  && <ScheduleDays plans={rightDays} />}
      {rightView === 'profiler' && <ProfilerSection eaters={eaters} />}
      {rightView === 'regler'  && <ReglerSection />}
    </>
  )
}

// ── Schedule days (Filofax day-block style) ────────────────────────────────

function ScheduleDays({ plans }: { plans: DayPlan[] }) {
  return (
    <>
      {plans.map(plan => {
        const hasGroup  = plan.portions > 0
        const wd        = isoWeekday(plan.date)
        const timedActs = plan.activitiesToday.filter(a => a.startTime !== null)

        return (
          <div key={plan.date} className={`day-block${hasGroup ? '' : ' fam-day--away'}`}>
            <div className="day-row">
              <span className="day-num">{dateNum(plan.date)}</span>
              <span className="day-name">{DAY_LONG[wd]}</span>
              <span className="day-group">
                {hasGroup ? (plan.activeGroup?.name ?? '—') : 'mamman'}
              </span>
            </div>

            {hasGroup && plan.windowStatus !== 'OPEN' && (
              <div className="day-window">
                {plan.windowStatus === 'CONFLICT' && (
                  <span className="day-window-conflict">⚠ mat senast {plan.eatEarlyBy}</span>
                )}
                {plan.windowStatus === 'BOUNDED' && (
                  <span className="day-window-bounded">↓ senast {plan.windowEndsBy}</span>
                )}
              </div>
            )}

            {hasGroup && timedActs.map(act => {
              const t = effectiveTime(act)
              return (
                <div key={act.id} className={`fam-act fam-act--${act.personId}`}>
                  {act.label}{t ? ` · ${t}` : ''}
                </div>
              )
            })}
          </div>
        )
      })}
    </>
  )
}

// ── Profiler ───────────────────────────────────────────────────────────────

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

// ── Regler ─────────────────────────────────────────────────────────────────

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
        const days     = r.weekdays.map(wd => DAY_SHORT[wd]).join(', ')
        const cadence  = r.cadence === 'BIWEEKLY' ? 'varannan v.' : 'varje v.'
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
