import { useState, useEffect, useRef } from 'react'
import type { Eater } from '../../types'
import type { FeedbackSentiment, PersonRecipeFeedback } from '../../types/feedback'

const SENTIMENT_OPTIONS: { value: FeedbackSentiment; label: string; emoji: string }[] = [
  { value: 'likes', label: 'Gillar', emoji: '🟢' },
  { value: 'dislikes', label: 'Ogillar', emoji: '🟡' },
  { value: 'refuses', label: 'Vägrar äta', emoji: '🔴' },
]

interface Props {
  eater: Eater
  current: PersonRecipeFeedback | undefined
  onSet: (sentiment: FeedbackSentiment | null, note?: string) => void
  onClose: () => void
}

export default function PersonSentimentPopover({ eater, current, onSet, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [note, setNote] = useState(current?.note ?? '')
  const sentiment = current?.sentiment ?? null

  // Close on outside click or Escape.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  function choose(value: FeedbackSentiment) {
    // Toggle off if the same sentiment is clicked again.
    if (value === sentiment) onSet(null)
    else onSet(value, note)
  }

  return (
    <div className="sentiment-popover" ref={ref} role="dialog" aria-label={`Åsikt för ${eater.namn}`}>
      <div className="sentiment-popover-name">{eater.namn}</div>
      <div className="sentiment-popover-options">
        {SENTIMENT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={`sentiment-opt sentiment-opt--${opt.value}${sentiment === opt.value ? ' active' : ''}`}
            onClick={() => choose(opt.value)}
          >
            <span className="sentiment-opt-emoji">{opt.emoji}</span>
            {opt.label}
          </button>
        ))}
      </div>
      <textarea
        className="sentiment-note"
        placeholder={sentiment ? 'Notering (t.ex. "gillar inte löken")' : 'Välj en åsikt först'}
        value={note}
        disabled={!sentiment}
        onChange={e => setNote(e.target.value)}
        onBlur={() => {
          if (sentiment) onSet(sentiment, note)
        }}
        rows={2}
      />
      <div className="sentiment-popover-foot">
        {sentiment && (
          <button type="button" className="sentiment-clear" onClick={() => onSet(null)}>
            Ta bort åsikt
          </button>
        )}
        <button type="button" className="sentiment-done" onClick={onClose}>
          Klar
        </button>
      </div>
    </div>
  )
}
