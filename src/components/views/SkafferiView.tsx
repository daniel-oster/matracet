import { useMemo, useState } from 'react'
import { Eater, RecipeIndexEntry } from '../../types'
import { useFeedback } from '../../hooks/useFeedback'
import { useRecipes } from '../../hooks/useRecipes'
import { useOffers } from '../../hooks/useOffers'
import { useStash, StashKind } from '../../hooks/useStash'
import { describeOffer, tagOffers, TaggedOffer } from '../../lib/bevaka'
import { matchPantryRecipes } from '../../lib/pantryMatch'
import { rankSuggestions, parseSavings, SuggestionFilter, SuggestionSort } from '../../lib/suggestions'
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

const IDEA_TAGS = ['🏷 Fynd', '⚡ Snabbt', '🧊 Fryst', '🌱 Vegan', '🔥 Grill']
const KIND_ICON: Record<StashKind, string> = { dish: '🍽️', stock: '🧺' }

function offerKey(o: TaggedOffer, i: number): string {
  return `${o.store}-${o.namn}-${o.storlek ?? ''}-${i}`
}

interface Props {
  onBack: () => void
  recipeIndex: RecipeIndexEntry[]
  eaters: Eater[]
  onOpenRecipe: (slug: string) => void
}

export default function SkafferiView({ onBack, recipeIndex, eaters, onOpenRecipe }: Props) {
  const { items, addItem, toggleDone, remove } = useStash()
  const { getFeedback } = useFeedback()
  const allSlugs = useMemo(() => recipeIndex.map(r => r.slug), [recipeIndex])
  const fullRecipes = useRecipes(allSlugs)
  const { stores } = useOffers()
  const offers = useMemo(() => (stores ? tagOffers(stores) : []), [stores])

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SuggestionFilter>('fynd')
  const [sort, setSort] = useState<SuggestionSort>('savings')

  const [offerQuery, setOfferQuery] = useState('')
  const [addKind, setAddKind] = useState<StashKind>('dish')
  const [ideaName, setIdeaName] = useState('')
  const [ideaNote, setIdeaNote] = useState('')
  const [ideaTags, setIdeaTags] = useState<string[]>([])

  const activeItems = items.filter(i => !i.done)
  const doneItems = items.filter(i => i.done)
  const stashedSlugs = new Set(activeItems.map(i => i.receptSlug).filter((s): s is string => !!s))
  const stashedOfferNames = new Set(activeItems.filter(i => i.kind === 'stock').map(i => i.namn.toLowerCase()))
  const stockNames = activeItems.filter(i => i.kind === 'stock').map(i => i.namn)

  const pantryMatches = useMemo(
    () => matchPantryRecipes(recipeIndex, fullRecipes, stockNames),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipeIndex, fullRecipes, stockNames.join('|')],
  )

  const suggestions = rankSuggestions({
    recipeIndex, fullRecipes, query, filter, sort, eaters,
    presentPersonIds: null,
    offers, getFeedback,
  })

  const rankedOffers = useMemo(() => {
    const needle = offerQuery.trim().toLowerCase()
    return offers
      .filter(o => o.pris != null)
      .filter(o => !needle || o.namn.toLowerCase().includes(needle))
      .sort((a, b) => parseSavings(b.besparing) - parseSavings(a.besparing))
      .slice(0, 40)
  }, [offers, offerQuery])

  function toggleIdeaTag(tag: string) {
    setIdeaTags(t => (t.includes(tag) ? t.filter(x => x !== tag) : [...t, tag]))
  }

  function submitIdea() {
    if (!ideaName.trim()) return
    addItem(ideaName, addKind, null, ideaTags, ideaNote.trim() || null)
    setIdeaName('')
    setIdeaNote('')
    setIdeaTags([])
  }

  function toggleRecipeInPool(entry: { namn: string; slug: string }) {
    if (stashedSlugs.has(entry.slug)) {
      const existing = activeItems.find(i => i.receptSlug === entry.slug)
      if (existing) remove(existing.id)
    } else {
      addItem(entry.namn, 'dish', entry.slug, [], null)
    }
  }

  function toggleOfferInPool(o: TaggedOffer) {
    const key = o.namn.toLowerCase()
    if (stashedOfferNames.has(key)) {
      const existing = activeItems.find(i => i.kind === 'stock' && i.namn.toLowerCase() === key)
      if (existing) remove(existing.id)
    } else {
      const savings = parseSavings(o.besparing)
      addItem(o.namn, 'stock', null, [savings > 0 ? `🏷 spara ${savings}kr` : '🏷 fynd'], `${describeOffer(o)} · ${o.pris_text}`)
    }
  }

  return (
    <div className="screen">
      <TopBar
        onBack={onBack}
        eyebrow="Semesterläge"
        title="Skafferi"
        right={activeItems.length > 0 ? `${activeItems.length} i poolen` : undefined}
      />
      <div className="screen-body">
        <section className="stash-cook">
          <h3 className="shop-group-title">Vad kan vi laga?</h3>
          {pantryMatches.length === 0 && (
            <div className="fynd-empty">
              Inget matchar än — plocka in fynd eller råvaror i skafferiet nedan, så dyker recept upp här.
            </div>
          )}
          <div className="sugg-list">
            {pantryMatches.slice(0, 12).map(m => (
              <div key={m.entry.slug} className="sugg-card">
                {m.entry.bildUrl
                  ? <img className="sugg-card-img" src={m.entry.bildUrl} alt="" />
                  : <div className="sugg-card-img sugg-card-img--empty" />}
                <div className="sugg-card-body">
                  <button type="button" className="sugg-card-name" onClick={() => onOpenRecipe(m.entry.slug)}>
                    {m.entry.namn}
                  </button>
                  <div className="sugg-card-tags">
                    <span className="tray-tag tray-tag--vegan">🧺 {m.matchedNames.join(', ')}</span>
                  </div>
                </div>
                <div className="sugg-card-assign">
                  <button
                    type="button"
                    className={`sugg-assign${stashedSlugs.has(m.entry.slug) ? ' on' : ''}`}
                    onClick={() => toggleRecipeInPool(m.entry)}
                  >
                    {stashedSlugs.has(m.entry.slug) ? '✓ I poolen' : '+ Skafferi'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="stash-pool">
          <h3 className="shop-group-title">Din pool</h3>
          {activeItems.length === 0 && (
            <div className="fynd-empty">
              Skafferiet är tomt — plocka fynd eller lägg till en egen idé nedan.
            </div>
          )}
          <div className="stash-list">
            {activeItems.map(item => (
              <div className="stash-item" key={item.id}>
                <span className="stash-item-kind" title={item.kind === 'stock' ? 'Råvara' : 'Rätt/idé'}>
                  {KIND_ICON[item.kind]}
                </span>
                <div className="stash-item-body">
                  {item.receptSlug ? (
                    <button
                      type="button"
                      className="stash-item-name stash-item-name--link"
                      onClick={() => onOpenRecipe(item.receptSlug!)}
                    >
                      {item.namn}
                    </button>
                  ) : (
                    <div className="stash-item-name">{item.namn}</div>
                  )}
                  {(item.taggar.length > 0 || item.anteckning) && (
                    <div className="stash-item-meta">
                      {item.taggar.map(t => (
                        <span key={t} className="tray-tag tray-tag--offer">{t}</span>
                      ))}
                      {item.anteckning && <span className="stash-item-note">{item.anteckning}</span>}
                    </div>
                  )}
                </div>
                <div className="stash-item-actions">
                  <button type="button" className="stash-done" onClick={() => toggleDone(item.id)} title="Åt/använt detta">✓</button>
                  <button type="button" className="stash-remove" onClick={() => remove(item.id)} title="Ta bort">✕</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="stash-offers">
          <h3 className="shop-group-title">Veckans fynd</h3>
          <input
            className="tray-search"
            type="search"
            placeholder="Sök i veckans fynd…"
            value={offerQuery}
            onChange={e => setOfferQuery(e.target.value)}
          />
          <div className="offer-cloud">
            {rankedOffers.map((o, i) => {
              const savings = parseSavings(o.besparing)
              const inPool = stashedOfferNames.has(o.namn.toLowerCase())
              return (
                <button
                  key={offerKey(o, i)}
                  type="button"
                  className={`offer-chip${savings > 0 ? ' offer-chip--fynd' : ''}${inPool ? ' on' : ''}`}
                  onClick={() => toggleOfferInPool(o)}
                  title={`${describeOffer(o)} · ${o.pris_text}`}
                >
                  {inPool ? '✓ ' : ''}{o.namn}
                  {savings > 0 && <span className="offer-chip-save">−{savings}kr</span>}
                </button>
              )
            })}
            {rankedOffers.length === 0 && <div className="tray-empty">Inga fynd matchar.</div>}
          </div>
        </section>

        <section className="stash-add">
          <h3 className="shop-group-title">Lägg till för hand</h3>
          <div className="stash-add-form">
            <div className="stash-kindpicker">
              <button type="button" className={`tray-fbtn${addKind === 'dish' ? ' on' : ''}`} onClick={() => setAddKind('dish')}>
                🍽️ Rätt/idé
              </button>
              <button type="button" className={`tray-fbtn${addKind === 'stock' ? ' on' : ''}`} onClick={() => setAddKind('stock')}>
                🧺 Råvara du har
              </button>
            </div>
            <input
              className="tray-search"
              type="text"
              placeholder={addKind === 'dish' ? 'T.ex. Grillburgare, korv…' : 'T.ex. Fläskfärs i frysen, rester från igår…'}
              value={ideaName}
              onChange={e => setIdeaName(e.target.value)}
            />
            <input
              className="tray-search"
              type="text"
              placeholder="Anteckning (valfritt)"
              value={ideaNote}
              onChange={e => setIdeaNote(e.target.value)}
            />
            <div className="stash-tagpicker">
              {IDEA_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  className={`tray-fbtn${ideaTags.includes(tag) ? ' on' : ''}`}
                  onClick={() => toggleIdeaTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <button type="button" className="stash-add-btn" onClick={submitIdea} disabled={!ideaName.trim()}>
              + Lägg i skafferiet
            </button>
          </div>
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
                <div className="stash-item stash-item--done" key={item.id}>
                  <span className="stash-item-kind">{KIND_ICON[item.kind]}</span>
                  <div className="stash-item-body">
                    <div className="stash-item-name">{item.namn}</div>
                  </div>
                  <div className="stash-item-actions">
                    <button type="button" className="stash-restore" onClick={() => toggleDone(item.id)} title="Tillbaka till poolen">↺</button>
                    <button type="button" className="stash-remove" onClick={() => remove(item.id)} title="Ta bort">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
