import type { BudgetSummary } from '../../lib/mealPool'

interface Props {
  summary: BudgetSummary
  /** Suppresses the "X av Y måltider klara" text, keeping just the bar + constraint chips —
   *  used inside the 2026-08 "list-first" redesign's list-card header
   *  (docs/planera-list-first-2026-08.md), where the count already appears once in the
   *  header's own title row (`plan-list-count`) and repeating it here would be redundant. */
  hideLabel?: boolean
}

/** "8 av 14 måltider klara" + unmet-constraint chips — the meal list's own header (2026-08
 *  "list-first" redesign; previously always-visible standalone bar from the #93 redesign).
 *  Budget = non-skipped slots in the rolling window with ≥1 eater present; "Ingen måltid
 *  behövs" per slot is the only way it shrinks. */
export default function BudgetBar({ summary, hideLabel }: Props) {
  const pct = summary.total > 0 ? Math.round((summary.filled / summary.total) * 100) : 0
  return (
    <div className="plan-budget">
      {!hideLabel && (
        <span className="plan-budget-label">
          <strong>{summary.filled} av {summary.total}</strong> måltider klara
        </span>
      )}
      <div className="plan-budget-bar"><i style={{ width: `${pct}%` }} /></div>
      {summary.veganMissing > 0 && (
        <span className="plan-constraint-chip">🌱 {summary.veganMissing} veganska saknas</span>
      )}
      {summary.fastMissing > 0 && (
        <span className="plan-constraint-chip">⚡ {summary.fastMissing} snabba saknas</span>
      )}
      {summary.leftoverPlanned > 0 && (
        <span className="plan-constraint-chip plan-constraint-chip--ok">↩ {summary.leftoverPlanned} rester planerade</span>
      )}
    </div>
  )
}
