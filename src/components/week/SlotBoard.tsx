import type { MealKind } from '../../types'

export interface BoardCell {
  date: string
  kind: MealKind
  label: string | null
  skip: boolean
  isLeftover: boolean
  glyphs: string[]
}

export interface BoardDayRow {
  date: string
  dayLabel: string
  dateNum: number
  lunch: BoardCell
  dinner: BoardCell
}

interface Props {
  rows: BoardDayRow[]
  /** 'strip' = compact pills (portrait default, read-only overview). 'grid' = the full 7×2
   *  table — sticky in landscape, or shown inline in portrait once expanded. */
  variant: 'strip' | 'grid'
  selected?: { date: string; kind: MealKind } | null
  onSelectCell?: (date: string, kind: MealKind) => void
}

/** The week's slot board (2026-08 Planera redesign, issue #93) — a read-only overview in the
 *  sense that assignment never starts here (that's the pool rows' "→ plats…" picker); tapping
 *  an occupied cell opens its detail panel (attendance/fast/skip/component swaps) via
 *  onSelectCell, same information the old "active day" editor showed, just triggered from
 *  the board instead of a day-strip selection driving the whole screen. */
export default function SlotBoard({ rows, variant, selected, onSelectCell }: Props) {
  if (variant === 'strip') {
    return (
      <div className="plan-day-strip">
        {rows.map(r => (
          <div key={r.date} className="plan-day-pill">
            <span className="plan-day-pill-w">{r.dayLabel} {r.dateNum}</span>
            <span className="plan-day-pill-dots">
              <span className={`plan-day-dot${r.lunch.label ? ' filled' : ''}`} title="Lunch">
                {r.lunch.glyphs[0] ?? (r.lunch.label ? '●' : '○')}
              </span>
              <span className={`plan-day-dot${r.dinner.label ? ' filled' : ''}`} title="Middag">
                {r.dinner.glyphs[0] ?? (r.dinner.label ? '●' : '○')}
              </span>
            </span>
          </div>
        ))}
      </div>
    )
  }

  function cell(c: BoardCell) {
    const isSelected = selected?.date === c.date && selected?.kind === c.kind
    const clickable = !!c.label && !c.skip && !!onSelectCell
    const cls = [
      'plan-cell',
      !c.label && !c.skip ? 'plan-cell--empty' : '',
      c.skip ? 'plan-cell--skip' : '',
      c.isLeftover ? 'plan-cell--rester' : '',
      isSelected ? 'plan-cell--active' : '',
    ].filter(Boolean).join(' ')
    const content = (
      <>
        <span className="plan-cell-k">{c.kind === 'lunch' ? '☼' : '☾'}</span>
        <span className="plan-cell-dish">{c.skip ? 'ingen måltid' : c.label ?? 'ledig'}</span>
        {c.glyphs.map(g => <span key={g} className="plan-cell-glyph">{g}</span>)}
      </>
    )
    return clickable ? (
      <button key={c.kind} type="button" className={cls} onClick={() => onSelectCell!(c.date, c.kind)}>
        {content}
      </button>
    ) : (
      <div key={c.kind} className={cls}>{content}</div>
    )
  }

  return (
    <div className="plan-board">
      <h2 className="plan-board-title">Veckans platser</h2>
      {rows.map(r => (
        <div key={r.date} className="plan-board-row">
          <div className="plan-board-day"><strong>{r.dayLabel}</strong>{r.dateNum}</div>
          {cell(r.lunch)}
          {cell(r.dinner)}
        </div>
      ))}
    </div>
  )
}
