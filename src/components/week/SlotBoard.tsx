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
  selected?: { date: string; kind: MealKind } | null
  onSelectCell?: (date: string, kind: MealKind) => void
}

/** The week's slot board (2026-08 Planera redesign, issue #93; demoted to a secondary step by
 *  the 2026-08 "list-first" pass, docs/planera-list-first-2026-08.md) — a read-only overview
 *  in the sense that assignment never starts here (that's the pool rows' "→ plats…" picker);
 *  tapping an occupied cell opens its detail panel (attendance/fast/skip/component swaps) via
 *  onSelectCell, same information the old "active day" editor showed, just triggered from the
 *  board instead of a day-strip selection driving the whole screen. The old compact 'strip'
 *  variant (a read-only row of day pills, shown permanently above the list) was removed along
 *  with the list-first pass — the board no longer has a permanently-visible portrait form at
 *  all, only this full grid inside a collapsed-by-default section. */
export default function SlotBoard({ rows, selected, onSelectCell }: Props) {
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
