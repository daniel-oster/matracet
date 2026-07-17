import { useEffect, useRef, useState } from 'react'
import { ScreenName, TabName } from '../types'

const NAV_ITEMS: { screen: TabName; emoji: string; label: string }[] = [
  { screen: 'veckan', emoji: '🗓️', label: 'Veckan' },
  { screen: 'skafferi', emoji: '🧺', label: 'Skafferi' },
  { screen: 'fynd', emoji: '🏷️', label: 'Fynd' },
  { screen: 'handla', emoji: '🛒', label: 'Handla' },
  { screen: 'recept', emoji: '📖', label: 'Recept' },
  { screen: 'familj', emoji: '👨‍👧‍👧', label: 'Familj' },
  { screen: 'bevaka', emoji: '🔔', label: 'Bevaka' },
  { screen: 'anteckningar', emoji: '📝', label: 'Anteckningar' },
  { screen: 'historik', emoji: '📜', label: 'Historik' },
  { screen: 'synka', emoji: '🔄', label: 'Synka' },
]

interface Props {
  currentScreen: ScreenName
  hasHistory: boolean
  onBack: () => void
  onHub: () => void
  onNavigate: (screen: ScreenName) => void
}

export default function FloatingNav({ currentScreen, hasHistory, onBack, onHub, onNavigate }: Props) {
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)
  const lastY = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    lastY.current = window.scrollY
    function onScroll() {
      const y = window.scrollY
      const delta = y - lastY.current
      if (delta > 6) {
        setVisible(false)
        setOpen(false)
      } else if (delta < -6) {
        setVisible(true)
      }
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    function onOutside(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onOutside)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onOutside)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Reset when the screen changes underneath the menu (e.g. navigated some other way).
  useEffect(() => { setOpen(false) }, [currentScreen])

  if (!visible) return null

  function go(fn: () => void) {
    fn()
    setOpen(false)
  }

  return (
    <div className={`floating-nav${open ? ' open' : ''}`} ref={rootRef}>
      <button
        className="floating-nav-btn"
        aria-label={open ? 'Stäng meny' : 'Meny'}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {open ? '✕' : '☰'}
      </button>
      {open && (
        <div className="floating-nav-menu" role="menu">
          <button className="floating-nav-item" role="menuitem" onClick={() => go(onBack)} disabled={!hasHistory}>
            <span className="floating-nav-em">‹</span> Föregående
          </button>
          <button className="floating-nav-item" role="menuitem" onClick={() => go(onHub)}>
            <span className="floating-nav-em">🏠</span> Hem
          </button>
          <div className="floating-nav-divider" />
          {NAV_ITEMS.filter(item => item.screen !== currentScreen).map(item => (
            <button
              key={item.screen}
              className="floating-nav-item"
              role="menuitem"
              onClick={() => go(() => onNavigate(item.screen))}
            >
              <span className="floating-nav-em">{item.emoji}</span> {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
