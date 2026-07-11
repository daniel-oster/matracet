import { useMemo, useState } from 'react'
import { Eater, RecipeIndexEntry } from '../../types'
import { useFeedback } from '../../hooks/useFeedback'
import { useRecipes } from '../../hooks/useRecipes'
import { useOffers } from '../../hooks/useOffers'
import { useStash, StashKind } from '../../hooks/useStash'
import { useShoppingList } from '../../hooks/useShoppingList'
import { tagOffers } from '../../lib/bevaka'
import { rankSuggestions, SuggestionFilter, SuggestionSort } from '../../lib/suggestions'
import StashPantryPanel from '../StashPantryPanel'
import TopBar from '../TopBar'

const FILTERS: { id: SuggestionFilter; label: string }[] = [
  { id: 'alla', label: 'Alla' },
  { id: 'fynd', label: '🏷 Fynd' },
  { id: 'snabbt', label: '⚡ Snabbt' },
  { id: 'vegansk', label: '🌱 Vegansk' },
]

const SORTS: { id: SuggestionSort; label: string }[] = [
  { id: 'match', label: 'Bäst' },
  { id: 'savings', label: '💰 Besparing' },
  { id: 'favorites', label: '❤ Favoriter' },
  { id: 'fastest', label: '⚡ Snabbast' },
]

const KIND_ICON: Record<StashKind, string> = { dish: '🍽️', stock: '🧺' }

interface Props {
  onBack: () => void
  recipeIndex: RecipeIndexEntry[]
  eaters: Eater[]
  onOpenRecipe: (slug: string) => void
}

export default function SkafferiView({ onBack, recipeIndex, eaters, onOpenRecipe }: Props) {
  const { items, addItem, toggleDone, remove } = useStash()
  const { manualItems, removedIds, markRemoved, restore } = useShoppingList()
  const { getFeedback } = useFeedback()
  const allSlugs = useMemo(() => recipeIndex.map(r => r.slug), [recipeIndex])
  const fullRecipes = useRecipes(allSlugs)
  const { stores } = useOffers()
  const offers = useMemo(() => (stores ? tagOffers(stores) : []), [stores])

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SuggestionFilter>('fynd')
  const [sort, setSort] = useState<SuggestionSort>('savings')

  const activeItems = items.filter(i => !i.done)
  const doneItems = items.filter(i => i.done)
  const activeManualItems = manualItems.filter(m => !removedIds.has(m.id))
  const removedManualItems = manualItems.filter(m => removedIds.has(m.id))
  const stashedSlugs = new Set(activeItems.map(i => i.receptSlug).filter((s): s is string => !!s))

  const suggestions = rankSuggestions({
    recipeIndex, fullRecipes, query, filter, sort, eaters,
    presentPersonIds: null,
    offers, getFeedback,
  })

  function toggleRecipeInPool(entry: { namn: string; slug: string }) {
    if (stashedSlugs.has(entry.slug)) {
      const existing = activeItems.find(i => i.receptSlug === entry.slug)
      if (existing) remove(existing.id)
    } else {
      addItem(entry.namn, 'dish', entry.slug, [], null)
    }
  }

  return (
    <div className="screen">
      <TopBar
        onBack={onBack}
        eyebrow="Semesterläge"
        title="Skafferi"
        right={activeItems.length > 0 ? `${activeItems.length} i skafferiet` : undefined}
      />
      <div className="screen-body">
        <StashPantryPanel recipeIndex={recipeIndex} fullRecipes={fullRecipes} onOpenRecipe={onOpenRecipe} />

        <section className="stash-shoplist">
          <h3 className="shop-group-title">Inköpslistan</h3>
          {activeManualItems.length === 0 && (
            <div className="fynd-empty">Inget på inköpslistan än — plocka fynd nedan eller lägg till för hand.</div>
          )}
          <div className="shop-group shop-group--compact">
            {activeManualItems.map(m => (
              <div className="shop-row shop-row--compact" key={m.id} onClick={() => markRemoved(m.id)}>
                <span className="box" />
                {m.vara}
              </div>
            ))}
          </div>
          {removedManualItems.length > 0 && (
            <div className="shop-group shop-group--compact">
              {removedManualItems.map(m => (
                <div className="shop-row shop-row--compact done" key={m.id} onClick={() => restore(m.id)}>
                  <span className="box" />
                  {m.vara}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="stash-suggest">
          <h3 className="shop-group-title">Fler förslag (receptboken)</h3>
          <div className="sugg-controls">
            <div className="sugg-filters">
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  className={`tray-fbtn${filter === f.id ? ' on' : ''}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="sugg-sorts">
              {SORTS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className={`sugg-sortbtn${sort === s.id ? ' on' : ''}`}
                  onClick={() => setSort(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <input
              className="tray-search"
              type="search"
              placeholder="Sök recept…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="sugg-list">
            {suggestions.map(s => {
              const inPool = stashedSlugs.has(s.entry.slug)
              return (
                <div key={s.entry.slug} className={`sugg-card${s.excluded ? ' excluded' : ''}`}>
                  {s.entry.bildUrl
                    ? <img className="sugg-card-img" src={s.entry.bildUrl} alt="" />
                    : <div className="sugg-card-img sugg-card-img--empty" />}
                  <div className="sugg-card-body">
                    <button type="button" className="sugg-card-name" onClick={() => onOpenRecipe(s.entry.slug)}>
                      {s.entry.namn}
                    </button>
                    <div className="sugg-card-tags">
                      {s.tags.map((t, i) => <span key={i} className={`tray-tag tray-tag--${t.kind}`}>{t.text}</span>)}
                    </div>
                  </div>
                  <div className="sugg-card-assign">
                    <button
                      type="button"
                      className={`sugg-assign${inPool ? ' on' : ''}`}
                      onClick={() => toggleRecipeInPool(s.entry)}
                    >
                      {inPool ? '✓ I skafferiet' : '+ Skafferi'}
                    </button>
                  </div>
                </div>
              )
            })}
            {suggestions.length === 0 && <div className="tray-empty">Inga recept matchar.</div>}
          </div>
        </section>

        {doneItems.length > 0 && (
          <section className="stash-done-section">
            <h3 className="shop-group-title">Avklarat</h3>
            <div className="stash-list">
              {doneItems.map(item => (
                <div className="stash-chip stash-chip--done" key={item.id}>
                  <span className="stash-chip-kind">{KIND_ICON[item.kind]}</span>
                  <span className="stash-chip-name">{item.namn}</span>
                  <button type="button" className="stash-chip-btn stash-chip-btn--restore" onClick={() => toggleDone(item.id)} title="Tillbaka till skafferiet">↺</button>
                  <button type="button" className="stash-chip-btn stash-chip-btn--remove" onClick={() => remove(item.id)} title="Ta bort">✕</button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
