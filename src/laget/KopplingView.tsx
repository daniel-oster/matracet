import { useCallback, useEffect, useState } from 'react'
import { clearToken, getToken, setToken } from '../lib/githubSync'
import { clearPrivateCache, fetchPrivateJson, type PrivateStatus } from '../lib/privateData'
import { LAGET_PUSH, currentSubscription, pushSupport, subscribe } from '../lib/push'
import { saveLagetSubscription } from './subscriptions'

export interface KopplingProps {
  /** Called after the token changed, so the data is reloaded. */
  onChanged: () => void
}

// Connection to the private data (token) and this app's own notification subscription.

const STATUS_TEXT: Record<PrivateStatus | 'loading' | 'none', string> = {
  none: 'Ingen token – klistra in din token för att koppla Läget till datan.',
  loading: 'Kollar kopplingen…',
  ok: 'Kopplad till livet-data ✓',
  unauthorized: 'Token avvisades eller saknar åtkomst till livet-data.',
  'no-token': 'Ingen token.',
  'not-found': 'Kopplingen fungerar men data/schema.json finns inte.',
  network: 'Kunde inte nå GitHub – försök igen.',
}

export default function KopplingView({ onChanged }: KopplingProps) {
  const [token, setTokenState] = useState(() => getToken() ?? '')
  const [saved, setSaved] = useState(() => getToken() !== null)
  const [status, setStatus] = useState<PrivateStatus | 'loading' | 'none'>(saved ? 'loading' : 'none')
  const [pushOn, setPushOn] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)

  const check = useCallback(async () => {
    if (!getToken()) return setStatus('none')
    setStatus('loading')
    setStatus((await fetchPrivateJson('data/schema.json')).status)
  }, [])

  useEffect(() => {
    void check()
    void currentSubscription(LAGET_PUSH).then(s => setPushOn(s !== null))
  }, [check])

  const saveToken = () => {
    if (!token.trim()) return
    setToken(token)
    setSaved(true)
    void check()
    onChanged()
  }
  const removeToken = () => {
    clearToken()
    clearPrivateCache()
    setTokenState('')
    setSaved(false)
    setStatus('none')
    onChanged()
  }

  const enablePush = async () => {
    setPushMsg(null)
    try {
      const sub = await subscribe(LAGET_PUSH)
      const result = await saveLagetSubscription(sub.toJSON())
      if (result === 'ok') setPushOn(true)
      else setPushMsg(result === 'no-token' ? 'Lägg in token först.' : 'Kunde inte spara prenumerationen (' + result + ').')
    } catch (err) {
      setPushMsg(err instanceof Error ? err.message : 'Kunde inte slå på notiser.')
    }
  }

  const support = pushSupport()

  return (
    <>
      <section className="laget-card">
        <h2>Koppling</h2>
        <p className={`laget-status laget-status--${status}`}>{STATUS_TEXT[status]}</p>
        {saved ? (
          <div className="laget-row">
            <button onClick={() => void check()}>Kolla igen</button>
            <button onClick={removeToken}>Ta bort token</button>
          </div>
        ) : (
          <div className="laget-row">
            <input
              type="password"
              autoComplete="off"
              placeholder="GitHub-token"
              value={token}
              onChange={e => setTokenState(e.target.value)}
            />
            <button onClick={saveToken} disabled={!token.trim()}>Spara</button>
          </div>
        )}
      </section>

      <section className="laget-card">
        <h2>Notiser</h2>
        {pushOn ? (
          <p className="laget-status laget-status--ok">Notiser är på för den här appen ✓</p>
        ) : support === 'ok' ? (
          <button onClick={() => void enablePush()} disabled={!saved}>Slå på notiser</button>
        ) : support === 'not-installed' ? (
          <p>Lägg till Läget på hemskärmen och öppna det därifrån för att kunna slå på notiser.</p>
        ) : (
          <p>Den här webbläsaren stöder inte notiser.</p>
        )}
        {pushMsg && <p className="laget-status laget-status--unauthorized">{pushMsg}</p>}
      </section>
    </>
  )
}
