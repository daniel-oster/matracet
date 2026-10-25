import { useEffect, useState } from 'react'
import type { ScreenName } from '../../types'
import { fetchData } from '../../lib/dataFetch'
import { currentSubscription, pushSupport } from '../../lib/push'
import TopBar from '../TopBar'

/** One entry in public/data/nyheter.json, written by scripts/erbjudanden-weekly.mjs. */
export interface Nyhet {
  id: string
  datum: string // ISO timestamp
  titel: string
  rader: string[]
  notis: boolean
  vy?: ScreenName // screen the "Visa" button opens
}

interface Props {
  onBack: () => void
  onNavigate: (screen: ScreenName) => void
}

const VY_LABEL: Partial<Record<ScreenName, string>> = { fynd: 'Fynd', bevaka: 'Bevaka', handla: 'Handla' }

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function NyttView({ onBack, onNavigate }: Props) {
  const [nyheter, setNyheter] = useState<Nyhet[] | null>(null)
  // null = still checking. Notification settings live on Hantera appen; here we only nudge
  // when this phone isn't subscribed yet.
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const support = pushSupport()

  useEffect(() => {
    fetchData(`${import.meta.env.BASE_URL}data/nyheter.json`)
      .then(r => (r.ok ? r.json() : { nyheter: [] }))
      .then((d: { nyheter: Nyhet[] }) => setNyheter([...d.nyheter].sort((a, b) => b.datum.localeCompare(a.datum))))
      .catch(() => setNyheter([]))
    currentSubscription().then(sub => setSubscribed(sub !== null)).catch(() => setSubscribed(false))
  }, [])

  return (
    <div className="screen">
      <TopBar onBack={onBack} eyebrow="Uppdateringar" title="Nytt" />
      <div className="screen-body">
        {support !== 'unsupported' && subscribed === false && (
          <button type="button" className="nytt-notis nytt-notis--nudge" onClick={() => onNavigate('hantera')}>
            🔔 Vill du få en notis när det kommer något nytt? Slå på notiser under Hantera appen ›
          </button>
        )}

        {nyheter === null && <div className="fynd-empty">Laddar…</div>}
        {nyheter?.length === 0 && <div className="fynd-empty">Inga uppdateringar ännu.</div>}
        {nyheter?.map(n => (
          <article key={n.id} className="nytt-item">
            <div className="nytt-item-top">
              <span className="nytt-item-title">{n.titel}</span>
              <span className="nytt-item-date">{formatDatum(n.datum)}</span>
            </div>
            <ul className="nytt-rader">
              {n.rader.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            {n.vy && VY_LABEL[n.vy] && (
              <button type="button" className="nytt-goto" onClick={() => onNavigate(n.vy!)}>
                Visa i {VY_LABEL[n.vy]} ›
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
