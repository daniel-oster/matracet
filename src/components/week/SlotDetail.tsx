import type { Eater, MealKind } from '../../types'
import type { Meal } from '../../types/meal'
import type { WeekPlanOverride, MealAttendance } from '../../hooks/useWeekPlan'
import type { DietFitResult } from '../../lib/dietFit'
import { rankComponentOptions } from '../../lib/mealResolve'

interface Props {
  kind: MealKind
  dayLabel: string
  label: string | null
  slug: string | null
  meal: Meal | null
  override: WeekPlanOverride | undefined
  attendance: MealAttendance | undefined
  away: string[]
  extra: string[]
  eaters: Eater[]
  activePlanIds: string[]
  fit: DietFitResult | null
  fast: boolean
  haveNames: string[]
  attendanceOpen: boolean
  onOpenRecipe: (slug: string) => void
  onClear: () => void
  onToggleAttendanceOpen: () => void
  onToggleAttendee: (eaterId: string) => void
  onToggleSkip: () => void
  onResetAttendance: () => void
  onSetFast: (value: boolean) => void
  onComponentSwap: (vara: string, chosen: string | null) => void
  onShopComponents: () => void
  onClose: () => void
}

/**
 * Detail/edit panel for one board slot — the old "active day" editor's content (attendance
 * overrides, per-meal skip, component swaps, dietary-fit hints), unchanged in substance, just
 * parameterized so it can open under whichever slot the household taps on the board instead of
 * being permanently pinned to one selected day (2026-08 Planera redesign, issue #93 — the
 * board is a read-only *assignment* surface now, but still the place to fine-tune an already-
 * assigned slot).
 */
export default function SlotDetail({
  kind, dayLabel, label, slug, meal, override, attendance, away, extra, eaters, activePlanIds,
  fit, fast, haveNames, attendanceOpen,
  onOpenRecipe, onClear, onToggleAttendanceOpen, onToggleAttendee, onToggleSkip, onResetAttendance,
  onSetFast, onComponentSwap, onShopComponents, onClose,
}: Props) {
  return (
    <div className="plan-slot-detail">
      <div className="plan-slot-detail-head">
        <span className="plan-slot-detail-day">{dayLabel} · {kind === 'lunch' ? '☼ Lunch' : '☾ Middag'}</span>
        <button type="button" className="plan-slot-picker-close" onClick={onClose}>✕</button>
      </div>
      <div className="active-slot">
        <span className={`active-slot-dish${label ? '' : ' empty'}`}>{attendance?.skip ? 'ingen måltid behövs' : label ?? 'ledig'}</span>
        {slug && <button type="button" className="active-slot-open" onClick={() => onOpenRecipe(slug)}>Recept ›</button>}
        {(override || label) && (
          <button type="button" className="active-slot-clear" onClick={onClear} title="Ta bort från den här platsen">
            ✕ Avboka
          </button>
        )}
        <button
          type="button"
          className={`plan-fast-toggle${fast ? ' on' : ''}`}
          onClick={() => onSetFast(!fast)}
          title="Kort om tid den här dagen"
        >
          ⚡
        </button>
        <button
          type="button"
          className={`active-slot-people${attendance ? ' edited' : ''}${attendanceOpen ? ' on' : ''}`}
          onClick={onToggleAttendanceOpen}
          title="Vem äter?"
        >
          👪
        </button>
      </div>
      {!attendance?.skip && (away.length > 0 || extra.length > 0) && (
        <div className="active-slot-attendance">
          {away.map(id => <span key={`away-${id}`} className="day-flag day-flag--away">− {eaters.find(e => e.id === id)?.namn ?? id}</span>)}
          {extra.map(id => <span key={`extra-${id}`} className="day-flag day-flag--extra">+ {eaters.find(e => e.id === id)?.namn ?? id}</span>)}
        </div>
      )}
      {override && meal && meal.komponenter.length > 0 && (
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
                      onClick={() => onComponentSwap(orig.vara, opt === orig.vara ? null : opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          <button type="button" className="component-shop-btn" onClick={onShopComponents}>
            🛒 Lägg komponenter i inköpslistan
          </button>
        </div>
      )}
      {fit && (fit.conflicts.length > 0 || fit.unknowns.length > 0 || fit.requiredSwaps.length > 0) && (
        <div className="fit-hints">
          {fit.conflicts.map(c => <div className="fit-conflict" key={`${c.reason}-${c.personId}`}>⚠️ {c.detail}</div>)}
          {fit.unknowns.map(u => <div className="fit-unknown" key={`${u.reason}-${u.personId}`}>? {u.detail}</div>)}
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
                      if (orig) onComponentSwap(orig.vara, s.to)
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
      {attendanceOpen && (
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
                  onClick={() => onToggleAttendee(e.id)}
                >
                  {on ? '✓ ' : '— '}{e.namn}
                </button>
              )
            })}
          </div>
          <div className="attendance-actions">
            <button type="button" className={`attendance-skip${attendance?.skip ? ' on' : ''}`} onClick={onToggleSkip}>
              {attendance?.skip ? '✓ Ingen måltid behövs' : 'Ingen måltid behövs'}
            </button>
            {attendance && <button type="button" className="attendance-reset" onClick={onResetAttendance}>Återställ till schema</button>}
            <button type="button" className="attendance-close" onClick={onToggleAttendanceOpen}>Klar</button>
          </div>
        </div>
      )}
    </div>
  )
}
