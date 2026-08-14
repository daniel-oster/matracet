import { KATEGORI_OPTIONS, kategoriLabel } from '../lib/categories'
import { CategoryFeedbackEntry } from '../hooks/useCategoryFeedback'
import { useEscapeToClose } from '../hooks/useEscapeToClose'

interface Props {
  namn: string
  currentCategory: string
  existing?: CategoryFeedbackEntry
  onPick: (correctCategory: string) => void
  onClear: () => void
  onClose: () => void
}

/** Long-press-an-offer picker for "this kategori is wrong" — see the Fynd category feedback
 * note in CLAUDE.md. Picking a category just records the correction locally (nothing is
 * changed in the actual offer data here); it's meant to be exported and fed to the
 * sync-category-feedback skill later. */
export default function CategoryFeedbackModal({ namn, currentCategory, existing, onPick, onClear, onClose }: Props) {
  useEscapeToClose(onClose)
  return (
    <div className="ingpick-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ingpick-panel">
        <div className="ingpick-title">Fel kategori?</div>
        <div className="ingpick-sub">
          <strong>{namn}</strong> ligger i <em>{kategoriLabel(currentCategory)}</em>. Välj rätt kategori:
        </div>
        {existing && (
          <div className="catfb-flagged-note">
            Redan flaggad: ska vara <strong>{kategoriLabel(existing.correctCategory)}</strong>.
          </div>
        )}
        <div className="catfb-options">
          {KATEGORI_OPTIONS.map(opt => (
            <button
              key={opt.id}
              type="button"
              className={`catfb-option${opt.id === currentCategory ? ' current' : ''}${existing?.correctCategory === opt.id ? ' picked' : ''}`}
              onClick={() => onPick(opt.id)}
            >
              <span className="catfb-emoji">{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>
        <div className="ingpick-actions">
          {existing && <button type="button" className="export-btn" onClick={onClear}>Ångra flaggning</button>}
          <button type="button" className="export-btn" onClick={onClose}>Stäng</button>
        </div>
      </div>
    </div>
  )
}
