import { useEffect, useState } from 'react'
import { currentSubscription, pushSupport, subscribe, subscriptionCode } from '../lib/push'

/** Turn on web push for this phone, then show the one-time code to paste into a Claude chat
 * (see CLAUDE.md, "Push notifications"). Lives on the Hantera appen screen. */
export default function NotisSettings() {
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const support = pushSupport()

  useEffect(() => {
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
    <>
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
          <p className="nytt-hint">✓ Notiser är påslagna i den här telefonen.</p>
          <details className="hantera-details">
            <summary>Koppla in telefonen (en gång)</summary>
            <p className="nytt-hint">
              Har du inte gjort det än: kopiera koden och klistra in den i en chatt med Claude, så kopplas
              telefonen in.
            </p>
            <button type="button" className="export-btn synka-download-btn" onClick={copy}>
              {copied ? '✓ Kopierad' : '⧉ Kopiera koden'}
            </button>
            <textarea className="nytt-code" readOnly value={code} onFocus={e => e.currentTarget.select()} />
          </details>
        </>
      )}
      {error && <p className="nytt-hint synka-stat--error">{error}</p>}
    </>
  )
}
