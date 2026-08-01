import SlotPicker, { type SlotChipData } from './SlotPicker'

interface Props {
  namn: string
  isOpen: boolean
  onToggleOpen: () => void
  freeSlots: SlotChipData[]
  occupiedSlots: SlotChipData[]
  onPick: (date: string, kind: 'lunch' | 'dinner') => void
  /** Present for a suggestion/search result not yet in the pool ("+ i veckan"); absent for a
   *  row that's already a pool entry (nothing to separately "add"). */
  onAddUnslotted?: () => void
  addedLabel?: string
}

/** Shared trailing controls for every assignable row in Planera (pool rows, search/meal
 *  results, offer-driven suggestions, the recipe browser) — one "→ plats…" trigger for the
 *  inline slot picker (2026-08 redesign, issue #93), so the picker's open/close state and
 *  markup live in exactly one place regardless of which list rendered the row. */
export default function AssignControls({ namn, isOpen, onToggleOpen, freeSlots, occupiedSlots, onPick, onAddUnslotted, addedLabel }: Props) {
  return (
    <div className="plan-assign-controls">
      <div className="plan-assign-buttons">
        {onAddUnslotted && (
          <button type="button" className="mini" onClick={onAddUnslotted}>
            {addedLabel ?? '+ i veckan'}
          </button>
        )}
        <button type="button" className="mini gold" onClick={onToggleOpen}>
          {isOpen ? '✕ Stäng' : '→ plats…'}
        </button>
      </div>
      {isOpen && (
        <SlotPicker
          targetLabel={namn}
          freeSlots={freeSlots}
          occupiedSlots={occupiedSlots}
          onPick={onPick}
          onClose={onToggleOpen}
        />
      )}
    </div>
  )
}
