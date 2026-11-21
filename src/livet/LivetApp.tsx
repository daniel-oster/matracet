import { useState } from 'react'

// Livet: the base page with three shields (docs/livet-plan.md). Läget and Matracet are their own
// apps; the Livet shield lists the settings that are about us. For now those links open the
// existing screens inside Läget and Matracet (?vy=…&fran=livet, so "back" comes home here) —
// nothing has moved yet.

const BASE = import.meta.env.BASE_URL
const LAGET = `${BASE}laget/`

interface Link { label: string; sub: string; href: string }

const LIVET_LINKS: Link[] = [
  { label: 'Familjen', sub: 'Vilka vi är, vem som är hemma', href: `${BASE}?vy=familj&fran=livet` },
  { label: 'Schema', sub: 'De kommande 14 dagarna', href: `${LAGET}?vy=schema&fran=livet` },
  { label: 'Aktiviteter', sub: 'Återkommande, med tider', href: `${LAGET}?vy=aktiviteter&fran=livet` },
  { label: 'Lov och perioder', sub: 'Terminer och lov', href: `${LAGET}?vy=perioder&fran=livet` },
  { label: 'Notiser', sub: 'När Läget hör av sig', href: `${LAGET}?vy=notiser&fran=livet` },
  { label: 'Koppling', sub: 'Token och synk', href: `${BASE}?vy=hantera&fran=livet` },
]

export default function LivetApp() {
  const [open, setOpen] = useState(false)

  if (open) {
    return (
      <main className="livet">
        <button className="livet-back" onClick={() => setOpen(false)}>‹ Hem</button>
        <h1 className="livet-h">Livet</h1>
        <p className="livet-lead">Det som handlar om oss.</p>
        <ul className="livet-links">
          {LIVET_LINKS.map(l => (
            <li key={l.label}>
              <a className="livet-link" href={l.href}>
                <span className="livet-link-title">{l.label}</span>
                <span className="livet-link-sub">{l.sub}</span>
              </a>
            </li>
          ))}
        </ul>
      </main>
    )
  }

  return (
    <main className="livet">
      <h1 className="livet-title">Livet</h1>
      <nav className="livet-shields">
        <a className="livet-shield" href={LAGET}>
          <span className="livet-shield-name">Läget</span>
          <span className="livet-shield-sub">Hur det står till nu</span>
        </a>
        <a className="livet-shield" href={BASE}>
          <span className="livet-shield-name">Matracet</span>
          <span className="livet-shield-sub">Vad vi äter och handlar</span>
        </a>
        <button className="livet-shield" onClick={() => setOpen(true)}>
          <span className="livet-shield-name">Livet</span>
          <span className="livet-shield-sub">Familjen, schema och inställningar</span>
        </button>
      </nav>
    </main>
  )
}
