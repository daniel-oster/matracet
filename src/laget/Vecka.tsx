import { useState } from 'react'
import type { Period } from '../presence/types'
import { dateLabel, dinnerText } from './format'
import { dayLines } from './summary'
import type { Installningar } from './notiser'
import type { DayView } from './types'
import { hardRefresh } from '../lib/hardRefresh'

// Veckan (seven rows), and the read-mostly screens behind the menu: Schema, Lov och perioder, Notiser.

export function Vecka({ days, onOpenDay }: { days: DayView[]; onOpenDay: (date: string) => void }) {
  return (
    <>
      <h2 className="laget-h">Veckan</h2>
      <p className="laget-sub">Tryck på en dag för hela dagen.</p>
      <ul className="laget-week">
        {days.map(d => {
          const lines = dayLines(d)
          return (
            <li key={d.date}>
              <button className="laget-weekrow" onClick={() => onOpenDay(d.date)}>
                <span className="laget-weekrow-head">
                  <span className="laget-weekrow-date">{dateLabel(d.date)}</span>
                  <span className="laget-weekrow-type">{d.isChildWeek ? 'barnvecka' : 'ej barnvecka'}</span>
                </span>
                {lines.length === 0 ? (
                  <span className="laget-muted">Inget inplanerat</span>
                ) : (
                  lines.map((l, i) => <span key={i} className="laget-weekrow-line">{l}</span>)
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** The coming fortnight, read-only. The custody rules (biweekly parity, anchors, priorities) are
 *  exact but hard to make legible, so they are changed through the text field, not a form. */
export function Schema({ days }: { days: DayView[] }) {
  return (
    <>
      <h2 className="laget-h">Schema</h2>
      <p className="laget-sub">De kommande 14 dagarna. Ändringar görs via textfältet på startsidan.</p>
      <ul className="laget-week">
        {days.map(d => (
          <li key={d.date} className="laget-weekrow laget-weekrow--static">
            <span className="laget-weekrow-head">
              <span className="laget-weekrow-date">{dateLabel(d.date)}</span>
              <span className="laget-weekrow-type">{d.isChildWeek ? 'barnvecka' : 'ej barnvecka'}</span>
            </span>
            <span className="laget-weekrow-line">{d.presence.presentPersons.map(p => p.name).join(', ') || 'ingen hemma'}</span>
            {dinnerText({ ...d, dinner: null }) && <span className="laget-weekrow-line">{dinnerText({ ...d, dinner: null })}</span>}
          </li>
        ))}
      </ul>
    </>
  )
}

export function Perioder({ periods, names }: { periods: Period[]; names: Map<string, string> }) {
  const sorted = [...periods].sort((a, b) => a.from.localeCompare(b.from))
  return (
    <>
      <h2 className="laget-h">Lov och perioder</h2>
      <p className="laget-sub">Terminer och lov. Ändringar görs via textfältet på startsidan.</p>
      {sorted.length === 0 ? (
        <p className="laget-muted">Inga perioder inlagda.</p>
      ) : (
        <ul className="laget-week">
          {sorted.map(p => (
            <li key={p.id} className="laget-weekrow laget-weekrow--static">
              <span className="laget-weekrow-head">
                <span className="laget-weekrow-date">{p.name}</span>
                <span className="laget-weekrow-type">{p.kind === 'lov' ? 'lov' : 'termin'}</span>
              </span>
              <span className="laget-weekrow-line">
                {dateLabel(p.from)} – {p.to ? dateLabel(p.to) : 'tills vidare'}
              </span>
              <span className="laget-weekrow-line">{p.personIds.map(id => names.get(id) ?? id).join(', ')}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export function Notiser({
  settings,
  onSave,
  onOpenKoppling,
}: {
  settings: Installningar
  onSave: (idag: string, imorgon: string) => Promise<string | null>
  onOpenKoppling: () => void
}) {
  const [idag, setIdag] = useState(settings.notiser.idag)
  const [imorgon, setImorgon] = useState(settings.notiser.imorgon)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const err = await onSave(idag, imorgon)
    setBusy(false)
    setMsg(err ? { ok: false, text: err } : { ok: true, text: 'Sparat ✓' })
  }

  return (
    <>
      <h2 className="laget-h">Notiser</h2>
      <section className="laget-card">
        <h3>Tider</h3>
        <label className="laget-field">
          <span>Läget idag</span>
          <input type="time" value={idag} onChange={e => setIdag(e.target.value)} />
        </label>
        <label className="laget-field">
          <span>Läget imorgon</span>
          <input type="time" value={imorgon} onChange={e => setImorgon(e.target.value)} />
        </label>
        <p className="laget-sub">Välj gärna tider som inte ligger på hel timme. En notis kommer inom ungefär en halvtimme efter sin tid.</p>
        <button onClick={() => void save()} disabled={busy}>Spara</button>
        {msg && <p className={`laget-status laget-status--${msg.ok ? 'ok' : 'unauthorized'}`}>{msg.text}</p>}
      </section>
      <button className="laget-link" onClick={onOpenKoppling}>Slå på notiser på den här telefonen →</button>
    </>
  )
}

type MenyView = 'schema' | 'aktiviteter' | 'perioder' | 'notiser' | 'koppling' | 'utseende' | 'natthimmel' | 'vintergatan'

export function Meny({ onGo }: { onGo: (view: MenyView) => void }) {
  const items: { view: MenyView; label: string; sub: string }[] = [
    { view: 'schema', label: 'Schema', sub: 'De kommande 14 dagarna' },
    { view: 'aktiviteter', label: 'Aktiviteter', sub: 'Återkommande, med tider' },
    { view: 'perioder', label: 'Lov och perioder', sub: 'Terminer och lov' },
    { view: 'notiser', label: 'Notiser', sub: 'När Läget hör av sig' },
    { view: 'koppling', label: 'Koppling', sub: 'Token och notiser på telefonen' },
    { view: 'utseende', label: 'Utseende', sub: 'Färgtema för den här telefonen' },
    { view: 'natthimmel', label: 'Natthimlen', sub: 'Stjärnorna över Hermanus just nu' },
    { view: 'vintergatan', label: 'Vintergatan', sub: 'En bild, för skojs skull' },
  ]
  return (
    <>
      <h2 className="laget-h">Meny</h2>
      <ul className="laget-menu">
        {items.map(i => (
          <li key={i.view}>
            <button className="laget-tile" onClick={() => onGo(i.view)}>
              <span className="laget-tile-title">{i.label}</span>
              <span className="laget-tile-sub">{i.sub}</span>
            </button>
          </li>
        ))}
        <li>
          <a className="laget-tile laget-tile--link" href={import.meta.env.BASE_URL}>
            <span className="laget-tile-title">Matracet</span>
            <span className="laget-tile-sub">Veckans mat och inköp</span>
          </a>
        </li>
        <li>
          <button className="laget-tile" onClick={hardRefresh}>
            <span className="laget-tile-title">⟳ Hämta senaste versionen</span>
            <span className="laget-tile-sub">Laddar om appen utan att röra det som sparats</span>
          </button>
        </li>
      </ul>
    </>
  )
}
