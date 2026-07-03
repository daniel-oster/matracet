import { useMemo, useRef, useState } from 'react'
import { PageSide, DayMeal } from '../../types'
import { useWeekPlan, applyOverride } from '../../hooks/useWeekPlan'
import { useRecipes } from '../../hooks/useRecipes'
import { usePantry } from '../../hooks/usePantry'
import { useOffers } from '../../hooks/useOffers'
import { useBevakningslista } from '../../hooks/useBevakningslista'
import { useShoppingList } from '../../hooks/useShoppingList'
import { tagOffers, findBevakaHits, CATEGORY_EMOJI, BevakaHit } from '../../lib/bevaka'
import { aggregateIngredients, buildShoppingListText, formatAmount, AggregatedIngredient } from '../../lib/shoppingList'

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
  side: PageSide
  rollingDays: DayMeal[]
  rollingLunches: DayMeal[]
}

export default function HandlaView({ side, rollingDays, rollingLunches }: Props) {
  const { getOverride } = useWeekPlan()
  // Only dinners can be swapped via the "Ersätt" flow — lunches have no such override.
  const overriddenDays = useMemo(
    () => rollingDays.map(d => applyOverride(d, getOverride(d.datum))),
    [rollingDays, getOverride],
  )
  const allMeals = useMemo(() => [...overriddenDays, ...rollingLunches], [overriddenDays, rollingLunches])
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

  return side === 'left' ? (
    <IngredientsPage
      weekLabel={weekLabel}
      loading={slugs.length > 0 && Object.keys(recipes).length === 0}
      ingredients={activeIngredients}
      removedIngredients={removedIngredients}
      onRemove={i => markRemoved(i.id)}
      onRestore={i => restore(i.id)}
    />
  ) : (
    <ExtrasPage
      hits={activeHits}
      removedHits={removedHits}
      manualItems={activeManual}
      removedManual={removedManual}
      onRemoveHit={h => markRemoved(`bevaka:${h.item.id}`)}
      onRestoreHit={h => restore(`bevaka:${h.item.id}`)}
      onAddManual={addManualItem}
      onRemoveManual={id => markRemoved(id)}
      onRestoreManual={id => restore(id)}
      fullText={fullText}
    />
  )
}

// ─── Left page: aggregated ingredients from this week's meals ─────────────────

function IngredientsPage({
  weekLabel,
  loading,
  ingredients,
  removedIngredients,
  onRemove,
  onRestore,
}: {
  weekLabel: string
  loading: boolean
  ingredients: AggregatedIngredient[]
  removedIngredients: AggregatedIngredient[]
  onRemove: (i: AggregatedIngredient) => void
  onRestore: (i: AggregatedIngredient) => void
}) {
  return (
    <>
      <div className="page-head">
        <div className="title">Inköpslista</div>
        <div className="sub">Från veckans måltider · {weekLabel}</div>
      </div>

      {loading && <div className="fynd-empty">Laddar recept…</div>}
      {!loading && ingredients.length === 0 && (
        <div className="fynd-empty">Inga ingredienser att handla — allt är avbockat eller redan hemma.</div>
      )}

      <div className="shop-group">
        {ingredients.map(i => (
          <div className="shop-row" key={i.id} onClick={() => onRemove(i)}>
            <span className="box" />
            {formatAmount(i.mangd, i.enhet)} {i.vara}
            {i.meals.length > 0 && (
              <em className="shop-meta">för {i.meals.join(', ')}</em>
            )}
          </div>
        ))}
      </div>

      {removedIngredients.length > 0 && (
        <div className="shop-group shop-removed">
          <h3 className="shop-group-title">Bortmarkerat</h3>
          {removedIngredients.map(i => (
            <div className="shop-row done" key={i.id} onClick={() => onRestore(i)}>
              <span className="box" />
              {formatAmount(i.mangd, i.enhet)} {i.vara}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ─── Right page: bevaka bargains, manual additions, copy ──────────────────────

function ExtrasPage({
  hits,
  removedHits,
  manualItems,
  removedManual,
  onRemoveHit,
  onRestoreHit,
  onAddManual,
  onRemoveManual,
  onRestoreManual,
  fullText,
}: {
  hits: BevakaHit[]
  removedHits: BevakaHit[]
  manualItems: ReturnType<typeof useShoppingList>['manualItems']
  removedManual: ReturnType<typeof useShoppingList>['manualItems']
  onRemoveHit: (h: BevakaHit) => void
  onRestoreHit: (h: BevakaHit) => void
  onAddManual: (vara: string) => void
  onRemoveManual: (id: string) => void
  onRestoreManual: (id: string) => void
  fullText: string
}) {
  const [newItem, setNewItem] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function submitAdd() {
    if (!newItem.trim()) return
    onAddManual(newItem)
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
    <>
      <div className="page-head">
        <div>
          <div className="title">Fynd & eget</div>
          <div className="sub">Bevakningsfynd just nu, egna tillägg</div>
        </div>
        <button type="button" className="export-btn" onClick={handleCopy}>
          {copyState === 'copied' ? '✓ Kopierat' : '⧉ Kopiera lista'}
        </button>
      </div>

      <div className="shop-group">
        <h3 className="shop-group-title">Fynd på bevakningslistan</h3>
        {hits.length === 0 && <div className="fynd-empty">Inga bevakningsfynd just nu.</div>}
        {hits.map(h => {
          const best = h.offers[0]
          return (
            <div className="shop-row" key={h.item.id} onClick={() => onRemoveHit(h)}>
              <span className="box" />
              <span>{CATEGORY_EMOJI[h.item.kategori] ?? '📦'} {h.item.vara}</span>
              {best && <em className="shop-meta">{best.pris_text}</em>}
            </div>
          )
        })}
      </div>

      <div className="shop-group">
        <h3 className="shop-group-title">Eget tillägg</h3>
        {manualItems.length === 0 && <div className="fynd-empty">Inget eget tillagt än.</div>}
        {manualItems.map(m => (
          <div className="shop-row" key={m.id} onClick={() => onRemoveManual(m.id)}>
            <span className="box" />
            {m.vara}
          </div>
        ))}
        <form
          className="shop-add-form"
          onSubmit={e => {
            e.preventDefault()
            submitAdd()
          }}
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

      {(removedHits.length > 0 || removedManual.length > 0) && (
        <div className="shop-group shop-removed">
          <h3 className="shop-group-title">Bortmarkerat</h3>
          {removedHits.map(h => (
            <div className="shop-row done" key={h.item.id} onClick={() => onRestoreHit(h)}>
              <span className="box" />
              {CATEGORY_EMOJI[h.item.kategori] ?? '📦'} {h.item.vara}
            </div>
          ))}
          {removedManual.map(m => (
            <div className="shop-row done" key={m.id} onClick={() => onRestoreManual(m.id)}>
              <span className="box" />
              {m.vara}
            </div>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        className="visually-hidden"
        readOnly
        value={fullText}
        aria-hidden="true"
        tabIndex={-1}
      />
    </>
  )
}
