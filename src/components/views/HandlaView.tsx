import { useMemo, useRef, useState } from 'react'
import { DayMeal } from '../../types'
import { useWeekPlan, applyOverride } from '../../hooks/useWeekPlan'
import { useRecipes } from '../../hooks/useRecipes'
import { usePantry } from '../../hooks/usePantry'
import { useOffers } from '../../hooks/useOffers'
import { useBevakningslista } from '../../hooks/useBevakningslista'
import { useShoppingList } from '../../hooks/useShoppingList'
import { tagOffers, findBevakaHits, describeOffer, CATEGORY_EMOJI, BevakaHit } from '../../lib/bevaka'
import { aggregateIngredients, buildShoppingListText, formatAmount, AggregatedIngredient } from '../../lib/shoppingList'
import TopBar from '../TopBar'

function monthShort(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00Z').toLocaleDateString('sv-SE', { month: 'short' })
}
function dateNum(isoDate: string): number {
  return new Date(isoDate + 'T00:00:00Z').getUTCDate()
}

function weekLabelFor(days: DayMeal[]): string {
  if (days.length === 0) return ''
  const first = days[0]
  const last = days[days.length - 1]
  return `${dateNum(first.datum)}–${dateNum(last.datum)} ${monthShort(last.datum)}`
}

interface Props {
  onBack: () => void
  rollingDays: DayMeal[]
  rollingLunches: DayMeal[]
}

