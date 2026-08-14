import { useMemo, useState } from 'react'
import type { Meal, MealComponent } from '../types/meal'
import type { RecipeIndexEntry } from '../types'
import { uniqueMealSlug } from '../lib/mealResolve'
import { useEscapeToClose } from '../hooks/useEscapeToClose'

interface Props {
  /** null = creating a brand-new meal. */
  meal: Meal | null
  /** Prefills the name field when creating (e.g. whatever the user had typed into search). */
  initialName?: string
  recipeIndex: RecipeIndexEntry[]
  existingSlugs: string[]
  onSave: (meal: Meal) => void
  onClose: () => void
}

function splitList(text: string): string[] {
  return text.split(',').map(s => s.trim()).filter(Boolean)
}

/** Add/edit UI for a meals.json entry, opened from Planera's unified search (see CLAUDE.md's
 *  "Meals as the plannable unit" and "Planera redesign" sections). Covers the two things
 *  asked for as the first feature — create a meal, and edit one (rename, add/remove
 *  components, link or unlink a recipe). Saving a new meal here lands it in this week's meal
 *  pool unslotted (see VeckanPlanner's onSave) — the pool row's own "→ plats…" picker, not a
 *  quick-assign shortcut on this modal, is how it gets placed on a day. */
export default function MealEditorModal({
  meal, initialName, recipeIndex, existingSlugs, onSave, onClose,
}: Props) {
  useEscapeToClose(onClose)
  const [namn, setNamn] = useState(meal?.namn ?? initialName ?? '')
  const [aliasText, setAliasText] = useState((meal?.alias ?? []).join(', '))
  const [taggarText, setTaggarText] = useState((meal?.taggar ?? []).join(', '))
  const [tidMin, setTidMin] = useState(meal?.tid_min != null ? String(meal.tid_min) : '')
  const [komponenter, setKomponenter] = useState<MealComponent[]>(meal?.komponenter ?? [])
  const [receptSlug, setReceptSlug] = useState<string | null>(meal?.receptSlug ?? null)
  const [recipeQuery, setRecipeQuery] = useState('')

  const linkedRecipe = receptSlug ? recipeIndex.find(r => r.slug === receptSlug) : undefined

  const recipeResults = useMemo(() => {
    const needle = recipeQuery.trim().toLowerCase()
    if (!needle) return []
    return recipeIndex.filter(r => r.namn.toLowerCase().includes(needle)).slice(0, 6)
  }, [recipeQuery, recipeIndex])

  function updateComponent(i: number, patch: Partial<MealComponent>) {
    setKomponenter(prev => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  }

  function addComponent() {
    setKomponenter(prev => [...prev, { vara: '', alternativ: [], valfri: false }])
  }

  function removeComponent(i: number) {
    setKomponenter(prev => prev.filter((_, idx) => idx !== i))
  }

  function buildMeal(): Meal | null {
    const trimmedNamn = namn.trim()
    if (!trimmedNamn) return null
    const slug = meal?.slug ?? uniqueMealSlug(trimmedNamn, existingSlugs)
    const cleanKomponenter = komponenter
      .map(c => ({ ...c, vara: c.vara.trim() }))
      .filter(c => c.vara.length > 0)
    const tid = tidMin.trim() ? Number(tidMin) : undefined
    return {
      slug,
      namn: trimmedNamn,
      alias: splitList(aliasText),
      komponenter: cleanKomponenter,
      receptSlug,
      taggar: splitList(taggarText),
      ...(tid != null && !Number.isNaN(tid) ? { tid_min: tid } : {}),
    }
  }

  function save() {
    const m = buildMeal()
    if (m) onSave(m)
  }

  return (
    <div className="ingpick-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ingpick-panel mealedit-panel">
        <div className="ingpick-title">{meal ? 'Redigera måltid' : 'Ny måltid'}</div>

        <label className="mealedit-field">
          <span className="mealedit-label">Namn</span>
          <input
            className="mealedit-input"
            type="text"
            value={namn}
            onChange={e => setNamn(e.target.value)}
            placeholder="t.ex. Fisktacos"
            autoFocus
          />
        </label>

        <label className="mealedit-field">
          <span className="mealedit-label">Andra namn (kommaseparerat)</span>
          <input
            className="mealedit-input"
            type="text"
            value={aliasText}
            onChange={e => setAliasText(e.target.value)}
            placeholder="t.ex. tacofredag"
          />
        </label>

        <div className="mealedit-field">
          <span className="mealedit-label">Recept</span>
          {linkedRecipe ? (
            <div className="mealedit-linked-recipe">
              <span>{linkedRecipe.namn}</span>
              <button type="button" className="mealedit-unlink" onClick={() => setReceptSlug(null)}>✕ ta bort</button>
            </div>
          ) : (
            <>
              <input
                className="mealedit-input"
                type="search"
                value={recipeQuery}
                onChange={e => setRecipeQuery(e.target.value)}
                placeholder="Sök recept att koppla…"
              />
              {recipeResults.length > 0 && (
                <div className="mealedit-recipe-results">
                  {recipeResults.map(r => (
                    <button
                      key={r.slug}
                      type="button"
                      className="mealedit-recipe-result"
                      onClick={() => { setReceptSlug(r.slug); setRecipeQuery('') }}
                    >
                      {r.namn}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {!linkedRecipe && (
          <label className="mealedit-field">
            <span className="mealedit-label">Tid (minuter, valfritt)</span>
            <input
              className="mealedit-input"
              type="number"
              min="0"
              value={tidMin}
              onChange={e => setTidMin(e.target.value)}
              placeholder="t.ex. 25"
            />
          </label>
        )}

        <div className="mealedit-field">
          <span className="mealedit-label">Komponenter</span>
          <div className="mealedit-components">
            {komponenter.map((c, i) => (
              <div className="mealedit-component-row" key={i}>
                <input
                  className="mealedit-input mealedit-input--vara"
                  type="text"
                  value={c.vara}
                  onChange={e => updateComponent(i, { vara: e.target.value })}
                  placeholder="t.ex. nötfärsbiff"
                />
                <input
                  className="mealedit-input mealedit-input--alt"
                  type="text"
                  value={c.alternativ.join(', ')}
                  onChange={e => updateComponent(i, { alternativ: splitList(e.target.value) })}
                  placeholder="alternativ, kommaseparerat"
                />
                <label className="mealedit-valfri">
                  <input
                    type="checkbox"
                    checked={!!c.valfri}
                    onChange={e => updateComponent(i, { valfri: e.target.checked })}
                  />
                  valfri
                </label>
                <button type="button" className="mealedit-remove" onClick={() => removeComponent(i)}>✕</button>
              </div>
            ))}
            <button type="button" className="mealedit-add-component" onClick={addComponent}>+ Lägg till komponent</button>
          </div>
        </div>

        <label className="mealedit-field">
          <span className="mealedit-label">Taggar (kommaseparerat)</span>
          <input
            className="mealedit-input"
            type="text"
            value={taggarText}
            onChange={e => setTaggarText(e.target.value)}
            placeholder="t.ex. snabbt, barnvänligt"
          />
        </label>

        <div className="ingpick-actions mealedit-actions">
          <button type="button" className="export-btn" onClick={onClose}>Avbryt</button>
          <button type="button" className="shop-add-btn" onClick={save} disabled={!namn.trim()}>Spara</button>
        </div>
      </div>
    </div>
  )
}
