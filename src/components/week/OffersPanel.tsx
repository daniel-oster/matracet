import { useState } from 'react'
import type { ReactNode } from 'react'
import type { TaggedOffer } from '../../lib/bevaka'
import type { RankedSuggestion } from '../../lib/suggestions'
import { parseSavings } from '../../lib/suggestions'
import type { Meal } from '../../types/meal'
import { resolveMealForRecipe } from '../../lib/mealResolve'
import CollapsibleSection from './CollapsibleSection'

interface Props {
  offers: TaggedOffer[]
  isActiveForOffer: (namn: string, store: string) => boolean
  onToggleOffer: (o: TaggedOffer) => void
  fromOffers: RankedSuggestion[]
  meals: Meal[]
  onOpenRecipe: (slug: string) => void
  renderAssign: (key: string, namn: string, mealSlug: string, receptSlug: string | null, reuseEntryId?: string) => ReactNode
}

/**
 * "🏷 Veckans fynd" (food-only offers, ranked by value, tap-to-shop) + the collapsed-by-
 * default "💡 Förslag från fynden" (meals/recipes derivable from what's cheap) — the
 * inspiration-first heart of the 2026-08 Planera redesign (issue #93). Offers are already
 * filtered to `MEAL_PLANNING_GROUPS` by the caller; this component only ranks/renders them.
 */
export default function OffersPanel({ offers, isActiveForOffer, onToggleOffer, fromOffers, meals, onOpenRecipe, renderAssign }: Props) {
  const [showAll, setShowAll] = useState(false)
  const ranked = [...offers].sort((a, b) => parseSavings(b.besparing) - parseSavings(a.besparing))
  const visible = showAll ? ranked : ranked.slice(0, 8)

  return (
    <>
      <CollapsibleSection id="offers" title="🏷 Veckans fynd" hint="mat" defaultCollapsed={false}>
        <div className="offer-cloud">
          {visible.map((o, i) => {
            const savings = parseSavings(o.besparing)
            const inList = isActiveForOffer(o.namn, o.store)
            return (
              <button
                key={`${o.store}-${o.namn}-${i}`}
                type="button"
                className={`offer-chip${savings > 0 ? ' offer-chip--fynd' : ''}${inList ? ' on' : ''}`}
                onClick={() => onToggleOffer(o)}
              >
                {inList ? '✓ ' : ''}{o.namn}
                {savings > 0 && <span className="offer-chip-save">−{savings}kr</span>}
              </button>
            )
          })}
          {ranked.length === 0 && <div className="tray-empty">Inga matfynd den här veckan.</div>}
        </div>
        {ranked.length > 8 && (
          <button type="button" className="offer-more" onClick={() => setShowAll(v => !v)}>
            {showAll ? '▲ visa färre' : `visa ${ranked.length - 8} till ▸`} · tryck = inköpslistan
          </button>
        )}
      </CollapsibleSection>

      <CollapsibleSection id="forslag-fynden" title="💡 Förslag från fynden" defaultCollapsed={false}>
        {fromOffers.length === 0 && <div className="tray-empty">Inga förslag från veckans fynd än.</div>}
        <div className="sugg-list">
          {fromOffers.slice(0, 8).map(s => {
            const meal = resolveMealForRecipe(s.entry.slug, s.entry.namn, meals)
            return (
              <div key={s.entry.slug} className="sugg-card">
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
                {renderAssign(s.entry.slug, s.entry.namn, meal.slug, s.entry.slug)}
              </div>
            )
          })}
        </div>
      </CollapsibleSection>
    </>
  )
}
