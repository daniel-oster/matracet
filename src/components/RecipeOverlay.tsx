import { useState, useEffect, useRef } from 'react'
import { Recipe } from '../types'

interface WakeLockSentinel {
  release(): Promise<void>
  addEventListener(type: 'release', fn: () => void): void
}

interface Props {
  slug: string
  onClose: () => void
}

export default function RecipeOverlay({ slug, onClose }: Props) {
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    setLoading(true)
    setRecipe(null)
    fetch(`/matracet/data/recipes/${slug}/recept.json`)
      .then(r => r.json())
      .then((data: Recipe) => { setRecipe(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    return () => { wakeLockRef.current?.release() }
  }, [])

  // Dismiss on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function toggleWakeLock() {
    const wl = (navigator as Navigator & { wakeLock?: { request(t: string): Promise<WakeLockSentinel> } }).wakeLock
    if (!wl) return
    if (wakeLockActive) {
      await wakeLockRef.current?.release()
      wakeLockRef.current = null
      setWakeLockActive(false)
    } else {
      try {
        const sentinel = await wl.request('screen')
        wakeLockRef.current = sentinel
        setWakeLockActive(true)
        sentinel.addEventListener('release', () => {
          setWakeLockActive(false)
          wakeLockRef.current = null
        })
      } catch {
        // unsupported or permission denied
      }
    }
  }

  const supportsWakeLock = 'wakeLock' in navigator

  const main: Recipe['ingredienser'] = []
  const groups: Record<string, Recipe['ingredienser']> = {}
  recipe?.ingredienser.forEach(ing => {
    if (ing.grupp) {
      groups[ing.grupp] ??= []
      groups[ing.grupp].push(ing)
    } else {
      main.push(ing)
    }
  })

  return (
    <div
      className="recipe-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="overlay-panel">
        <div className="overlay-toolbar">
          <button className="overlay-close" onClick={onClose} aria-label="Stäng">✕</button>
          <span className="overlay-recipe-title">{recipe?.namn ?? '…'}</span>
          {supportsWakeLock && (
            <button
              className={`overlay-wakelock-btn${wakeLockActive ? ' active' : ''}`}
              onClick={toggleWakeLock}
              title={wakeLockActive ? 'Stäng av skärmljuset' : 'Håll skärmen tänd'}
            >
              {wakeLockActive ? '☀️ Tänd' : '🔅 Håll tänd'}
            </button>
          )}
        </div>

        {recipe?.bildUrl && (
          <div className="overlay-hero">
            <img className="overlay-hero-img" src={recipe.bildUrl} alt={recipe.namn} />
          </div>
        )}

        {loading ? (
          <div className="overlay-loading">Laddar…</div>
        ) : !recipe ? (
          <div className="overlay-loading">Recept kunde inte laddas.</div>
        ) : (
          <div className="overlay-body">
            <div className="overlay-ingredients-col">
              <div className="overlay-section-head">Ingredienser</div>
              <div className="overlay-recipe-meta">{recipe.tid_min} min · {recipe.portioner} port.</div>
              <ul className="overlay-ing-list">
                {main.map((ing, i) => (
                  <li key={i} className="overlay-ing-item">
                    <span className="overlay-ing-amount">{ing.mangd} {ing.enhet}</span>
                    <span className="overlay-ing-name">{ing.vara}</span>
                  </li>
                ))}
                {Object.entries(groups).map(([grupp, items]) => (
                  <li key={grupp} className="overlay-ing-group">
                    <div className="overlay-ing-group-label">{grupp}</div>
                    {items.map((ing, i) => (
                      <div key={i} className="overlay-ing-item">
                        <span className="overlay-ing-amount">{ing.mangd} {ing.enhet}</span>
                        <span className="overlay-ing-name">{ing.vara}</span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </div>

            <div className="overlay-instructions-col">
              <div className="overlay-section-head">Tillagning</div>
              <ol className="overlay-steps">
                {recipe.instruktioner.map((step, i) => (
                  <li key={i} className="overlay-step">{step}</li>
                ))}
              </ol>
              {recipe.servering && recipe.servering.length > 0 && (
                <div className="overlay-serving">
                  <strong>Servering:</strong> {recipe.servering.join(', ')}
                </div>
              )}
              {recipe.tips && (
                <div className="overlay-tips">💡 {recipe.tips}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
