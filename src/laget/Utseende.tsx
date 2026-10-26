import { useSyncExternalStore } from 'react'
import { THEMES, getTheme, setTheme, subscribeTheme, type ThemeId } from './theme'

/** Menu → Utseende: pick a colour theme for this phone. */
export default function Utseende() {
  const current = useSyncExternalStore(subscribeTheme, getTheme)
  const choose = (id: ThemeId) => setTheme(id)
  return (
    <>
      <h2 className="laget-h">Utseende</h2>
      <p className="laget-sub">Gäller bara den här telefonen.</p>
      <ul className="laget-menu">
        {THEMES.map(t => (
          <li key={t.id}>
            <button className={`laget-tile laget-theme${current === t.id ? ' laget-theme--on' : ''}`} onClick={() => choose(t.id)} aria-pressed={current === t.id}>
              <span className="laget-theme-swatch" aria-hidden="true">
                {t.swatch.map(c => <i key={c} style={{ background: c }} />)}
              </span>
              <span className="laget-tile-title">{t.namn}{current === t.id ? ' ✓' : ''}</span>
              <span className="laget-tile-sub">{t.beskrivning}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
