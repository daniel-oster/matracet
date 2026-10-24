import { useEffect, useState } from 'react'
import type { ScreenName } from '../../types'
import { fetchData } from '../../lib/dataFetch'
import { currentSubscription, pushSupport, subscribe, subscriptionCode } from '../../lib/push'
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
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const support = pushSupport()

  useEffect(() => {
    fetchData(`${import.meta.env.BASE_URL}data/nyheter.json`)
      .then(r => (r.ok ? r.json() : { nyheter: [] }))
      .then((d: { nyheter: Nyhet[] }) => setNyheter([...d.nyheter].sort((a, b) => b.datum.localeCompare(a.datum))))
      .catch(() => setNyheter([]))
    currentSubscription().then(sub => sub && setCode(subscriptionCode(sub))).catch(() => {})
  }, [])

  async function enable() {
    setBusy(true)
    setError(null)
    try {
      setCode(subscriptionCode(await subscribe()))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      setError('Kunde inte kopiera – markera texten nedan och kopiera den för hand.')
    }
  }

  return (
    <div className="screen">
      <TopBar onBack={onBack} eyebrow="Uppdateringar" title="Nytt" />
      <div className="screen-body">
        <section className="nytt-notis">
          <div className="nytt-notis-title">🔔 Notiser</div>
          {support === 'not-installed' && (
            <p className="nytt-hint">
              Notiser fungerar bara i appen på hemskärmen. Öppna Matracet i Safari, tryck Dela → Lägg till på
              hemskärmen, och öppna den därifrån.
            </p>
          )}
          {support === 'unsupported' && <p className="nytt-hint">Den här webbläsaren kan inte ta emot notiser.</p>}
          {support === 'ok' && !code && (
            <>
              <p className="nytt-hint">
                Få en notis när veckans erbjudanden kommer, eller när något på bevakningslistan är på extrapris.
              </p>
              <button type="button" className="export-btn synka-download-btn" disabled={busy} onClick={enable}>
                {busy ? 'Slår på…' : 'Slå på notiser'}
              </button>
            </>
          )}
          {support === 'ok' && code && (
            <>
              <p className="nytt-hint">
                Notiser är påslagna i den här telefonen. Sista steget, en gång: kopiera koden och klistra in den i en
                chatt med Claude, så kopplas telefonen in.
              </p>
              <button type="button" className="export-btn synka-download-btn" onClick={copy}>
                {copied ? '✓ Kopierad' : '⧉ Kopiera koden'}
              </button>
              <textarea className="nytt-code" readOnly value={code} onFocus={e => e.currentTarget.select()} />
            </>
          )}
          {error && <p className="nytt-hint synka-stat--error">{error}</p>}
        </section>

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
