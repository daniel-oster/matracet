import { useMemo, useRef, useState } from 'react'
import { DayMeal } from '../../types'
import { useWeekPlan, applyOverride } from '../../hooks/useWeekPlan'
import { useRecipes } from '../../hooks/useRecipes'
import { usePantry } from '../../hooks/usePantry'
import { useOffers } from '../../hooks/useOffers'
import { useBevakningslista } from '../../hooks/useBevakningslista'
import { useShoppingList } from '../../hooks/useShoppingList'
import { tagOffers, findBevakaHits, hitsForStore, CATEGORY_EMOJI, STORES } from '../../lib/bevaka'
import { aggregateIngredients, buildShoppingListText, formatAmount, formatShopLine } from '../../lib/shoppingList'
import { groupByAisle } from '../../lib/storeOrder'
import TopBar from '../TopBar'

const STORE_KEYS = Object.keys(STORES)

interface ShopRow {
  id: string
  vara: string
  main: string
  why?: string
  price?: string
  storeKey: string | null
  taggable: boolean
}

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

  const { removedIds, manualItems, storeAssignments, markRemoved, restore, addManualItem, cycleStore } = useShoppingList()

  // "Show one store at a time" (null = "Alla"). Bevaka hits carry a real store from their
  // matched offer, so those filter exactly. Ingredients/manual items have no store in the
  // data model — they can optionally be tagged (see `taggable` below); untagged ones stay
  // visible in every store's view rather than disappearing.
  const [storeFilter, setStoreFilter] = useState<string | null>(null)
  const storeLabel = storeFilter ? STORES[storeFilter]?.namn : null

  const activeIngredients = ingredients.filter(i => !removedIds.has(i.id))
  const removedIngredients = ingredients.filter(i => removedIds.has(i.id))
  const activeHits = bevakaHits.filter(h => !removedIds.has(`bevaka:${h.item.id}`))
  const removedHits = bevakaHits.filter(h => removedIds.has(`bevaka:${h.item.id}`))
  const activeManual = manualItems.filter(m => !removedIds.has(m.id))
  const removedManual = manualItems.filter(m => removedIds.has(m.id))

  const hitsToShow = storeFilter ? hitsForStore(activeHits, storeFilter) : activeHits

  const rows: ShopRow[] = [
    ...activeIngredients.map(i => ({
      id: i.id,
      vara: i.vara,
      main: `${formatAmount(i.mangd, i.enhet)} ${i.vara}`,
      why: i.meals.length > 0 ? i.meals.join(', ') : undefined,
      storeKey: storeAssignments[i.id] ?? null,
      taggable: true,
    })),
    ...hitsToShow.map(h => {
      const best = h.offers[0]
      return {
        id: `bevaka:${h.item.id}`,
        vara: h.item.vara,
        main: `${CATEGORY_EMOJI[h.item.kategori] ?? '📦'} ${h.item.vara}`,
        why: best ? `${STORES[best.store]?.namn ?? best.store} · ${[best.marke, best.storlek].filter(Boolean).join(' · ')}` : undefined,
        price: best?.pris_text,
        storeKey: best?.store ?? null,
        taggable: false,
      }
    }),
    ...activeManual.map(m => ({
      id: m.id,
      vara: m.vara,
      main: m.vara,
      storeKey: storeAssignments[m.id] ?? null,
      taggable: true,
    })),
  ]

  // Bevaka rows are already narrowed to the selected store above; ingredients/manual items
  // only get filtered out once *tagged* to a different store — untagged ones show everywhere.
  const visibleRows = storeFilter
    ? rows.filter(r => !r.taggable || !r.storeKey || r.storeKey === storeFilter)
    : rows

  // "Normal order" aisle grouping (see storeOrder.ts) — a per-store walk order placeholder
  // (every store shares the same sequence today) until real per-store aisle order is configured.
  const rowGroups = groupByAisle(visibleRows, r => r.vara, storeFilter)

  const removedRows: { id: string; main: string; restoreId: string }[] = [
    ...removedIngredients.map(i => ({ id: i.id, restoreId: i.id, main: `${formatAmount(i.mangd, i.enhet)} ${i.vara}` })),
    ...removedHits.map(h => ({ id: `bevaka:${h.item.id}`, restoreId: `bevaka:${h.item.id}`, main: `${CATEGORY_EMOJI[h.item.kategori] ?? '📦'} ${h.item.vara}` })),
    ...removedManual.map(m => ({ id: m.id, restoreId: m.id, main: m.vara })),
  ]

  const weekLabel = weekLabelFor(rollingDays)
  const fullText = buildShoppingListText({
    weekLabel: storeLabel ? `${weekLabel} · ${storeLabel}` : weekLabel,
    lines: rowGroups.flatMap(g => g.items).map(r => formatShopLine(r.main, r.why, r.price)),
    removedLabels: removedRows.map(r => r.main),
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
      <div className="handla-storebar-wrap">
        <div className="handla-storebar">
          <button
            type="button"
            className={`fynd-chip${storeFilter === null ? ' on' : ''}`}
            onClick={() => setStoreFilter(null)}
          >
            Alla
          </button>
          {STORE_KEYS.map(key => (
            <button
              key={key}
              type="button"
              className={`fynd-chip ${STORES[key].klass}${storeFilter === key ? ' on' : ''}`}
              onClick={() => setStoreFilter(key)}
            >
              {STORES[key].namn}
            </button>
          ))}
        </div>
      </div>
      <div className="screen-body handla-list">
        {loading && <div className="fynd-empty">Laddar recept…</div>}
        {!loading && visibleRows.length === 0 && (
          <div className="fynd-empty">
            {storeLabel ? `Inget att handla på ${storeLabel} just nu.` : 'Listan är tom — allt är avbockat eller redan hemma.'}
          </div>
        )}
        {rowGroups.map(g => (
          <div className="shop-group" key={g.id}>
            <h4 className="shop-aisle-header">{g.label}</h4>
            {g.items.map(row => (
              <div className="shop-row" key={row.id} onClick={() => markRemoved(row.id)}>
                <span className="box" />
                <span>
                  {row.main}
                  {row.why && <span className="shop-meal-tag"> ({row.why})</span>}
                </span>
                {row.price && <em className="shop-meta">{row.price}</em>}
                {row.taggable && (
                  <button
                    type="button"
                    className={`shop-store-tag${row.storeKey ? ` ${STORES[row.storeKey]?.klass}` : ''}`}
                    onClick={e => { e.stopPropagation(); cycleStore(row.id, STORE_KEYS) }}
                    title="Koppla till en specifik butik"
                  >
                    {row.storeKey ? STORES[row.storeKey]?.namn : '+ Butik'}
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}

        <div className="shop-group">
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

        {removedRows.length > 0 && (
          <div className="shop-group shop-removed">
            <h3 className="shop-group-title">Bortmarkerat</h3>
            {removedRows.map(r => (
              <div className="shop-row done" key={r.id} onClick={() => restore(r.restoreId)}>
                <span className="box" />
                {r.main}
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
