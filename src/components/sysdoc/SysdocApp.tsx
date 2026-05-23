import { useState } from 'react'
import RecipeSchemaSection from './RecipeSchemaSection'
import WeekMenuSection from './WeekMenuSection'
import ConventionsSection from './ConventionsSection'
import ProductSection from './ProductSection'
import PresenceSection from './PresenceSection'
import MealsSection from './MealsSection'

type Section = 'produkt' | 'narvaro' | 'matplan' | 'recept' | 'veckomeny' | 'konventioner'

const NAV_PROJEKT: { id: Section; label: string; badge?: string }[] = [
  { id: 'produkt', label: 'Produktbeskrivning' },
]

const NAV_SIDE_A: { id: Section; label: string; badge?: string }[] = [
  { id: 'narvaro', label: 'Närvaro & Vårdnad', badge: 'Side A' },
  { id: 'matplan', label: 'Matplan & Preferenser', badge: 'Side B' },
]

const NAV_DATA: { id: Section; label: string; badge?: string }[] = [
  { id: 'recept',       label: 'Recept-schema',  badge: 'v1.0' },
  { id: 'veckomeny',    label: 'Veckomenyn',      badge: 'JSON' },
  { id: 'konventioner', label: 'Konventioner' },
]

export default function SysdocApp() {
  const [active, setActive] = useState<Section>('produkt')

  function NavLink({ id, label, badge }: { id: Section; label: string; badge?: string }) {
    return (
      <a
        href="#"
        className={`sidebar-link ${active === id ? 'active' : ''}`}
        onClick={e => { e.preventDefault(); setActive(id) }}
      >
        {label}
        {badge && <span className="link-badge">{badge}</span>}
      </a>
    )
  }

  return (
    <div className="sysdoc-layout">
      <header className="sysdoc-header">
        <h1>Matracet <em>· Systemdokumentation</em></h1>
        <a href="/matracet/" className="sysdoc-back">← Tillbaka till appen</a>
      </header>

      <nav className="sysdoc-sidebar">
        <div className="sidebar-section-label">Projekt</div>
        {NAV_PROJEKT.map(n => <NavLink key={n.id} {...n} />)}

        <div className="sidebar-section-label">Side A — Livet</div>
        {NAV_SIDE_A.map(n => <NavLink key={n.id} {...n} />)}

        <div className="sidebar-section-label">Datamodeller</div>
        {NAV_DATA.map(n => <NavLink key={n.id} {...n} />)}
      </nav>

      <main className="sysdoc-main">
        {active === 'produkt'      && <ProductSection />}
        {active === 'narvaro'      && <PresenceSection />}
        {active === 'matplan'      && <MealsSection />}
        {active === 'recept'       && <RecipeSchemaSection />}
        {active === 'veckomeny'    && <WeekMenuSection />}
        {active === 'konventioner' && <ConventionsSection />}
      </main>
    </div>
  )
}