export default function HandlaView({ onBack, rollingDays, rollingLunches }: Props) {
  const { getOverride, getAttendance } = useWeekPlan()
  const overriddenDays = useMemo(
    () => rollingDays.map(d => applyOverride(d, getOverride(d.datum, 'dinner'), getAttendance(d.datum, 'dinner'))),
    [rollingDays, getOverride, getAttendance],
  )
  const overriddenLunches = useMemo(
    () => rollingLunches.map(d => applyOverride(d, getOverride(d.datum, 'lunch'), getAttendance(d.datum, 'lunch'))),
    [rollingLunches, getOverride, getAttendance],
  )
  const allMeals = useMemo(() => [...overriddenDays, ...overriddenLunches], [overriddenDays, overriddenLunches])
  const slugs = useMemo(
    () => allMeals.map(m => m.receptSlug).filter((s): s is string => !!s),
    [allMeals],
  )
  const recipes = useRecipes(slugs)
  const pantry = usePantry()
  const ingredients = useMemo(
    () => aggregateIngredients(allMeals, recipes, pantry),
    [allMeals, recipes, pantry],
  )

  const bevakningslista = useBevakningslista()
  const { stores } = useOffers()
  const bevakaHits = useMemo(() => {
    if (!bevakningslista || !stores) return []
    return findBevakaHits(bevakningslista, tagOffers(stores))
  }, [bevakningslista, stores])

  const { removedIds, manualItems, markRemoved, restore, addManualItem } = useShoppingList()

  const activeIngredients = ingredients.filter(i => !removedIds.has(i.id))
  const removedIngredients = ingredients.filter(i => removedIds.has(i.id))
  const activeHits = bevakaHits.filter(h => !removedIds.has(`bevaka:${h.item.id}`))
  const removedHits = bevakaHits.filter(h => removedIds.has(`bevaka:${h.item.id}`))
  const activeManual = manualItems.filter(m => !removedIds.has(m.id))
  const removedManual = manualItems.filter(m => removedIds.has(m.id))

  const removedLabels = [
    ...removedIngredients.map(i => `${formatAmount(i.mangd, i.enhet)} ${i.vara}`),
    ...removedHits.map(h => h.item.vara),
    ...removedManual.map(m => m.vara),
  ]

  const weekLabel = weekLabelFor(rollingDays)
  const fullText = buildShoppingListText({
    weekLabel,
    ingredients: activeIngredients,
    bevakaHits: activeHits,
    manualItems: activeManual,
    removedLabels,
  })

  const loading = slugs.length > 0 && Object.keys(recipes).length === 0

  const [newItem, setNewItem] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function submitAdd() {
    if (!newItem.trim()) return
    addManualItem(newItem)
    setNewItem('')
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullText)
    } catch {
      const el = textareaRef.current
      if (el) {
        el.select()
        document.execCommand('copy')
      }
    }
    setCopyState('copied')
    setTimeout(() => setCopyState('idle'), 1800)
  }

  return (
    <div className="screen">
      <TopBar
        onBack={onBack}
        eyebrow={`Från veckans måltider · ${weekLabel}`}
        title="Inköpslista"
        right={
          <button type="button" className="export-btn" onClick={handleCopy}>
            {copyState === 'copied' ? '✓ Kopierat' : '⧉ Kopiera lista'}
          </button>
        }
      />
      <div className="screen-body handla-grid">
        <div className="handla-col">
          <h3 className="shop-group-title">Ingredienser</h3>
          {loading && <div className="fynd-empty">Laddar recept…</div>}
          {!loading && ingredients.length === 0 && (
            <div className="fynd-empty">Inga ingredienser att handla — allt är avbockat eller redan hemma.</div>
          )}
          <div className="shop-group">
            {activeIngredients.map(i => (
              <div className="shop-row" key={i.id} onClick={() => markRemoved(i.id)}>
                <span className="box" />
                <span>
                  {formatAmount(i.mangd, i.enhet)} {i.vara}
                  {i.meals.length > 0 && <span className="shop-meal-tag"> ({i.meals.join(', ')})</span>}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="handla-col">
          <h3 className="shop-group-title">Fynd på bevakningslistan</h3>
          {activeHits.length === 0 && <div className="fynd-empty">Inga bevakningsfynd just nu.</div>}
          <div className="shop-group">
            {activeHits.map(h => {
              const best = h.offers[0]
              return (
                <div className="shop-row" key={h.item.id} onClick={() => markRemoved(`bevaka:${h.item.id}`)}>
                  <span className="box" />
                  <span>
                    {CATEGORY_EMOJI[h.item.kategori] ?? '📦'} {h.item.vara}
                    {best && <span className="shop-meal-tag"> ({describeOffer(best)})</span>}
                  </span>
                  {best && <em className="shop-meta">{best.pris_text}</em>}
                </div>
              )
            })}
          </div>

          <h3 className="shop-group-title">Eget tillägg</h3>
          <div className="shop-group">
            {activeManual.length === 0 && <div className="fynd-empty">Inget eget tillagt än.</div>}
            {activeManual.map(m => (
              <div className="shop-row" key={m.id} onClick={() => markRemoved(m.id)}>
                <span className="box" />
                {m.vara}
              </div>
            ))}
            <form
              className="shop-add-form"
              onSubmit={e => { e.preventDefault(); submitAdd() }}
            >
              <input
                type="text"
                className="shop-add-input"
                placeholder="Lägg till vara…"
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
              />
              <button type="submit" className="shop-add-btn">+ Lägg till</button>
            </form>
          </div>
        </div>

        {(removedIngredients.length > 0 || removedHits.length > 0 || removedManual.length > 0) && (
          <div className="shop-group shop-removed handla-removed">
            <h3 className="shop-group-title">Bortmarkerat</h3>
            {removedIngredients.map(i => (
              <div className="shop-row done" key={i.id} onClick={() => restore(i.id)}>
                <span className="box" />
                {formatAmount(i.mangd, i.enhet)} {i.vara}
              </div>
            ))}
            {removedHits.map(h => (
              <div className="shop-row done" key={h.item.id} onClick={() => restore(`bevaka:${h.item.id}`)}>
                <span className="box" />
                {CATEGORY_EMOJI[h.item.kategori] ?? '📦'} {h.item.vara}
              </div>
            ))}
            {removedManual.map(m => (
              <div className="shop-row done" key={m.id} onClick={() => restore(m.id)}>
                <span className="box" />
                {m.vara}
              </div>
            ))}
          </div>
        )}
      </div>

      <textarea
        ref={textareaRef}
        className="visually-hidden"
        readOnly
        value={fullText}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  )
}
