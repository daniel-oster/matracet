import { useState } from 'react'

export interface SlotChipData {
  date: string
  kind: 'lunch' | 'dinner'
  dayLabel: string
  free: boolean
  occupantLabel?: string
  glyphs: string[]
}

interface Props {
  targetLabel: string
  freeSlots: SlotChipData[]
  occupiedSlots: SlotChipData[]
  onPick: (date: string, kind: 'lunch' | 'dinner') => void
  onClose: () => void
}

/**
 * The inline slot picker (2026-08 Planera redesign, issue #93) — the one assignment
 * mechanism, replacing the old "select a day up top, act below" flow. Opens directly under
 * whichever row triggered it. Free slots first; occupied slots collapsed behind a toggle,
 * since picking one there swaps (the old occupant returns to the pool unslotted — handled
 * by the caller's assign function, this component only reports which slot was picked).
 */
export default function SlotPicker({ targetLabel, freeSlots, occupiedSlots, onPick, onClose }: Props) {
  const [showOccupied, setShowOccupied] = useState(false)
  return (
    <div className="plan-slot-picker">
      <div className="plan-slot-picker-head">
        Välj plats för <strong>{targetLabel}</strong>
        <button type="button" className="plan-slot-picker-close" onClick={onClose}>✕</button>
      </div>
      <div className="plan-slot-grid">
        {freeSlots.map(s => (
          <button
            key={`${s.date}-${s.kind}`}
            type="button"
            className="plan-slot-chip"
            onClick={() => onPick(s.date, s.kind)}
          >
            <span className="plan-slot-chip-k">{s.dayLabel} {s.kind === 'lunch' ? '☼' : '☾'}</span>
            ledig
            {s.glyphs.map(g => <span key={g} className="plan-slot-chip-glyph">{g}</span>)}
          </button>
        ))}
        {freeSlots.length === 0 && <div className="tray-empty">Inga lediga platser den här veckan.</div>}
      </div>
      {occupiedSlots.length > 0 && (
        <>
          <button type="button" className="plan-slot-occ-toggle" onClick={() => setShowOccupied(v => !v)}>
            ⇄ Visa upptagna platser (byte) {showOccupied ? '▾' : '▸'}
          </button>
          {showOccupied && (
            <>
              <div className="plan-slot-grid">
                {occupiedSlots.map(s => (
                  <button
                    key={`${s.date}-${s.kind}`}
                    type="button"
                    className="plan-slot-chip plan-slot-chip--occ"
                    onClick={() => onPick(s.date, s.kind)}
                  >
                    <span className="plan-slot-chip-k">{s.dayLabel} {s.kind === 'lunch' ? '☼' : '☾'}</span>
                    <span className="plan-slot-chip-dish">{s.occupantLabel}</span>⇄
                  </button>
                ))}
              </div>
              <div className="plan-slot-picker-hint">
                Väljer du en upptagen plats byter de: den gamla måltiden blir oplanerad igen.
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
