import { useState } from 'react'
import RecipeSchemaSection from './RecipeSchemaSection'
import WeekMenuSection from './WeekMenuSection'
import ConventionsSection from './ConventionsSection'

type Section = 'recept' | 'veckomeny' | 'konventioner'

const NAV: { id: Section; label: string; badge?: string }[] = [
  { id: 'recept',      label: 'Recept-schema',   badge: 'v1.0' },
  { id: 'veckomeny',   label: 'Veckomenyn',       badge: 'JSON' },
  { id: 'konventioner', label: 'Konventioner' },
]

export default function SysdocApp() {
  const [active, setActive] = useState<Section>('recept')

  return (
    <div className="sysdoc-layout">
      <header className="sysdoc-header">
        <h1>Matracet <em>· Systemdokumentation</em></h1>
        <a href="/matracet/" className="sysdoc-back">← Tillbaka till appen</a>
      </header>

      <nav className="sysdoc-sidebar">
        <div className="sidebar-section-label">Datamodeller</div>
        {NAV.map(n => (
          <a
            key={n.id}
            href="#"
            className={`sidebar-link ${active === n.id ? 'active' : ''}`}
            onClick={e => { e.preventDefault(); setActive(n.id) }}
          >
            {n.label}
            {n.badge && <span className="link-badge">{n.badge}</span>}
          </a>
        ))}
      </nav>

      <main className="sysdoc-main">
        {active === 'recept'       && <RecipeSchemaSection />}
        {active === 'veckomeny'    && <WeekMenuSection />}
        {active === 'konventioner' && <ConventionsSection />}
      </main>
    </div>
  )
}
