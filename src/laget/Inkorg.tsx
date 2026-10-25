import { useState } from 'react'
import { MAX_TEXT, statusLine, type InkorgMeddelande } from './inkorg'

/** The text field under the shield and the answer lines under it. The phone keyboard's microphone is
 *  the speech input — no recogniser is built. */
export default function Inkorg({
  messages,
  onSend,
}: {
  messages: InkorgMeddelande[]
  onSend: (text: string) => Promise<string | null>
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setError(null)
    const err = await onSend(text)
    setBusy(false)
    if (err) setError(err)
    else setText('')
  }

  return (
    <section className="laget-inkorg">
      <div className="laget-inkorg-row">
        <textarea
          rows={2}
          value={text}
          maxLength={MAX_TEXT}
          placeholder="Skriv eller prata in…"
          onChange={e => setText(e.target.value)}
        />
        <button onClick={() => void send()} disabled={busy || !text.trim()}>Skicka</button>
      </div>
      {error && <p className="laget-status laget-status--unauthorized">{error}</p>}
      {messages.length > 0 && (
        <ul className="laget-inkorg-replies">
          {messages.map(m => (
            <li key={m.id} className={`laget-reply laget-reply--${m.status}`}>{statusLine(m)}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
