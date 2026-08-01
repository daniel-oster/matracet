import type { BudgetSummary } from '../../lib/mealPool'

interface Props {
  summary: BudgetSummary
}

/** "8 av 14 måltider klara" + unmet-constraint chips — always visible at the top of Planera
 *  (2026-08 redesign, issue #93). Budget = non-skipped slots in the rolling window with ≥1
 *  eater present; "Ingen måltid behövs" per slot is the only way it shrinks. */
export default function BudgetBar({ summary }: Props) {
  const pct = summary.total > 0 ? Math.round((summary.filled / summary.total) * 100) : 0
  return (
    <div className="plan-budget">
      <span className="plan-budget-label">
        <strong>{summary.filled} av {summary.total}</strong> måltider klara
      </span>
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
