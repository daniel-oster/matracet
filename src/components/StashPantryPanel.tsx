import { useMemo, useState } from 'react'
import { Recipe, RecipeIndexEntry } from '../types'
import { usePantry } from '../hooks/usePantry'
import { useOffers } from '../hooks/useOffers'
import { useStash, StashKind } from '../hooks/useStash'
import { useShoppingList } from '../hooks/useShoppingList'
import { useIrrelevantOffers } from '../hooks/useIrrelevantOffers'
import { describeOffer, tagOffers, TaggedOffer } from '../lib/bevaka'
import { matchPantryRecipes } from '../lib/pantryMatch'
import { parseSavings } from '../lib/suggestions'
import SwipeRow from './SwipeRow'

const IDEA_TAGS = ['🏷 Fynd', '⚡ Snabbt', '🧊 Fryst', '🌱 Vegan', '🔥 Grill']
const KIND_ICON: Record<StashKind, string> = { dish: '🍽️', stock: '🧺' }

function offerKey(o: TaggedOffer, i: number): string {
  return `${o.store}-${o.namn}-${o.storlek ?? ''}-${i}`
}

interface Props {
  recipeIndex: RecipeIndexEntry[]
  fullRecipes: Record<string, Recipe>
  onOpenRecipe: (slug: string) => void
}

/**
 * "What do we have, what can we cook with it" panel — the stash pool plus a pantry
 * match against it, shared between SkafferiView and VeckanPlanner's chaos-mode view
 * so the two don't maintain separate copies of the same pantry/offer logic.
 */
export default function StashPantryPanel({ recipeIndex, fullRecipes, onOpenRecipe }: Props) {
  const { items, addItem, toggleDone, remove } = useStash()
  const pantry = usePantry()
  const { addOrRestoreByName, removeOrMarkByName } = useShoppingList()
  const { isIrrelevant, markIrrelevant } = useIrrelevantOffers()
  const { stores } = useOffers()
  const taggedOffers = useMemo(() => (stores ? tagOffers(stores) : []), [stores])
  const offers = useMemo(() => taggedOffers.filter(o => !isIrrelevant(o.namn)), [taggedOffers, isIrrelevant])

  const [pantryExpanded, setPantryExpanded] = useState(false)
  const [offerQuery, setOfferQuery] = useState('')
  const [addKind, setAddKind] = useState<StashKind>('dish')
  const [ideaName, setIdeaName] = useState('')
  const [ideaNote, setIdeaNote] = useState('')
  const [ideaTags, setIdeaTags] = useState<string[]>([])

  const activeItems = items.filter(i => !i.done)
  const stashedSlugs = new Set(activeItems.map(i => i.receptSlug).filter((s): s is string => !!s))
  const stashedOfferNames = new Set(activeItems.filter(i => i.kind === 'stock').map(i => i.namn.toLowerCase()))
  const stockNames = activeItems.filter(i => i.kind === 'stock').map(i => i.namn)

  const haveNames = useMemo(
    () => [...(pantry?.always_have ?? []), ...(pantry?.current_stock.map(i => i.vara) ?? []), ...stockNames],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pantry, stockNames.join('|')],
  )

  const pantryMatches = useMemo(
    () => matchPantryRecipes(recipeIndex, fullRecipes, haveNames),
    [recipeIndex, fullRecipes, haveNames],
  )

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
      removeOrMarkByName(o.namn)
    } else {
      const savings = parseSavings(o.besparing)
      addItem(o.namn, 'stock', null, [savings > 0 ? `🏷 spara ${savings}kr` : '🏷 fynd'], `${describeOffer(o)} · ${o.pris_text}`)
      addOrRestoreByName(o.namn)
    }
  }

  return (
    <>
      <section className="stash-cook">
        <h3 className="shop-group-title">Vad kan vi laga?</h3>
        {pantryMatches.length === 0 && (
          <div className="fynd-empty">
            Inget matchar än — plocka in fynd eller råvaror i skafferiet nedan, så dyker recept upp här.
          </div>
        )}
        {pantryMatches.length > 0 && (
          <button type="button" className="stash-expand-btn" onClick={() => setPantryExpanded(e => !e)}>
            {pantryExpanded ? '▲ Dölj' : `▼ Visa (${Math.min(pantryMatches.length, 12)})`}
          </button>
        )}
        {pantryExpanded && (
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
                    {stashedSlugs.has(m.entry.slug) ? '✓ I skafferiet' : '+ Skafferi'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="stash-pool">
        <h3 className="shop-group-title">I ditt skafferi</h3>
        {activeItems.length === 0 && (
          <div className="fynd-empty">
            Skafferiet är tomt — plocka fynd eller lägg till en egen idé nedan.
          </div>
        )}
        <div className="stash-list">
          {activeItems.map(item => {
            const title = [item.taggar.join(', '), item.anteckning].filter(Boolean).join(' · ') || undefined
            return (
              <div className="stash-chip" key={item.id} title={title}>
                <span className="stash-chip-kind">{KIND_ICON[item.kind]}</span>
                {item.receptSlug ? (
                  <button
                    type="button"
                    className="stash-chip-name stash-chip-name--link"
                    onClick={() => onOpenRecipe(item.receptSlug!)}
                  >
                    {item.namn}
                  </button>
                ) : (
                  <span className="stash-chip-name">{item.namn}</span>
                )}
                {item.taggar[0] && <span className="stash-chip-tag">{item.taggar[0]}</span>}
                <button type="button" className="stash-chip-btn stash-chip-btn--done" onClick={() => toggleDone(item.id)} title="Åt/använt detta">✓</button>
                <button type="button" className="stash-chip-btn stash-chip-btn--remove" onClick={() => remove(item.id)} title="Ta bort">✕</button>
              </div>
            )
          })}
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
        <p className="fynd-hint">← Svep en pill vänster för att markera den som irrelevant.</p>
        <div className="offer-cloud">
          {rankedOffers.map((o, i) => {
            const savings = parseSavings(o.besparing)
            const inPool = stashedOfferNames.has(o.namn.toLowerCase())
            return (
              <SwipeRow key={offerKey(o, i)} variant="chip" onSwipeLeft={() => markIrrelevant(o.namn)}>
                <button
                  type="button"
                  className={`offer-chip${savings > 0 ? ' offer-chip--fynd' : ''}${inPool ? ' on' : ''}`}
                  onClick={() => toggleOfferInPool(o)}
                  title={`${describeOffer(o)} · ${o.pris_text}`}
                >
                  {inPool ? '✓ ' : ''}{o.namn}
                  {savings > 0 && <span className="offer-chip-save">−{savings}kr</span>}
                </button>
              </SwipeRow>
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
    </>
  )
}
