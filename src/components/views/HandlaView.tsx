import { useRef, useState } from 'react'
import { useShoppingList } from '../../hooks/useShoppingList'
import { STORES } from '../../lib/bevaka'
import { buildShoppingListText, formatShopLine } from '../../lib/shoppingList'
import { groupByAisle } from '../../lib/storeOrder'
import TopBar from '../TopBar'

const STORE_KEYS = Object.keys(STORES)

interface ShopRow {
  id: string
  vara: string
  main: string
  why?: string
  storeKey: string | null
  taggable: boolean
}

interface Props {
  onBack: () => void
}

export default function HandlaView({ onBack }: Props) {
  const { removedIds, manualItems, storeAssignments, markRemoved, restore, addManualItem, cycleStore } = useShoppingList()

  // "Show one store at a time" (null = "Alla"). Items have no store in the data model —
  // they can optionally be tagged (see `taggable` below); untagged ones stay visible in
  // every store's view rather than disappearing.
  const [storeFilter, setStoreFilter] = useState<string | null>(null)
  const storeLabel = storeFilter ? STORES[storeFilter]?.namn : null

  const activeManual = manualItems.filter(m => !removedIds.has(m.id))
  const removedManual = manualItems.filter(m => removedIds.has(m.id))

  // Everything on this list was put here by an explicit user action — typed into "Eget
  // tillägg", confirmed through a recipe's ingredient-picker checklist, or pulled in from
  // Fynd/Bevaka/Skafferi. Nothing is aggregated automatically from the week plan or the
  // watch-list — see CLAUDE.md's "Shopping list is manual-only" note.
  const rows: ShopRow[] = activeManual.map(m => ({
    id: m.id,
    vara: m.vara,
    main: m.amount ? `${m.amount} ${m.vara}` : m.vara,
    why: m.source,
    storeKey: storeAssignments[m.id] ?? null,
    taggable: true,
  }))

  const visibleRows = storeFilter
    ? rows.filter(r => !r.storeKey || r.storeKey === storeFilter)
    : rows

  // "Normal order" aisle grouping (see storeOrder.ts) — a per-store walk order placeholder
  // (every store shares the same sequence today) until real per-store aisle order is configured.
  const rowGroups = groupByAisle(visibleRows, r => r.vara, storeFilter)

  const removedRows: { id: string; main: string; restoreId: string }[] = removedManual.map(m => ({
    id: m.id,
    restoreId: m.id,
    main: m.amount ? `${m.amount} ${m.vara}` : m.vara,
  }))

  const fullText = buildShoppingListText({
    weekLabel: storeLabel ?? 'Din lista',
    lines: rowGroups.flatMap(g => g.items).map(r => formatShopLine(r.main, r.why)),
    removedLabels: removedRows.map(r => r.main),
  })

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
        eyebrow="Manuell lista — lägg till från recept, Bevaka eller Fynd"
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
        {visibleRows.length === 0 && (
          <div className="fynd-empty">
            {storeLabel
              ? `Inget taggat för ${storeLabel} just nu.`
              : 'Listan är tom. Lägg till för hand, eller via ett recept, Bevaka eller Fynd.'}
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
