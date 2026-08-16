import { useState, useEffect, useRef } from 'react'
import { Recipe } from '../types'
import IngredientPickerModal from './IngredientPickerModal'
import { currentRecipeUrl } from '../lib/recipeLink'
import { showToast } from '../lib/toastStore'
import { useEscapeToClose } from '../hooks/useEscapeToClose'

interface WakeLockSentinel {
  release(): Promise<void>
  addEventListener(type: 'release', fn: () => void): void
}

interface Props {
  slug: string
  onClose: () => void
}

/** Last-resort clipboard write for browsers/contexts without the async Clipboard API
 *  (same fallback HandlaView's "Kopiera lista" uses, just with a throwaway element). */
function legacyCopy(text: string): boolean {
  const el = document.createElement('textarea')
  el.value = text
  el.setAttribute('readonly', '')
  el.style.position = 'fixed'
  el.style.top = '-1000px'
  el.style.opacity = '0'
  document.body.appendChild(el)
  el.select()
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  document.body.removeChild(el)
  return ok
}

export default function RecipeOverlay({ slug, onClose }: Props) {
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<number | null>(null)
  /** Whether the gesture that produced the current click actually started on the backdrop.
   *  iOS delivers a stray click to whatever sits under a native sheet (print/share) once it
   *  is dismissed — without this, closing the print sheet also closed the whole recipe. */
  const pressedBackdrop = useRef(false)

  useEffect(() => {
    setLoading(true)
    setRecipe(null)
    fetch(`/matracet/data/recipes/${slug}/recept.json`)
      .then(r => r.json())
      .then((data: Recipe) => { setRecipe(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    return () => {
      wakeLockRef.current?.release()
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current)
    }
  }, [])

  useEscapeToClose(onClose)

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
  const canShare = typeof navigator.share === 'function'

  function flagCopied() {
    setCopied(true)
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current)
    copiedTimer.current = window.setTimeout(() => setCopied(false), 1800)
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      flagCopied()
      return
    } catch {
      // Clipboard API missing or blocked (non-secure context, permission) — fall through.
    }
    if (legacyCopy(url)) flagCopied()
    else showToast('Kunde inte kopiera länken.', 'error')
  }

  /** Phone share sheet when the browser has one, plain clipboard copy otherwise. */
  async function shareRecipe() {
    if (!recipe) return
    const url = currentRecipeUrl(slug)
    if (canShare) {
      try {
        await navigator.share({ title: recipe.namn, url })
        return
      } catch (err) {
        // Dismissing the share sheet is a deliberate choice, not a failure — don't
        // "helpfully" copy something the user just decided not to share.
        if ((err as DOMException | undefined)?.name === 'AbortError') return
        // Any other share failure falls through to copying, so the tap still does something.
      }
    }
    await copyLink(url)
  }


  /* "Flera kolumner om det behövs" (print): a landscape page is far wider than one
     readable column of text, but splitting a three-step recipe across two columns just
     looks broken. CSS can't branch on content length, so decide it here from the actual
     instructions — a long method gets two columns and fills the page, a short one stays
     a single column. */
  const instructionWeight = (recipe?.instruktioner ?? []).join(' ').length
  const printCols = recipe && (recipe.instruktioner.length >= 5 || instructionWeight >= 400) ? 2 : 1

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
      onPointerDown={e => { pressedBackdrop.current = e.target === e.currentTarget }}
      onClick={e => {
        if (e.target === e.currentTarget && pressedBackdrop.current) onClose()
        pressedBackdrop.current = false
      }}
    >
      <div className="overlay-panel">
        <div className="overlay-toolbar">
          <button className="overlay-close" onClick={onClose} aria-label="Stäng">✕</button>
          <span className="overlay-recipe-title">{recipe?.namn ?? '…'}</span>
          <div className="overlay-toolbar-actions">
            <button
              type="button"
              className="overlay-print-btn"
              /* Deferred out of the tap handler: calling print() synchronously from a touch
                 gesture is where iOS is most likely to swallow it, and the stray click the
                 native sheet leaves behind must not reach anything else. */
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                window.setTimeout(() => window.print(), 0)
              }}
              disabled={!recipe}
              title="Skriv ut receptet"
              aria-label="Skriv ut receptet"
            >
              🖨
            </button>
            <button
              className={`overlay-share-btn${copied ? ' copied' : ''}`}
              onClick={shareRecipe}
              disabled={!recipe}
              title={canShare ? 'Dela receptet' : 'Kopiera länk till receptet'}
              aria-label={canShare ? 'Dela receptet' : 'Kopiera länk till receptet'}
            >
              {copied ? '✓ Kopierad' : canShare ? '🔗 Dela' : '🔗 Länk'}
            </button>
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
        </div>

        {recipe?.bildUrl && (
          <div className="overlay-hero">
            <img className="overlay-hero-img" src={recipe.bildUrl} alt={recipe.namn} />
          </div>
        )}

        {/* Print-only header: the on-screen toolbar (dark bar, buttons) is dropped when
            printing, so the recipe still needs a name/portions/time line on paper. */}
        {recipe && (
          <div className="overlay-print-head">
            <h1 className="print-title">{recipe.namn}</h1>
            <div className="print-meta">
              {recipe.tid_min} min · {recipe.portioner} portioner
              {recipe.kategorier.length > 0 && ` · ${recipe.kategorier.join(', ')}`}
            </div>
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
              <button type="button" className="overlay-add-shop-btn" onClick={() => setPickerOpen(true)}>
                🛒 Lägg till i inköpslistan
              </button>
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

            <div className="overlay-instructions-col" data-print-cols={printCols}>
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
              {recipe.kalla && (
                <div className="overlay-source">
                  Källa:{' '}
                  {recipe.kallaUrl
                    ? <a href={recipe.kallaUrl} target="_blank" rel="noreferrer noopener">{recipe.kalla}</a>
                    : recipe.kalla}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {pickerOpen && recipe && (
        <IngredientPickerModal recipe={recipe} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  )
}
