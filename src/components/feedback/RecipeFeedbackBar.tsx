import { useState } from 'react'
import type { Eater } from '../../types'
import type { FeedbackSentiment } from '../../types/feedback'
import { useFeedback } from '../../hooks/useFeedback'
import PersonSentimentPopover from './PersonSentimentPopover'

const SENTIMENT_LABEL: Record<FeedbackSentiment, string> = {
  likes: 'Gillar',
  dislikes: 'Ogillar',
  refuses: 'Vägrar äta',
}

interface Props {
  recipeId: string
  eaters: Eater[]
  variant: 'card' | 'detail'
}

function initials(namn: string): string {
  return namn.charAt(0).toUpperCase()
}

export default function RecipeFeedbackBar({ recipeId, eaters, variant }: Props) {
  const { getFeedback, setPersonSentiment } = useFeedback()
  const [openPersonId, setOpenPersonId] = useState<string | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  const record = getFeedback(recipeId)
  const byPerson = new Map(record?.persons.map(p => [p.personId, p]) ?? [])

  return (
    <div className={`feedback-bar feedback-bar--${variant}`}>
      {eaters.map(eater => {
        const fb = byPerson.get(eater.id)
        const sentiment = fb?.sentiment
        return (
          <div className="feedback-person" key={eater.id}>
            <button
              type="button"
              className={`feedback-avatar${sentiment ? ` feedback-avatar--${sentiment}` : ''}`}
              title={`${eater.namn}${sentiment ? ` — ${SENTIMENT_LABEL[sentiment]}` : ''}`}
              aria-label={`${eater.namn}${sentiment ? ` — ${SENTIMENT_LABEL[sentiment]}` : ', ingen åsikt'}`}
              onClick={e => {
                setAnchorRect(e.currentTarget.getBoundingClientRect())
                setOpenPersonId(openPersonId === eater.id ? null : eater.id)
              }}
            >
              {initials(eater.namn)}
            </button>

            {variant === 'detail' && (
              <div className="feedback-person-detail">
                <span className="feedback-person-name">{eater.namn}</span>
                {sentiment && (
                  <span className={`feedback-person-sentiment feedback-person-sentiment--${sentiment}`}>
                    {SENTIMENT_LABEL[sentiment]}
                  </span>
                )}
                {fb?.note && <span className="feedback-person-note">“{fb.note}”</span>}
              </div>
            )}

            {openPersonId === eater.id && anchorRect && (
              <PersonSentimentPopover
                eater={eater}
                current={fb}
                anchorRect={anchorRect}
                onSet={(s, note) => setPersonSentiment(recipeId, eater.id, s, note)}
                onClose={() => setOpenPersonId(null)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
